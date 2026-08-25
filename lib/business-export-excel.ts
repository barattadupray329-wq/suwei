import * as XLSX from 'xlsx'

// 每个业务归档分类导出为 Excel 工作表中的一个 sheet，sheet 名需 <=31 字符且不含特殊符号
const SHEET_NAMES: Record<string, string> = {
  rentals: '合同',
  rentalItems: '设备',
  paymentRecords: '收款',
  receivableBills: '应收账单',
  accountLedger: '账户流水',
  renewalRecords: '续租',
  buyoutRecords: '买断',
  returnRecords: '退租',
  lossRecords: '损坏丢失',
  rentalEvents: '合同事件',
  organizationMembers: '员工',
  businessSettings: '门店设置',
}

/**
 * 将业务归档数据（与 /api/exports/business 返回的 data 字段同构）转换为 Excel workbook 的二进制内容。
 * 纯函数：只做数据到 workbook 的转换，不涉及网络请求或数据库访问。
 */
export function buildBusinessExportWorkbook(data: Record<string, unknown[]>): Buffer {
  const workbook = XLSX.utils.book_new()
  let hasSheet = false
  for (const [key, rows] of Object.entries(data)) {
    const sheetName = SHEET_NAMES[key] ?? key.slice(0, 31)
    const worksheet = XLSX.utils.json_to_sheet(flattenRows(rows))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    hasSheet = true
  }
  if (!hasSheet) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), '无数据')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

// xlsx 的 json_to_sheet 无法处理嵌套对象/数组字段，这里将其转为 JSON 字符串以避免丢数据
function flattenRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return { value: row }
    return Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) return [key, JSON.stringify(value)]
      return [key, value]
    }))
  })
}
