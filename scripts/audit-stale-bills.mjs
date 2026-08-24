import fs from 'node:fs'

function extractResults(path) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'))
  return raw[0]?.results ?? []
}

function isRentBillType(billType) {
  return billType === '租金' || billType === '起租预收' || billType === '日租租金' || billType === '续租费' || billType.includes('续租租金')
}

function toCents(v) {
  return Math.round(parseFloat(v) * 100)
}

const items = extractResults('/tmp/all_items.json')
const returns = extractResults('/tmp/all_returns.json')
const losses = extractResults('/tmp/all_losses.json')
const buyouts = extractResults('/tmp/all_buyouts.json')
const bills = extractResults('/tmp/all_active_bills.json')
const monthlyRentalIds = new Set(extractResults('/tmp/all_monthly_rentals.json').map((r) => r.id))

const disposals = [...returns, ...losses, ...buyouts]

const itemsByRental = new Map()
for (const item of items) {
  const arr = itemsByRental.get(item.rentalId) ?? []
  arr.push(item)
  itemsByRental.set(item.rentalId, arr)
}

function remainingQuantityAsOf(itemQuantity, itemId, periodStart, disposalsForItem) {
  const disposed = disposalsForItem.filter((d) => d.rentalItemId === itemId && d.date <= periodStart).reduce((s, d) => s + d.quantity, 0)
  return Math.max(0, itemQuantity - disposed)
}

const problems = []
for (const bill of bills) {
  if (!monthlyRentalIds.has(bill.rentalId)) continue
  if (!isRentBillType(bill.billType)) continue
  if (toCents(bill.paidAmount) !== 0) continue // only check fully unpaid bills, matches the recompute loop's condition
  if (bill.status !== '待收' && bill.status !== '逾期') continue // 已减免/已结清 是业务上主动处理过的状态，不属于本次待修复范围
  const rentalItems = itemsByRental.get(bill.rentalId) ?? []
  if (!rentalItems.length) continue
  const expectedCents = rentalItems.reduce((sum, item) => sum + toCents(item.monthlyRent) * remainingQuantityAsOf(item.quantity, item.id, bill.periodStart, disposals), 0)
  const actualCents = toCents(bill.amount)
  if (expectedCents !== actualCents) {
    problems.push({ rentalId: bill.rentalId, billId: bill.id, billNo: bill.billNo, billType: bill.billType, periodStart: bill.periodStart, periodEnd: bill.periodEnd, actual: bill.amount, expected: (expectedCents / 100).toFixed(2), diff: ((actualCents - expectedCents) / 100).toFixed(2), status: bill.status, notes: bill.notes })
  }
}

console.log(`共扫描 ${bills.length} 张未冲正账单，发现 ${problems.length} 张待收账单金额与当前剩余设备数不符：`)
for (const p of problems) console.log(JSON.stringify(p))
