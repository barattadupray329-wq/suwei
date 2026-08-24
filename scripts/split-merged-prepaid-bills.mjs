// 一次性迁移脚本：把线上 7 笔合同中「起租预收」被合并成一张账单的情况，
// 按自然月拆成多张独立账单（与 app/actions/rentals.ts 里新版 buildPrepaidRentBill 的拆分规则一致）。
//
// 用法：
//   node scripts/split-merged-prepaid-bills.mjs           # 仅打印拆分明细，不写库
//   node scripts/split-merged-prepaid-bills.mjs --apply   # 打印明细后生成 .sql 文件到 /tmp
//
// 生成的 .sql 文件需要用 wrangler d1 execute --remote --file=... 手动执行到远程库。

const userId = 'c7e71d61-a737-4d42-a042-55d2edffa0fe'

// 已通过只读查询逐笔核对：均为「1 张起租预收账单覆盖 duration 个月」且已全额结清、
// 仅有 1 条 payment_allocations 记录 1:1 关联同一笔 payment_records。
const targets = [
  { rentalId: 1787302069443432, contractNo: 'HT20260603-001', duration: 3, startDate: '2026-06-03', endDate: '2026-09-02', billId: 1787302069443532, billNo: 'HT20260603-001-001', amount: '1440.00', allocId: 505, paymentRecordId: 1787302069443442 },
  { rentalId: 1787312960172481, contractNo: 'HT20260614-002', duration: 2, startDate: '2026-06-14', endDate: '2026-08-13', billId: 1787312960172581, billNo: 'HT20260614-002-001', amount: '500.00', allocId: 507, paymentRecordId: 1787312960172491 },
  { rentalId: 1787383676661491, contractNo: 'HT20260822-001', duration: 3, startDate: '2026-08-22', endDate: '2026-11-21', billId: 1787383676661591, billNo: 'HT20260822-001-001', amount: '240.00', allocId: 509, paymentRecordId: 1787383676661501 },
  { rentalId: 1787561603234666, contractNo: 'HT20260823-001', duration: 2, startDate: '2026-08-23', endDate: '2026-10-22', billId: 1787561603234766, billNo: 'HT20260823-001-001', amount: '340.00', allocId: 513, paymentRecordId: 1787561603234676 },
  { rentalId: 1787561678607192, contractNo: 'HT20260824-001', duration: 2, startDate: '2026-08-24', endDate: '2026-10-23', billId: 1787561678607292, billNo: 'HT20260824-001-001', amount: '180.00', allocId: 514, paymentRecordId: 1787561678607202 },
  { rentalId: 1787564674791849, contractNo: 'HT20260824-002', duration: 3, startDate: '2026-08-24', endDate: '2026-11-23', billId: 1787564674791949, billNo: 'HT20260824-002-001', amount: '900.00', allocId: 515, paymentRecordId: 1787564674791859 },
  { rentalId: 1787567190276873, contractNo: 'HT20260318-003', duration: 3, startDate: '2026-03-18', endDate: '2026-06-17', billId: 1787567190276973, billNo: 'HT20260318-003-001', amount: '2880.00', allocId: 518, paymentRecordId: 1787567190276883 },
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
  const totalCents = toCents(target.amount)
  const baseCents = Math.floor(totalCents / target.duration)
  const remainderCents = totalCents - baseCents * target.duration
  const splitBills = Array.from({ length: target.duration }, (_, index) => {
    const periodStart = addCalendarMonths(target.startDate, index)
    const periodEnd = index === target.duration - 1 ? target.endDate : addCalendarDays(addCalendarMonths(target.startDate, index + 1), -1)
    const cents = baseCents + (index === target.duration - 1 ? remainderCents : 0)
    return {
      billNo: `${target.billNo}R${index + 1}`,
      periodStart,
      periodEnd,
      dueDate: target.startDate,
      amount: fromCents(cents),
      notes: `起租 ${target.duration} 个月一次预收，第 ${index + 1}/${target.duration} 期（历史合并账单拆分自 ${target.billNo}）`,
    }
  })
  const splitSum = splitBills.reduce((sum, bill) => sum + toCents(bill.amount), 0)
  if (splitSum !== totalCents) throw new Error(`${target.contractNo} 拆分金额校验失败：${splitSum} !== ${totalCents}`)
  return { ...target, splitBills }
})

console.log('=== 拆分明细预览（按分校验，总额与原账单一致） ===')
for (const plan of plans) {
  console.log(`\n合同 ${plan.contractNo}（rentalId=${plan.rentalId}），原账单 ${plan.billNo} 金额 ¥${plan.amount} -> 拆分为 ${plan.duration} 期：`)
  for (const bill of plan.splitBills) {
    console.log(`  ${bill.billNo}  ${bill.periodStart} ~ ${bill.periodEnd}  到期日 ${bill.dueDate}  金额 ¥${bill.amount}`)
  }
}

if (process.argv.includes('--apply')) {
  const lines = ['BEGIN TRANSACTION;']
  for (const plan of plans) {
    for (const bill of plan.splitBills) {
      lines.push(
        `INSERT INTO receivable_bills (userId, rentalId, billNo, periodStart, periodEnd, dueDate, billType, amount, paidAmount, status, notes) VALUES (${sqlString(userId)}, ${plan.rentalId}, ${sqlString(bill.billNo)}, ${sqlString(bill.periodStart)}, ${sqlString(bill.periodEnd)}, ${sqlString(bill.dueDate)}, '起租预收', ${sqlString(bill.amount)}, ${sqlString(bill.amount)}, '已结清', ${sqlString(bill.notes)});`,
      )
      lines.push(
        `INSERT INTO payment_allocations (userId, rentalId, paymentRecordId, billId, amount) VALUES (${sqlString(userId)}, ${plan.rentalId}, ${plan.paymentRecordId}, (SELECT id FROM receivable_bills WHERE userId = ${sqlString(userId)} AND billNo = ${sqlString(bill.billNo)}), ${sqlString(bill.amount)});`,
      )
    }
    // 原合并账单：作废（冲正），不物理删除，保留审计痕迹；同时移除其原有的整笔分配，避免与新拆分的多条分配重复计入。
    lines.push(`DELETE FROM payment_allocations WHERE id = ${plan.allocId};`)
    lines.push(
      `UPDATE receivable_bills SET status = '已冲正', reversedAt = (unixepoch() * 1000), notes = COALESCE(notes, '') || '；历史合并账单已于数据修复中拆分为 ${plan.duration} 期（${plan.splitBills.map((b) => b.billNo).join('、')}）' WHERE id = ${plan.billId};`,
    )
  }
  lines.push('COMMIT;')
  const fs = await import('node:fs')
  const outPath = '/tmp/agent-browser/split-merged-prepaid-bills.sql'
  fs.writeFileSync(outPath, lines.join('\n') + '\n')
  console.log(`\n已生成 SQL 文件：${outPath}`)
}
