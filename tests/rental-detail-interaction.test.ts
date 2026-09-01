import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const root = process.cwd()
const dashboard = readFileSync(join(root, 'components/dashboard.tsx'), 'utf8')
const records = readFileSync(join(root, 'components/rental-records.tsx'), 'utf8')
const rentalActions = readFileSync(join(root, 'app/actions/rentals.ts'), 'utf8')

test('带 rental 参数关闭详情时返回原列表查询上下文', () => {
  expect(dashboard).toMatch(
    /if \(searchParams\.has\("rental"\)\) \{\s*window\.location\.assign\(returnHref\);\s*return;/,
  )
  expect(records).toMatch(/params\.set\('rental', String\(id\)\)/)
  expect(dashboard).not.toMatch(/router\.push\(returnHref\)/)
})

test('详情子流程成功后回到同一合同详情', () => {
  expect(dashboard).toMatch(/runInDetail\(\(\) => collectPayment\(selected\.id, value\), "收款已登记"\)/)
  expect(dashboard).toMatch(/setDialog\(successDialog\);\s*router\.refresh\(\)/)
})

test('合同详情首次打开主动刷新且不会循环刷新', () => {
  expect(dashboard).toContain('const detailRefreshStarted = useRef(false)')
  expect(dashboard).toMatch(/if \(!linkedRental \|\| detailRefreshStarted\.current\) return;\s*detailRefreshStarted\.current = true;\s*router\.refresh\(\)/)
})

test('租赁管理桌面合同列表双击打开详情', () => {
  expect(dashboard).toMatch(/onDoubleClick=\{\(\) => openDetail\(r\)\}/)
  expect(records).toMatch(/onDoubleClick=\{\(\) => openDetail\(row\.id\)\}/)
})

test('多月续租按月创建独立账单，并吸收同月已存在的逾期续租租金账单', () => {
  // 仍然按月循环生成账期
  expect(rentalActions).toContain('for (let periodIndex = 0; periodIndex < value.duration; periodIndex += 1)')
  expect(rentalActions).toContain('const billNo = `RENEW-${rentalId}-${renewal.id}-${periodIndex + 1}`')
  // 续租时先把每期账期和已存在的"逾期续租租金"账单做重叠匹配，命中则吸收、不新建重复账单
  expect(rentalActions).toContain('matchRenewalPeriodsToOverdueBills(')
  expect(rentalActions).toContain("bill.billType.includes('续租租金')")
  // 吸收：改写原逾期账单为续租费并保留已收金额；未命中才新建
  expect(rentalActions).toContain('if (plan.absorbBillId !== null)')
  // 即时收款只收"还欠部分"，避免对已收月份二次收款
  expect(rentalActions).toContain('bill.outstandingCents')
  // 合同应收/已收按账单与有效收款重算，杜绝双计
  expect(rentalActions).toContain('const totalCents = billsReceivableCents(finalBills)')
  expect(rentalActions).not.toContain('const totalRent = Number(rental.totalRent) + addedRent')
})

test('本单全部收款冲正只处理尚未冲正的正数收款', () => {
  expect(rentalActions).toContain('export async function reverseAllPayments(rentalId: number, reason: string)')
  expect(rentalActions).toContain("eq(accountLedger.entryType, '收款冲正')")
  expect(rentalActions).toContain('const activePayments = activePositivePayments(payments, reversals)')
  expect(rentalActions).toContain('await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])')
  expect(rentalActions).not.toContain('for (const payment of activePayments) await reversePayment')
  expect(rentalActions).toContain("action: '全部收款冲正'")
})

test('收款流水默认隐藏已冲正记录并提供历史切换', () => {
  expect(dashboard).toContain('const [showReversalHistory, setShowReversalHistory] = useState(false)')
  expect(dashboard).toContain('const displayedPayments = showReversalHistory ? rental.paymentRecords : activePayments')
  expect(dashboard).toContain('查看冲正历史')
  expect(dashboard).toContain('全部收款冲正')
})
