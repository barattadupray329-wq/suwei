"""字节安全地改写 renewRentalItems 的账单生成/结算段，让续租吸收已存在的逾期续租租金账单。

只替换从 `const periodAmount = ...` 到本 item 结算块结束（`paymentAllocations` 那段）为止的整块，
其余代码不动。用 UTF-8 字节精确替换，避免直接编辑大文件时中文字符被损坏。
"""

p = 'app/actions/rentals.ts'
src = open(p, encoding='utf-8').read()

# 定位待替换区间：从 periodAmount 声明起，到 item 内结算块（settlement.timing === 'now' 的 allocations）结束。
start_marker = "      const periodAmount = Number(fromCents(value.quantity * toCents(value.unitPrice)))"
# 结束锚点：结算块内 allocations 插入之后的闭合。用 rentalEvents 插入前的位置作为切点更稳。
end_marker = "      await tx.insert(rentalEvents).values({ userId, rentalId, itemId: renewedItemId,"

i = src.index(start_marker)
j = src.index(end_marker)
assert i != -1 and j != -1 and i < j, (i, j)

new_block = r'''      const periodAmount = Number(fromCents(value.quantity * toCents(value.unitPrice)))
      const periodAmountCents = toCents(periodAmount)
      // 先算出本次续租覆盖的每一期账期（半开区间 [periodStart, periodEnd)）。
      const renewalPeriods = [] as Array<{ periodStart: string; periodEnd: string; dueDate: string; amountCents: number }>
      for (let periodIndex = 0; periodIndex < value.duration; periodIndex += 1) {
        const periodStart = value.billingUnit === 'month'
          ? addCalendarMonths(renewalPeriodStart, periodIndex)
          : addCalendarDays(renewalPeriodStart, periodIndex)
        const periodEnd = value.billingUnit === 'month'
          ? addCalendarDays(addCalendarMonths(renewalPeriodStart, periodIndex + 1), -1)
          : periodStart
        const dueDate = value.billingUnit === 'month'
          ? addCalendarMonths(settlement.date, periodIndex)
          : addCalendarDays(settlement.date, periodIndex)
        renewalPeriods.push({ periodStart, periodEnd, dueDate, amountCents: periodAmountCents })
      }
      // 合同到期后系统会自动生成"逾期续租租金"账单，续租时若同月已有这类账单就吸收它（不再另开一条重复的"续租费"）。
      const existingOverdue = await tx.select().from(receivableBills).where(and(eq(receivableBills.rentalId, rentalId), eq(receivableBills.userId, userId)))
      const overdueForMatch = existingOverdue
        .filter((bill) => bill.billType.includes('续租租金'))
        .map((bill) => ({ id: bill.id, billType: bill.billType, periodStart: bill.periodStart, periodEnd: bill.periodEnd, paidAmountCents: toCents(bill.paidAmount) }))
      const periodPlans = matchRenewalPeriodsToOverdueBills(renewalPeriods.map((r) => ({ periodStart: r.periodStart, periodEnd: r.periodEnd, amountCents: r.amountCents })), overdueForMatch)
      const renewalBills: Array<{ id: number; amount: string; outstandingCents: number }> = []
      for (let periodIndex = 0; periodIndex < renewalPeriods.length; periodIndex += 1) {
        const period = renewalPeriods[periodIndex]
        const plan = periodPlans[periodIndex]
        const alreadyPaidCents = plan.absorbBillId !== null ? plan.paidAmountCents : 0
        // 本期还需再收的钱：应收 - 已收（吸收的逾期账单可能已收过一部分/全部）。
        const outstandingCents = Math.max(0, period.amountCents - alreadyPaidCents)
        const willPayNow = settlement.timing === 'now'
        const nextPaidCents = willPayNow ? period.amountCents : alreadyPaidCents
        const nextStatus = nextPaidCents >= period.amountCents ? '已结清' : nextPaidCents > 0 ? '部分收款' : '待收'
        const billNo = `RENEW-${rentalId}-${renewal.id}-${periodIndex + 1}`
        const notes = `${item.deviceName} ${value.quantity} 台续租第 ${periodIndex + 1}/${value.duration} ${value.billingUnit === 'month' ? '月' : '天'}；${willPayNow ? '本次已收款' : '约定以后收款'}${plan.absorbBillId !== null ? '（并入原逾期续租租金账单）' : ''}`
        if (plan.absorbBillId !== null) {
          // 吸收：把原逾期续租租金账单改写成本次续租费账单，保留其已收金额与收款关联。
          await tx.update(receivableBills).set({ renewalRecordId: renewal.id, periodStart: period.periodStart, periodEnd: period.periodEnd, dueDate: period.dueDate, billType: '续租费', amount: String(fromCents(period.amountCents)), paidAmount: String(fromCents(nextPaidCents)), status: nextStatus, notes, updatedAt: new Date() }).where(and(eq(receivableBills.id, plan.absorbBillId), eq(receivableBills.userId, userId)))
          renewalBills.push({ id: plan.absorbBillId, amount: String(fromCents(period.amountCents)), outstandingCents })
        } else {
          const [bill] = await tx.insert(receivableBills).values({
            userId,
            rentalId,
            renewalRecordId: renewal.id,
            billNo,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            dueDate: period.dueDate,
            billType: '续租费',
            amount: String(fromCents(period.amountCents)),
            paidAmount: willPayNow ? String(fromCents(period.amountCents)) : '0',
            status: willPayNow ? '已结清' : '待收',
            notes,
          }).returning({ id: receivableBills.id })
          renewalBills.push({ id: bill.id, amount: String(fromCents(period.amountCents)), outstandingCents })
        }
      }
      if (settlement.timing === 'now') {
        // 本次实际再收到的钱只针对"还欠部分"，避免对已收过的月份二次收款。
        const collectCents = renewalBills.reduce((sum, bill) => sum + bill.outstandingCents, 0)
        if (collectCents > 0) {
          const [payment] = await tx.insert(paymentRecords).values({ userId, rentalId, renewalRecordId: renewal.id, amount: String(fromCents(collectCents)), paymentDate: settlement.date, paymentMethod: settlement.method, feeType: '续租费', operatorName: access.actorName, notes: `${item.deviceName} ${value.quantity} 台续租即时收款` }).returning({ id: paymentRecords.id })
          const allocations = renewalBills.filter((bill) => bill.outstandingCents > 0).map((bill) => ({ userId, rentalId, paymentRecordId: payment.id, billId: bill.id, amount: String(fromCents(bill.outstandingCents)) }))
          if (allocations.length > 0) await tx.insert(paymentAllocations).values(allocations)
        }
      }
'''

src = src[:i] + new_block + src[j:]

# 第二处：合同 totalRent/paidAmount 不再用增量（rental.totalRent + addedRent），改为按账单/收款重算，
# 否则被吸收的逾期账单（本来已经计入合同应收/已收）会被再加一次，重新引入双计。
old_totals = """    const allItems = await tx.select().from(rentalItems).where(and(eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
    const active = allItems.filter((item) => availableQuantity(item) > 0)
    const quantity = active.reduce((sum, item) => sum + availableQuantity(item), 0)
    const monthlyRent = active.reduce((sum, item) => sum + Number(item.monthlyRent) * availableQuantity(item), 0)
    const totalRent = Number(rental.totalRent) + addedRent
    const paidAmount = Number(rental.paidAmount) + (settlement.timing === 'now' ? addedRent : 0)
    const endDate = active.map((item) => item.endDate ?? rental.endDate).sort().at(-1) ?? rental.endDate
    const status = rental.status === '逾期' ? '在租' : rental.status
    await tx.update(rentals).set({ quantity, monthlyRent: String(monthlyRent), totalRent: String(totalRent), paidAmount: String(paidAmount), endDate, status, paymentStatus: paidAmount >= totalRent ? '已结清' : paidAmount > 0 ? '部分收款' : '待收款', updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))"""

new_totals = """    const allItems = await tx.select().from(rentalItems).where(and(eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
    const active = allItems.filter((item) => availableQuantity(item) > 0)
    const quantity = active.reduce((sum, item) => sum + availableQuantity(item), 0)
    const monthlyRent = active.reduce((sum, item) => sum + Number(item.monthlyRent) * availableQuantity(item), 0)
    // 按账单与有效收款重算合同应收/已收，避免"吸收已存在账单"时再叠加 addedRent 造成双计。
    const finalBills = await tx.select().from(receivableBills).where(and(eq(receivableBills.rentalId, rentalId), eq(receivableBills.userId, userId)))
    const finalPayments = await tx.select().from(paymentRecords).where(and(eq(paymentRecords.rentalId, rentalId), eq(paymentRecords.userId, userId)))
    const finalReversals = await tx.select({ paymentRecordId: accountLedger.paymentRecordId }).from(accountLedger).where(and(eq(accountLedger.rentalId, rentalId), eq(accountLedger.userId, userId), eq(accountLedger.entryType, '收款冲正')))
    const activePayments = activePositivePayments(finalPayments, finalReversals)
    const totalCents = billsReceivableCents(finalBills)
    const paidCents = nonDepositPaymentCents(activePayments)
    const totalRent = Number(fromCents(totalCents))
    const paidAmount = Number(fromCents(paidCents))
    const endDate = active.map((item) => item.endDate ?? rental.endDate).sort().at(-1) ?? rental.endDate
    const status = rental.status === '逾期' ? '在租' : rental.status
    await tx.update(rentals).set({ quantity, monthlyRent: String(monthlyRent), totalRent: String(totalRent), paidAmount: String(paidAmount), endDate, status, paymentStatus: paymentStatusFromCents(totalCents, paidCents), updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))"""

assert src.count(old_totals) == 1, ('totals anchor count', src.count(old_totals))
src = src.replace(old_totals, new_totals)

open(p, 'w', encoding='utf-8').write(src)
print('patched ok; replacement chars:', src.count('\ufffd'))
