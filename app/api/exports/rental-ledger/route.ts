import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { formatDeviceConfig } from '@/lib/device-config'
import { db } from '@/lib/db'
import { rentalItems, rentals } from '@/lib/db/schema'
import { safeError } from '@/lib/errors'

export const runtime = 'nodejs'

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value)
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export async function GET() {
  try {
    const access = await getAccessContext('资金查看')
    const rentalFilter = [eq(rentals.userId, access.userId)]
    if (access.role === 'employee') rentalFilter.push(eq(rentals.assignedEmployeeId, access.actorId))
    const contracts = await db.select().from(rentals).where(and(...rentalFilter)).orderBy(asc(rentals.id))
    const contractMap = new Map(contracts.map((row) => [row.id, row]))
    const items = await db.select().from(rentalItems).where(eq(rentalItems.userId, access.userId)).orderBy(asc(rentalItems.rentalId), asc(rentalItems.id))
    const headers = ['合同编号', '客户公司', '联系人', '客户电话', '设备名称', '设备类型', '设备编号', '电脑配置', '原始数量', '在租数量', '开始日期', '结束日期', '每月租金', '已收租金', '合同状态', '地址', '备注']
    const rows = items.flatMap((item) => {
      const rental = contractMap.get(item.rentalId)
      if (!rental) return []
      const active = Math.max(0, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity)
      return [[rental.contractNo, rental.customerCompany, rental.customerName, rental.customerPhone, item.deviceName, item.deviceType, item.deviceCode, formatDeviceConfig(item, true), item.quantity, active, item.startDate, item.endDate, item.monthlyRent, rental.paidAmount, rental.status, rental.customerAddress, rental.notes]]
    })
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`
    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`租机明细全表-${stamp}.csv`)}`, 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const safe = safeError(error, '导出失败，请稍后重试')
    return NextResponse.json({ error: safe.message }, { status: safe.status })
  }
}
