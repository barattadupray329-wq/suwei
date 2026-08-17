import { mkdir, writeFile } from 'node:fs/promises'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
const databaseId = 'f4ce4067-8b29-4186-83d7-49a48b8a1206'
const apply = process.argv.includes('--apply')
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

const duplicateBills = [
  { contractNo: 'HT20260313-001', billId: 1785046929130284, amount: 90 },
  { contractNo: 'HT20260725-002', billId: 1785046929130285, amount: 90 },
]
const boundaryBills = [
  { contractNo: 'HT20260108-001', billId: 1786013254757015, from: '2026-08-07', to: '2026-08-08' },
  { contractNo: 'HT20260208-001', billId: 1786013254757012, from: '2026-08-06', to: '2026-08-07' },
]
const contractNos = [...duplicateBills, ...boundaryBills].map((item) => item.contractNo)
const placeholders = contractNos.map(() => '?').join(',')
const snapshot = {
  createdAt: new Date().toISOString(),
  rentals: await query(`SELECT * FROM rentals WHERE contractNo IN (${placeholders})`, contractNos),
  bills: await query(`SELECT b.* FROM receivable_bills b JOIN rentals r ON r.id=b.rentalId WHERE r.contractNo IN (${placeholders}) ORDER BY r.contractNo,b.periodStart,b.id`, contractNos),
  payments: await query(`SELECT p.* FROM payment_records p JOIN rentals r ON r.id=p.rentalId WHERE r.contractNo IN (${placeholders}) ORDER BY r.contractNo,p.id`, contractNos),
  allocations: await query(`SELECT a.* FROM payment_allocations a JOIN rentals r ON r.id=a.rentalId WHERE r.contractNo IN (${placeholders}) ORDER BY r.contractNo,a.id`, contractNos),
}

for (const expected of duplicateBills) {
  const bill = snapshot.bills.find((row) => row.id === expected.billId)
  if (!bill || bill.billType !== '逾期租金' || Number(bill.amount) !== expected.amount || Number(bill.paidAmount) !== 0) throw new Error(`${expected.contractNo} 重复账单与预期不符，已停止`)
  if (snapshot.allocations.some((row) => row.billId === expected.billId)) throw new Error(`${expected.contractNo} 重复账单已有付款分配，已停止`)
}
for (const expected of boundaryBills) {
  const bill = snapshot.bills.find((row) => row.id === expected.billId)
  if (!bill || bill.periodStart !== expected.from) throw new Error(`${expected.contractNo} 边界账单与预期不符，已停止`)
}

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await mkdir('backups/history-repair', { recursive: true })
const backupPath = `backups/history-repair/overlapping-billing-periods-${stamp}.json`
await writeFile(backupPath, JSON.stringify(snapshot, null, 2))
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', backupPath, deleteBills: duplicateBills, shiftStarts: boundaryBills }, null, 2))
if (!apply) process.exit(0)

for (const item of duplicateBills) {
  await query('DELETE FROM receivable_bills WHERE id=? AND billType=? AND CAST(paidAmount AS REAL)=0', [item.billId, '逾期租金'])
  await query(`UPDATE rentals SET totalRent=printf('%.2f',CAST(totalRent AS REAL)-?),paymentStatus=CASE WHEN CAST(paidAmount AS REAL)>=CAST(totalRent AS REAL)-? THEN '已结清' WHEN CAST(paidAmount AS REAL)>0 THEN '部分收款' ELSE '待收款' END,updatedAt=(unixepoch()*1000) WHERE contractNo=? AND lifecycleStatus='active'`, [item.amount, item.amount, item.contractNo])
}
for (const item of boundaryBills) {
  await query('UPDATE receivable_bills SET periodStart=?,updatedAt=(unixepoch()*1000) WHERE id=? AND periodStart=?', [item.to, item.billId, item.from])
}

const remainingDuplicates = await query(`SELECT r.contractNo,o.id overdueId,n.id renewalId FROM receivable_bills o JOIN receivable_bills n ON n.rentalId=o.rentalId AND n.id<>o.id JOIN rentals r ON r.id=o.rentalId WHERE r.lifecycleStatus='active' AND o.billType IN ('逾期租金','逾期续租租金') AND n.billType='续租费' AND CAST(o.paidAmount AS REAL)=0 AND o.periodStart=n.periodStart AND o.periodStart<=n.periodEnd AND n.periodStart<=o.periodEnd`)
const remainingBoundaryOverlaps = await query(`SELECT r.contractNo,a.id firstId,b.id nextId,a.periodEnd,b.periodStart FROM receivable_bills a JOIN receivable_bills b ON b.rentalId=a.rentalId AND a.id<>b.id JOIN rentals r ON r.id=a.rentalId WHERE r.lifecycleStatus='active' AND a.billType IN ('逾期租金','逾期续租租金') AND b.billType IN ('逾期租金','逾期续租租金') AND a.periodStart<b.periodStart AND b.periodStart<=a.periodEnd`)
if (remainingDuplicates.length || remainingBoundaryOverlaps.length) throw new Error(`修复后仍存在异常：${JSON.stringify({ remainingDuplicates, remainingBoundaryOverlaps })}`)
console.log(JSON.stringify({ ok: true, remainingDuplicates: 0, remainingBoundaryOverlaps: 0 }, null, 2))
