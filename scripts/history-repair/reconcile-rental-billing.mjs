import { readFile } from 'node:fs/promises'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
const databaseId = 'f4ce4067-8b29-4186-83d7-49a48b8a1206'
const backupFile = process.argv[2]
const apply = process.argv.includes('--apply')
if (!accountId || !token || !backupFile) throw new Error('缺少环境变量或备份文件参数')
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`
async function query(sql, params = []) {
  let error
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(JSON.stringify(body.errors || body))
      return body.result[0]?.results || []
    } catch (caught) {
      error = caught
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200))
    }
  }
  throw error
}
const cents = (value) => Math.round(Number(value || 0) * 100)
const money = (value) => (value / 100).toFixed(2)
const addDays = (date, days) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
const addMonths = (date, months) => { const value = new Date(`${date}T00:00:00Z`); const day = value.getUTCDate(); value.setUTCDate(1); value.setUTCMonth(value.getUTCMonth() + months); const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate(); value.setUTCDate(Math.min(day, last)); return value.toISOString().slice(0, 10) }
const backup = JSON.parse(await readFile(backupFile, 'utf8')).tables
const currentBills = await query('SELECT * FROM receivable_bills')
const currentAllocations = await query('SELECT * FROM payment_allocations')
const rentals = new Map(backup.rentals.map((row) => [row.id, row]))
let nextId = Math.max(...currentBills.map((row) => Number(row.id)), 0) + 1
const statements = []
const push = (sql, params = []) => statements.push({ sql, params })
const merged = backup.receivable_bills.filter((bill) => {
  const rental = rentals.get(bill.rentalId)
  return rental && bill.billType === '起租预收' && Number(rental.duration) > 1 && bill.periodStart === rental.startDate && (new Date(bill.periodEnd) - new Date(bill.periodStart)) / 86400000 > 35
})
const mergedIds = new Set(merged.map((bill) => bill.id))
for (const bill of backup.receivable_bills.filter((row) => !mergedIds.has(row.id))) {
  push('UPDATE receivable_bills SET amount=?,paidAmount=?,status=? WHERE id=?', [bill.amount, bill.paidAmount, bill.status, bill.id])
}
for (const bill of merged) {
  const rental = rentals.get(bill.rentalId)
  const count = Number(rental.duration)
  const amountTotal = cents(bill.amount)
  const paidTotal = cents(bill.paidAmount)
  const amounts = Array.from({ length: count }, (_, index) => Math.floor(amountTotal / count) + (index < amountTotal % count ? 1 : 0))
  let paidLeft = paidTotal
  const parts = []
  for (let index = 0; index < count; index += 1) {
    const periodStart = addMonths(rental.startDate, index)
    const periodEnd = addDays(addMonths(rental.startDate, index + 1), -1)
    const amount = amounts[index]
    const paid = Math.min(amount, paidLeft)
    paidLeft -= paid
    const existing = currentBills.find((row) => row.rentalId === bill.rentalId && row.billType === '起租预收' && row.periodStart === periodStart && row.notes === `起租第 ${index + 1} 期，共 ${count} 期`)
    const id = index === 0 ? bill.id : existing?.id || nextId++
    const status = paid >= amount ? '已结清' : paid > 0 ? '部分收款' : periodStart < '2026-08-14' ? '逾期' : '待收'
    parts.push({ id, amount, paid })
    if (index === 0 || existing) {
      push('UPDATE receivable_bills SET periodStart=?,periodEnd=?,dueDate=?,amount=?,paidAmount=?,status=?,notes=? WHERE id=?', [periodStart, periodEnd, periodStart, money(amount), money(paid), status, `起租第 ${index + 1} 期，共 ${count} 期`, id])
    } else {
      push('INSERT INTO receivable_bills (id,userId,rentalId,billNo,periodStart,periodEnd,dueDate,billType,amount,paidAmount,status,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, bill.userId, bill.rentalId, `${rental.contractNo}-MIG-${bill.id}-${String(index + 1).padStart(2, '0')}`, periodStart, periodEnd, periodStart, bill.billType, money(amount), money(paid), status, `起租第 ${index + 1} 期，共 ${count} 期`, bill.createdAt, Date.now()])
    }
  }
  const partIds = new Set(parts.map((part) => part.id))
  for (const allocation of currentAllocations.filter((row) => partIds.has(row.billId))) push('DELETE FROM payment_allocations WHERE id=?', [allocation.id])
  const capacities = parts.map((part) => ({ ...part, remaining: part.paid }))
  for (const allocation of backup.payment_allocations.filter((row) => row.billId === bill.id)) {
    let remaining = cents(allocation.amount)
    for (const part of capacities) {
      const assigned = Math.min(remaining, part.remaining)
      if (!assigned) continue
      push('INSERT INTO payment_allocations (userId,rentalId,paymentRecordId,billId,amount,createdAt) VALUES (?,?,?,?,?,?)', [allocation.userId, allocation.rentalId, allocation.paymentRecordId, part.id, money(assigned), allocation.createdAt])
      part.remaining -= assigned
      remaining -= assigned
      if (!remaining) break
    }
  }
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', mergedBills: merged.length, statements: statements.length }, null, 2))
if (apply) {
  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index]
    await query(statement.sql, statement.params)
    if ((index + 1) % 50 === 0) console.log(`已执行 ${index + 1}/${statements.length}`)
  }
  console.log('RECONCILED')
}
