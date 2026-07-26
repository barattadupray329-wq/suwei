import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { createCsv, csvResponse } from '@/lib/csv'
import { formatDeviceConfig } from '@/lib/device-config'
import { db } from '@/lib/db'
import { receivableBills, rentalItems, rentals } from '@/lib/db/schema'
import { projectedMonthlyRent, toCents } from '@/lib/rental-calculations'
import { safeError } from '@/lib/errors'

export async function GET() {
  try {
    const access = await getAccessContext('资金查看')
    const [contracts, items, bills] = await Promise.all([
      db.select().from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active'))).orderBy(asc(rentals.id)),
      db.select().from(rentalItems).where(eq(rentalItems.userId, access.userId)).orderBy(asc(rentalItems.rentalId), asc(rentalItems.id)),
      db.select().from(receivableBills).where(eq(receivableBills.userId, access.userId)).orderBy(asc(receivableBills.rentalId), asc(receivableBills.dueDate)),
    ])
    const contractMap = new Map(contracts.map((row) => [row.id, row]))
    const itemsByRental = new Map<number, typeof items>()
    for (const item of items) itemsByRental.set(item.rentalId, [...(itemsByRental.get(item.rentalId) ?? []), item])
    const billsByRental = new Map<number, typeof bills>()
    for (const bill of bills) billsByRental.set(bill.rentalId, [...(billsByRental.get(bill.rentalId) ?? []), bill])
    const headers = ['清单类型', '租赁开始时间', '非当天起租原因', '机器号', '电脑配置', '原始数量', '在租数量', '租赁人', '租赁期间', '每月租金', '合同总额', '累计已付', '合同待收', '正式账单待收', '预计续租', '展示合计待收', '租赁结束时间', '到期提醒', '备注', '租赁情况', '位置', '合同编号', '客户电话', '客户公司', '设备类型', '设备名称', '设备编号', '押金']
    const rows = items.flatMap((item) => {
      const rental = contractMap.get(item.rentalId)
      if (!rental) return []
      const active = Math.max(0, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity)
      const current = active > 0 && rental.status === '在租'
      const status = current ? '在租' : item.boughtOutQuantity >= item.quantity ? '买断' : '已退租'
      const remainingDays = Math.ceil((new Date(`${item.endDate}T00:00:00`).getTime() - Date.now()) / 86400000)
      const rentalBills = billsByRental.get(rental.id) ?? []
      const formalOutstandingCents = rentalBills.filter((bill) => bill.billType !== '押金').reduce((sum, bill) => sum + Math.max(0, toCents(bill.amount) - toCents(bill.paidAmount)), 0)
      const contractOutstandingCents = Math.max(0, toCents(rental.totalRent) - toCents(rental.paidAmount))
      const projectedCents = rental.endDate < new Date().toISOString().slice(0, 10) && ['在租', '逾期', '部分买断', '部分退租', '部分丢失'].includes(rental.status) ? toCents(projectedMonthlyRent(itemsByRental.get(rental.id) ?? [])) : 0
      return [[
        current ? '在租清单' : '历史清单', item.startDate, rental.startDateReason ?? '', item.deviceCode, formatDeviceConfig(item, true), item.quantity, active,
        rental.customerName, `${item.startDate} 至 ${item.endDate}`, Number(item.monthlyRent), Number(rental.totalRent), Number(rental.paidAmount), contractOutstandingCents / 100, formalOutstandingCents / 100, projectedCents / 100, Math.max(contractOutstandingCents, formalOutstandingCents) / 100 + projectedCents / 100, item.endDate,
        remainingDays < 0 ? `已过期${Math.abs(remainingDays)}天` : `剩余${remainingDays}天`, rental.notes, status, rental.customerAddress,
        rental.contractNo, rental.customerPhone, rental.customerCompany, item.deviceType, item.deviceName, item.deviceCode, Number(rental.deposit),
      ]]
    })
    const stamp = new Date().toISOString().slice(0, 10)
    return csvResponse(createCsv(headers, rows), `租机明细全表-${stamp}.csv`)
  } catch (error) {
    const safe = safeError(error, '导出失败，请稍后重试')
    return NextResponse.json({ error: safe.message }, { status: safe.status })
  }
}
