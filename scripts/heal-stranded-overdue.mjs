// 一次性补算「搁浅」的逾期续租租金账单。
//
// 背景：每晚 /api/cron/due-reminders 对每个用户跑的是全店铺全量 ensureOverdueRentBills(userId)，
// 属于重操作，一旦某店铺超限失败会被 try/catch 静默吞掉，导致该店「从没被操作过」的过期合同永远
// 不长逾期账单。本脚本复用与 lib/overdue-rent-billing.ts 完全一致的纯逻辑，直接连生产 D1 把这些
// 合同补齐，幂等（INSERT OR IGNORE，billNo 唯一）——重复运行不会产生重复账单。
//
// 用法：set -a && source /vercel/share/.env.project && set +a && node scripts/heal-stranded-overdue.mjs [--apply]
// 默认只演练并打印将要写入的 SQL；加 --apply 才真正执行。

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const DB = 'suwei-db'

function d1Query(sql) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  const jsonStart = out.indexOf('[')
  const parsed = JSON.parse(out.slice(jsonStart))
  return parsed[0].results
}

function d1File(sqlText) {
  const path = '/tmp/heal-overdue.sql'
  writeFileSync(path, sqlText)
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--file', path], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  return out
}

// ---- 与 lib/rental-calculations.ts 完全一致 ----
function dateOnly(value) { return new Date(`${value}T00:00:00Z`) }
function addCalendarDays(value, days) {
  const date = dateOnly(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
function addCalendarMonths(value, months) {
  const [year, month, day] = value.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}
function toCents(value) { return Math.round(Number(value) * 100) }
function fromCents(value) { return (value / 100).toFixed(2) }

// ---- 与 lib/overdue-rent.ts 完全一致 ----
function overdueRentPeriods(endDate, today) {
  const periods = []
  let periodStart = addCalendarDays(endDate, 1)
  while (periodStart <= today) {
    const periodEnd = addCalendarMonths(periodStart, 1)
    periods.push({ periodStart, periodEnd })
    periodStart = periodEnd
  }
  return periods
}
function remainingQuantityAsOf(itemQuantity, itemId, periodStart, disposals) {
  const disposed = disposals
    .filter((row) => row.rentalItemId === itemId && row.date <= periodStart)
    .reduce((sum, row) => sum + row.quantity, 0)
  return Math.max(0, itemQuantity - disposed)
}

// ---- 与 lib/rental-reconciliation.ts 完全一致 ----
function paymentStatusFromCents(receivableCents, paidCents) {
  if (receivableCents <= 0 || paidCents >= receivableCents) return '已结清'
  if (paidCents > 0) return '部分收款'
  return '待收款'
}

function sqlStr(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const yesterday = addCalendarDays(today, -1)
console.log(`[heal] today=${today} apply=${APPLY}`)

// 候选：正式月租、active、status 非关闭/完成、已过期（endDate < today）。逐设备判断，逻辑同 ensureOverdueRentBills。
const contracts = d1Query(`SELECT id, userId, contractNo, endDate, paidAmount FROM rentals WHERE orderType='official' AND billingType='monthly' AND lifecycleStatus='active' AND status NOT IN ('已关闭','已完成') AND endDate < '${today}'`)
if (!contracts.length) { console.log('[heal] 没有候选合同'); process.exit(0) }
const rentalIds = contracts.map((c) => c.id)
const idList = rentalIds.join(',')

const items = d1Query(`SELECT id, rentalId, userId, quantity, monthlyRent, endDate FROM rental_items WHERE rentalId IN (${idList})`)
const buyouts = d1Query(`SELECT rentalItemId, quantity, buyoutDate as date FROM buyout_records WHERE rentalId IN (${idList})`)
const returns = d1Query(`SELECT rentalItemId, quantity, returnDate as date FROM return_records WHERE rentalId IN (${idList})`)
const losses = d1Query(`SELECT rentalItemId, quantity, lossDate as date FROM loss_records WHERE rentalId IN (${idList})`)
const existingBills = d1Query(`SELECT rentalId, billNo, billType, periodStart, periodEnd, amount FROM receivable_bills WHERE rentalId IN (${idList})`)

const existing = new Set(existingBills.map((b) => b.billNo))
const existingOverdueByRental = new Map()
for (const b of existingBills) {
  if (!String(b.billType).includes('逾期')) continue
  const bucket = existingOverdueByRental.get(b.rentalId) ?? []
  bucket.push(b)
  existingOverdueByRental.set(b.rentalId, bucket)
}
const disposalsByItem = new Map()
for (const d of [...buyouts, ...returns, ...losses]) {
  const bucket = disposalsByItem.get(d.rentalItemId) ?? []
  bucket.push(d)
  disposalsByItem.set(d.rentalItemId, bucket)
}
const itemsByRental = new Map()
for (const it of items) {
  const bucket = itemsByRental.get(it.rentalId) ?? []
  bucket.push(it)
  itemsByRental.set(it.rentalId, bucket)
}

const newBills = []
for (const contract of contracts) {
  const contractItems = itemsByRental.get(contract.id) ?? []
  const groups = new Map()
  for (const item of contractItems) {
    const effectiveEndDate = item.endDate ?? contract.endDate
    const key = effectiveEndDate === contract.endDate ? 'default' : `item-${item.id}`
    const group = groups.get(key) ?? { effectiveEndDate, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  const multiGroup = groups.size > 1
  const existingOverduePeriods = existingOverdueByRental.get(contract.id) ?? []
  for (const [key, group] of groups.entries()) {
    if (group.effectiveEndDate > yesterday) continue
    for (const { periodStart, periodEnd } of overdueRentPeriods(group.effectiveEndDate, today)) {
      const billNo = multiGroup ? `OVERDUE-${contract.id}-${key}-${periodStart}` : `OVERDUE-${contract.id}-${periodStart}`
      const overlaps = existingOverduePeriods.some((b) => b.periodStart < periodEnd && b.periodEnd > periodStart)
      if (existing.has(billNo) || overlaps) continue
      const amountCents = group.items.reduce((sum, item) => sum + toCents(item.monthlyRent) * remainingQuantityAsOf(item.quantity, item.id, periodStart, disposalsByItem.get(item.id) ?? []), 0)
      if (amountCents <= 0) continue
      newBills.push({
        userId: contract.userId, rentalId: contract.id, contractNo: contract.contractNo, billNo,
        periodStart, periodEnd, dueDate: periodStart, amount: fromCents(amountCents),
        notes: `合同到期后继续使用，${periodStart} 至 ${periodEnd} 月租（周期结束日不含）`,
      })
    }
  }
}

if (!newBills.length) { console.log('[heal] 所有候选合同都无需补算'); process.exit(0) }

console.log(`[heal] 将补算 ${newBills.length} 条逾期续租租金账单：`)
for (const b of newBills) console.log(`  ${b.contractNo}  ${b.periodStart}~${b.periodEnd}  ¥${b.amount}  (${b.billNo})`)

// 受影响合同重算 totalRent / paymentStatus（含新账单）。
const affectedIds = [...new Set(newBills.map((b) => b.rentalId))]
const nowMs = Date.now()
const statements = []
for (const b of newBills) {
  statements.push(`INSERT OR IGNORE INTO receivable_bills (userId, rentalId, billNo, periodStart, periodEnd, dueDate, billType, amount, paidAmount, status, notes, createdAt, updatedAt) VALUES (${sqlStr(b.userId)}, ${b.rentalId}, ${sqlStr(b.billNo)}, ${sqlStr(b.periodStart)}, ${sqlStr(b.periodEnd)}, ${sqlStr(b.dueDate)}, '逾期续租租金', ${sqlStr(b.amount)}, '0.00', '待收', ${sqlStr(b.notes)}, ${nowMs}, ${nowMs});`)
}
// 重算：先把新账单并入现有账单集合，再按非押金求和。
const billsByRental = new Map()
for (const b of existingBills) {
  const bucket = billsByRental.get(b.rentalId) ?? []
  bucket.push({ billType: b.billType, amount: b.amount })
  billsByRental.set(b.rentalId, bucket)
}
for (const b of newBills) {
  const bucket = billsByRental.get(b.rentalId) ?? []
  bucket.push({ billType: '逾期续租租金', amount: b.amount })
  billsByRental.set(b.rentalId, bucket)
}
for (const rentalId of affectedIds) {
  const contract = contracts.find((c) => c.id === rentalId)
  const totalCents = (billsByRental.get(rentalId) ?? []).reduce((sum, x) => sum + (x.billType === '押金' ? 0 : toCents(x.amount)), 0)
  const paidCents = toCents(contract.paidAmount)
  statements.push(`UPDATE rentals SET totalRent=${sqlStr(fromCents(totalCents))}, paymentStatus=${sqlStr(paymentStatusFromCents(totalCents, paidCents))}, updatedAt=${nowMs} WHERE id=${rentalId} AND userId=${sqlStr(contract.userId)};`)
}

const sqlText = statements.join('\n')
if (!APPLY) {
  console.log('\n[heal] 演练模式（未写入）。将执行以下 SQL：\n')
  console.log(sqlText)
  console.log('\n[heal] 确认无误后加 --apply 重新运行以写入。')
  process.exit(0)
}

console.log('\n[heal] 正在写入生产库…')
const result = d1File(sqlText)
console.log(result)
console.log(`[heal] 完成：补算 ${newBills.length} 条账单，更新 ${affectedIds.length} 张合同。`)
