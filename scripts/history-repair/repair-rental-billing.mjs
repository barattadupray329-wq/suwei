import { mkdir, writeFile } from 'node:fs/promises'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
const databaseId = 'f4ce4067-8b29-4186-83d7-49a48b8a1206'
const apply = process.argv.includes('--apply')
const today = new Date().toISOString().slice(0, 10)
if (!accountId || !token) throw new Error('缺少 Cloudflare 环境变量')

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`
async function query(sql, params = []) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error(JSON.stringify(body.errors || body))
  return body.result[0]?.results || []
}
const cents = (value) => Math.round(Number(value || 0) * 100)
const money = (value) => (value / 100).toFixed(2)
const addDays = (date, days) => {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
const addMonths = (date, months) => {
  const value = new Date(`${date}T00:00:00Z`)
  const day = value.getUTCDate()
  value.setUTCDate(1)
  value.setUTCMonth(value.getUTCMonth() + months)
  const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate()
  value.setUTCDate(Math.min(day, last))
  return value.toISOString().slice(0, 10)
}
const recurringTypes = new Set(['起租预收', '租金', '续租费', '逾期续租租金'])
const all = async (table) => query(`SELECT * FROM ${table}`)

const tables = ['rentals', 'rental_items', 'receivable_bills', 'payment_records', 'payment_allocations', 'payment_discounts', 'account_ledger', 'renewal_records', 'rental_events', 'rental_price_periods']
const snapshot = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await all(table)])))
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await mkdir('backups/history-repair', { recursive: true })
const backupPath = `backups/history-repair/rental-billing-${stamp}.json`
await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), tables: snapshot }, null, 2))

const rentals = new Map(snapshot.rentals.map((row) => [row.id, row]))
const bills = snapshot.receivable_bills.map((row) => ({ ...row }))
const allocations = snapshot.payment_allocations.map((row) => ({ ...row }))
const payments = snapshot.payment_records.map((row) => ({ ...row }))
let nextBillId = Math.max(...bills.map((row) => row.id), 0) + 1
const statements = []
const params = []
const changes = { splitBills: [], normalizedPeriods: [], futureBills: [], deletedPayments: [], warnings: [] }
const push = (sql, values = []) => { statements.push(sql); params.push(values) }

for (const bill of [...bills]) {
  const rental = rentals.get(bill.rentalId)
  if (!rental || bill.billType !== '起租预收' || Number(rental.duration) <= 1 || bill.periodStart !== rental.startDate || (new Date(bill.periodEnd) - new Date(bill.periodStart)) / 86400000 <= 35) continue
  const count = Number(rental.duration)
  const amountTotal = cents(bill.amount)
  const paidTotal = cents(bill.paidAmount)
  const amounts = Array.from({ length: count }, (_, index) => Math.floor(amountTotal / count) + (index < amountTotal % count ? 1 : 0))
  let paidLeft = paidTotal
  const split = Array.from({ length: count }, (_, index) => {
    const periodStart = addMonths(rental.startDate, index)
    const periodEnd = addDays(addMonths(rental.startDate, index + 1), -1)
    const paid = Math.min(amounts[index], paidLeft)
    paidLeft -= paid
    return { id: index === 0 ? bill.id : nextBillId++, amount: amounts[index], paid, periodStart, periodEnd, index }
  })
  for (const part of split) {
    const status = part.paid >= part.amount ? '已结清' : part.paid > 0 ? '部分收款' : (part.dueDate || part.periodStart) < today ? '逾期' : '待收'
    if (part.index === 0) {
      push(`UPDATE receivable_bills SET periodStart=?,periodEnd=?,dueDate=?,amount=?,paidAmount=?,status=?,notes=?,updatedAt=(unixepoch()*1000) WHERE id=?`, [part.periodStart, part.periodEnd, part.periodStart, money(part.amount), money(part.paid), status, `起租第 1 期，共 ${count} 期`, part.id])
      Object.assign(bill, { periodStart: part.periodStart, periodEnd: part.periodEnd, dueDate: part.periodStart, amount: money(part.amount), paidAmount: money(part.paid), status })
    } else {
      const newBill = { ...bill, id: part.id, billNo: `${rental.contractNo}-MIG-${bill.id}-${String(part.index + 1).padStart(2, '0')}`, periodStart: part.periodStart, periodEnd: part.periodEnd, dueDate: part.periodStart, amount: money(part.amount), paidAmount: money(part.paid), status, notes: `起租第 ${part.index + 1} 期，共 ${count} 期` }
      bills.push(newBill)
      push(`INSERT INTO receivable_bills (id,userId,rentalId,billNo,periodStart,periodEnd,dueDate,billType,amount,paidAmount,status,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [newBill.id, newBill.userId, newBill.rentalId, newBill.billNo, newBill.periodStart, newBill.periodEnd, newBill.dueDate, newBill.billType, newBill.amount, newBill.paidAmount, newBill.status, newBill.notes, newBill.createdAt, Date.now()])
    }
  }
  const oldAllocations = allocations.filter((row) => row.billId === bill.id)
  for (const allocation of oldAllocations) push('DELETE FROM payment_allocations WHERE id=?', [allocation.id])
  const capacity = split.map((part) => ({ ...part, remaining: part.paid }))
  for (const allocation of oldAllocations.sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)) {
    let remaining = cents(allocation.amount)
    for (const part of capacity) {
      const assigned = Math.min(remaining, part.remaining)
      if (!assigned) continue
      push('INSERT INTO payment_allocations (userId,rentalId,paymentRecordId,billId,amount,createdAt) VALUES (?,?,?,?,?,?)', [allocation.userId, allocation.rentalId, allocation.paymentRecordId, part.id, money(assigned), allocation.createdAt])
      part.remaining -= assigned
      remaining -= assigned
      if (!remaining) break
    }
    if (remaining) changes.warnings.push(`账单 ${bill.id} 存在超出账面已收的付款分配 ${money(remaining)}；保留付款原始记录但不重复计入账单已收`)
  }
  changes.splitBills.push({ contractNo: rental.contractNo, billId: bill.id, periods: count, amount: money(amountTotal), paid: money(paidTotal) })
}

for (const [rentalId, rentalBills] of Map.groupBy(bills.filter((bill) => recurringTypes.has(bill.billType)), (bill) => bill.rentalId)) {
  const groups = [...Map.groupBy(rentalBills, (bill) => `${bill.periodStart}|${bill.periodEnd}`).values()].sort((a, b) => a[0].periodStart.localeCompare(b[0].periodStart) || a[0].id - b[0].id)
  let previousEnd = ''
  for (const group of groups) {
    const originalStart = group[0].periodStart
    const originalEnd = group[0].periodEnd
    if (previousEnd && originalStart <= previousEnd) {
      const correctedStart = addDays(previousEnd, 1)
      if (correctedStart > originalEnd) {
        changes.warnings.push(`合同 ${rentals.get(rentalId)?.contractNo} 的账期 ${originalStart} 至 ${originalEnd} 无法自动去重`)
      } else {
        for (const bill of group) {
          push('UPDATE receivable_bills SET periodStart=?,dueDate=CASE WHEN dueDate<? THEN ? ELSE dueDate END,updatedAt=(unixepoch()*1000) WHERE id=?', [correctedStart, correctedStart, correctedStart, bill.id])
          bill.periodStart = correctedStart
        }
        changes.normalizedPeriods.push({ contractNo: rentals.get(rentalId)?.contractNo, billIds: group.map((bill) => bill.id), from: originalStart, to: correctedStart })
      }
    }
    previousEnd = previousEnd > originalEnd ? previousEnd : originalEnd
  }
}

const futureBillTypes = new Set(['续租费', '逾期续租租金'])
const futureBills = bills.filter((bill) => futureBillTypes.has(bill.billType) && bill.periodStart > today)
const futureIds = new Set(futureBills.map((bill) => bill.id))
const affectedPaymentIds = new Set(allocations.filter((row) => futureIds.has(row.billId)).map((row) => row.paymentRecordId))
for (const bill of futureBills) {
  push('DELETE FROM payment_allocations WHERE billId=?', [bill.id])
  push('DELETE FROM receivable_bills WHERE id=?', [bill.id])
  changes.futureBills.push({ contractNo: rentals.get(bill.rentalId)?.contractNo, billId: bill.id, periodStart: bill.periodStart, amount: bill.amount, paid: bill.paidAmount })
}
for (const paymentId of affectedPaymentIds) {
  const payment = payments.find((row) => row.id === paymentId)
  if (!payment) continue
  const keptAllocationCents = allocations.filter((row) => row.paymentRecordId === paymentId && !futureIds.has(row.billId)).reduce((sum, row) => sum + cents(row.amount), 0)
  if (keptAllocationCents === 0) {
    push('DELETE FROM payment_discounts WHERE paymentRecordId=?', [paymentId])
    push('DELETE FROM account_ledger WHERE paymentRecordId=?', [paymentId])
    push('DELETE FROM payment_records WHERE id=?', [paymentId])
    if (payment.renewalRecordId) {
      const renewal = snapshot.renewal_records.find((row) => row.id === payment.renewalRecordId)
      if (renewal) {
        push("DELETE FROM rental_price_periods WHERE rental_id=? AND source='renewal' AND effective_start>=?", [renewal.rentalId, renewal.oldEndDate])
        push("DELETE FROM rental_events WHERE rentalId=? AND eventType='续租' AND createdAt>=?", [renewal.rentalId, renewal.createdAt])
        push('DELETE FROM renewal_records WHERE id=?', [renewal.id])
        push('UPDATE rental_items SET endDate=?,updatedAt=(unixepoch()*1000) WHERE id=? AND endDate>?', [renewal.oldEndDate, renewal.sourceRentalItemId, renewal.oldEndDate])
      }
    }
    changes.deletedPayments.push({ paymentId, rentalId: payment.rentalId, amount: payment.amount })
  } else {
    push('UPDATE payment_records SET amount=? WHERE id=?', [money(keptAllocationCents), paymentId])
    changes.warnings.push(`付款 ${paymentId} 同时分配到历史与未来账单，已保留 ${money(keptAllocationCents)}`)
  }
}

const affectedRentalIds = new Set([...changes.splitBills.map((row) => bills.find((bill) => bill.id === row.billId)?.rentalId), ...futureBills.map((bill) => bill.rentalId)].filter(Boolean))
for (const rentalId of affectedRentalIds) {
  push(`UPDATE receivable_bills SET paidAmount=COALESCE((SELECT printf('%.2f',SUM(CAST(pa.amount AS REAL))) FROM payment_allocations pa WHERE pa.billId=receivable_bills.id),'0.00'),status=CASE WHEN COALESCE((SELECT SUM(CAST(pa.amount AS REAL)) FROM payment_allocations pa WHERE pa.billId=receivable_bills.id),0)>=CAST(amount AS REAL) THEN '已结清' WHEN COALESCE((SELECT SUM(CAST(pa.amount AS REAL)) FROM payment_allocations pa WHERE pa.billId=receivable_bills.id),0)>0 THEN '部分收款' WHEN dueDate<? THEN '逾期' ELSE '待收' END WHERE rentalId=? AND billType!='押金'`, [today, rentalId])
  push(`UPDATE rentals SET totalRent=printf('%.2f',(SELECT COALESCE(SUM(CAST(amount AS REAL)),0) FROM receivable_bills WHERE rentalId=? AND billType!='押金')),paidAmount=printf('%.2f',(SELECT COALESCE(SUM(CAST(paidAmount AS REAL)),0) FROM receivable_bills WHERE rentalId=? AND billType!='押金')),paymentStatus=CASE WHEN (SELECT COALESCE(SUM(CAST(paidAmount AS REAL)),0) FROM receivable_bills WHERE rentalId=? AND billType!='押金')=0 THEN '未收款' WHEN (SELECT COALESCE(SUM(CAST(paidAmount AS REAL)),0) FROM receivable_bills WHERE rentalId=? AND billType!='押金')>=(SELECT COALESCE(SUM(CAST(amount AS REAL)),0) FROM receivable_bills WHERE rentalId=? AND billType!='押金') THEN '已结清' ELSE '部分收款' END,updatedAt=(unixepoch()*1000) WHERE id=?`, [rentalId, rentalId, rentalId, rentalId, rentalId, rentalId])
}

const reportPath = `backups/history-repair/rental-billing-plan-${stamp}.json`
await writeFile(reportPath, JSON.stringify({ mode: apply ? 'apply' : 'dry-run', today, backupPath, statementCount: statements.length, changes }, null, 2))
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', backupPath, reportPath, statementCount: statements.length, counts: { splitBills: changes.splitBills.length, normalizedPeriods: changes.normalizedPeriods.length, futureBills: changes.futureBills.length, deletedPayments: changes.deletedPayments.length, warnings: changes.warnings.length } }, null, 2))
if (changes.warnings.length) console.error(JSON.stringify(changes.warnings, null, 2))
if (apply) {
  for (let index = 0; index < statements.length; index += 1) {
    await query(statements[index], params[index])
    if ((index + 1) % 50 === 0) console.log(`已执行 ${index + 1}/${statements.length}`)
  }
  console.log('APPLIED')
}
