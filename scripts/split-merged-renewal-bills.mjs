// 一次性迁移脚本：把线上「续租费」被合并成一张跨多期账单的历史数据，
// 按 app/actions/rentals.ts 现行 renewRentalItems 的拆分规则（每期一张账单）拆开。
//
// 用法：
//   node scripts/split-merged-renewal-bills.mjs           # 仅打印拆分明细，不写库
//   node scripts/split-merged-renewal-bills.mjs --apply   # 打印明细后生成 .sql 文件到 /tmp

const userId = 'c7e71d61-a737-4d42-a042-55d2edffa0fe'

// 已通过只读查询逐笔核对：均为「1 张续租费账单覆盖 duration 期（全部为月租）」、
// amount = quantity * unitPrice * duration、状态已结清；仅 2 笔（renewalRecordId 4、7）
// 有 1 条 payment_allocations 记录 1:1 关联同一笔 payment_records，其余为历史即时结清但未落 allocation 的数据。
const targets = [
  { rentalId: 1785057697276864, contractNo: 'HT20250624-002', renewalRecordId: 4, billId: 1785046929130268, billNo: 'RENEW-1785057697276864-4', duration: 9, quantity: 1, unitPrice: '150', periodStart: '2025-07-24', allocId: 20, paymentRecordId: 1785057986832630 },
  { rentalId: 1785060039260328, contractNo: 'HT20251204-001', renewalRecordId: 7, billId: 1785046929130270, billNo: 'RENEW-1785060039260328-7', duration: 5, quantity: 1, unitPrice: '80', periodStart: '2026-01-04', allocId: 22, paymentRecordId: 1785060202397756 },
  { rentalId: 1785115046743231, contractNo: 'HT20260208-001', renewalRecordId: 9, billId: 1785046929130281, billNo: 'RENEW-1785115046743231-9', duration: 2, quantity: 2, unitPrice: '120', periodStart: '2026-04-08', allocId: null, paymentRecordId: null },
  { rentalId: 1785115046743231, contractNo: 'HT20260208-001', renewalRecordId: 10, billId: 1785046929130282, billNo: 'RENEW-1785115046743231-10', duration: 2, quantity: 1, unitPrice: '40', periodStart: '2026-04-08', allocId: null, paymentRecordId: null },
  { rentalId: 1785115046743231, contractNo: 'HT20260208-001', renewalRecordId: 11, billId: 1785046929130283, billNo: 'RENEW-1785115046743231-11', duration: 2, quantity: 1, unitPrice: '40', periodStart: '2026-04-08', allocId: null, paymentRecordId: null },
  { rentalId: 1785138886354887, contractNo: 'HT20251226-001', renewalRecordId: 15, billId: 1785139479218205, billNo: 'RENEW-1785138886354887-15', duration: 4, quantity: 1, unitPrice: '140', periodStart: '2026-03-26', allocId: null, paymentRecordId: null },
  { rentalId: 1785138886354887, contractNo: 'HT20251226-001', renewalRecordId: 16, billId: 1785139479218206, billNo: 'RENEW-1785138886354887-16', duration: 4, quantity: 1, unitPrice: '20', periodStart: '2026-03-26', allocId: null, paymentRecordId: null },
  { rentalId: 1785139479218104, contractNo: 'HT20260108-001', renewalRecordId: 17, billId: 1785139479218207, billNo: 'RENEW-1785139479218104-17', duration: 3, quantity: 1, unitPrice: '140', periodStart: '2026-04-08', allocId: null, paymentRecordId: null },
  { rentalId: 1785139479218104, contractNo: 'HT20260108-001', renewalRecordId: 18, billId: 1785139479218208, billNo: 'RENEW-1785139479218104-18', duration: 3, quantity: 1, unitPrice: '20', periodStart: '2026-04-08', allocId: null, paymentRecordId: null },
  { rentalId: 1785145709960502, contractNo: 'HT20251019-001', renewalRecordId: 23, billId: 1785145709960603, billNo: 'RENEW-1785145709960502-23', duration: 2, quantity: 1, unitPrice: '130', periodStart: '2025-12-19', allocId: null, paymentRecordId: null },
  { rentalId: 1785223235106362, contractNo: 'HT20250912-001', renewalRecordId: 27, billId: 1785223235106463, billNo: 'RENEW-1785223235106362-27', duration: 8, quantity: 2, unitPrice: '50', periodStart: '2025-11-12', allocId: null, paymentRecordId: null },
  { rentalId: 1785231891482225, contractNo: 'HT20251218-001', renewalRecordId: 28, billId: 1785231891482326, billNo: 'RENEW-1785231891482225-28', duration: 3, quantity: 1, unitPrice: '370', periodStart: '2026-03-18', allocId: null, paymentRecordId: null },
  { rentalId: 1785231891482225, contractNo: 'HT20251218-001', renewalRecordId: 29, billId: 1785231891482327, billNo: 'RENEW-1785231891482225-29', duration: 3, quantity: 1, unitPrice: '60', periodStart: '2026-03-18', allocId: null, paymentRecordId: null },
]

function addCalendarMonths(date, months) {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}
function addCalendarDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
function toCents(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error('金额格式无效')
  return Math.round(number * 100)
}
function fromCents(value) {
  return (value / 100).toFixed(2)
}
function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

const plans = targets.map((target) => {
  const periodAmountCents = toCents(target.unitPrice) * target.quantity
  const splitBills = Array.from({ length: target.duration }, (_, index) => {
    const periodStart = addCalendarMonths(target.periodStart, index)
    const periodEnd = addCalendarDays(addCalendarMonths(target.periodStart, index + 1), -1)
    return {
      billNo: `${target.billNo}R${index + 1}`,
      periodStart,
      periodEnd,
      dueDate: periodStart,
      amount: fromCents(periodAmountCents),
      notes: `续租第 ${index + 1}/${target.duration} 月；本次已收款（历史合并账单拆分自 ${target.billNo}）`,
    }
  })
  const splitSum = splitBills.reduce((sum, bill) => sum + toCents(bill.amount), 0)
  const expectedTotalCents = periodAmountCents * target.duration
  if (splitSum !== expectedTotalCents) throw new Error(`renewalRecordId=${target.renewalRecordId} 拆分金额校验失败：${splitSum} !== ${expectedTotalCents}`)
  return { ...target, splitBills, expectedTotalCents }
})

console.log('=== 续租费合并账单拆分明细预览（按分校验，总额与原账单一致） ===')
for (const plan of plans) {
  console.log(`\n合同 ${plan.contractNo}（rentalId=${plan.rentalId}, renewalRecordId=${plan.renewalRecordId}），原账单 ${plan.billNo} 总额 ¥${fromCents(plan.expectedTotalCents)} -> 拆分为 ${plan.duration} 期：`)
  for (const bill of plan.splitBills) {
    console.log(`  ${bill.billNo}  ${bill.periodStart} ~ ${bill.periodEnd}  到期日 ${bill.dueDate}  金额 ¥${bill.amount}`)
  }
}

if (process.argv.includes('--apply')) {
  const lines = ['BEGIN TRANSACTION;']
  for (const plan of plans) {
    for (const bill of plan.splitBills) {
      lines.push(
        `INSERT INTO receivable_bills (userId, rentalId, renewalRecordId, billNo, periodStart, periodEnd, dueDate, billType, amount, paidAmount, status, notes) VALUES (${sqlString(userId)}, ${plan.rentalId}, ${plan.renewalRecordId}, ${sqlString(bill.billNo)}, ${sqlString(bill.periodStart)}, ${sqlString(bill.periodEnd)}, ${sqlString(bill.dueDate)}, '续租费', ${sqlString(bill.amount)}, ${sqlString(bill.amount)}, '已结清', ${sqlString(bill.notes)});`,
      )
      if (plan.paymentRecordId) {
        lines.push(
          `INSERT INTO payment_allocations (userId, rentalId, paymentRecordId, billId, amount) VALUES (${sqlString(userId)}, ${plan.rentalId}, ${plan.paymentRecordId}, (SELECT id FROM receivable_bills WHERE userId = ${sqlString(userId)} AND billNo = ${sqlString(bill.billNo)}), ${sqlString(bill.amount)});`,
        )
      }
    }
    // 原合并账单：作废（冲正），不物理删除，保留审计痕迹；若原有整笔分配记录则一并移除，避免与新拆分的多条分配重复计入。
    if (plan.allocId) lines.push(`DELETE FROM payment_allocations WHERE id = ${plan.allocId};`)
    lines.push(
      `UPDATE receivable_bills SET status = '已冲正', reversedAt = (unixepoch() * 1000), notes = COALESCE(notes, '') || '；历史合并账单已于数据修复中拆分为 ${plan.duration} 期（${plan.splitBills.map((b) => b.billNo).join('、')}）' WHERE id = ${plan.billId};`,
    )
  }
  lines.push('COMMIT;')
  const fs = await import('node:fs')
  const outPath = '/tmp/agent-browser/split-merged-renewal-bills.sql'
  fs.writeFileSync(outPath, lines.join('\n') + '\n')
  console.log(`\n已生成 SQL 文件：${outPath}`)
}
