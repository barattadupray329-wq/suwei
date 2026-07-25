import { rentalEndDate } from './rental-calculations'
import { normalizeDeviceName, shanghaiToday, START_DATE_REASONS, validateRentalItemFields } from './rental-form-rules'

export const DRAFT_IMPORT_LIMIT = 200
export const DEVICE_TYPES = ['台式机', '笔记本', '显示器', '一体机', '其他'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

type ColumnKey = 'contractKey' | 'customerCompany' | 'customerName' | 'customerPhone' | 'customerAddress' | 'deviceType' | 'deviceName' | 'deviceConfig' | 'screenSize' | 'quantity' | 'billingType' | 'duration' | 'startDate' | 'startDateReason' | 'monthlyRent' | 'deposit' | 'notes'
type Column = { key: ColumnKey; label: string; required: boolean; hint: string; aliases?: string[] }

export const DRAFT_IMPORT_COLUMNS: Column[] = [
  { key: 'contractKey', label: '合同标识', required: true, hint: '同一合同的多台设备填写相同标识，如 HT001', aliases: ['合同分组', '合同编号'] },
  { key: 'customerName', label: '客户姓名', required: true, hint: '至少 2 个字；同合同仅首行必填' },
  { key: 'customerPhone', label: '手机号', required: true, hint: '11 位手机号；同合同仅首行必填' },
  { key: 'customerCompany', label: '客户单位', required: false, hint: '同合同仅首行填写' },
  { key: 'customerAddress', label: '客户地址', required: false, hint: '同合同仅首行填写' },
  { key: 'deviceType', label: '设备类型', required: true, hint: DEVICE_TYPES.join(' / ') },
  { key: 'deviceName', label: '设备名称', required: false, hint: '台式机可留空，其他类型必填' },
  { key: 'screenSize', label: '屏幕尺寸', required: false, hint: '显示器必填，如 24 英寸' },
  { key: 'deviceConfig', label: '设备配置', required: false, hint: 'CPU、内存、硬盘等' },
  { key: 'quantity', label: '数量', required: true, hint: '不少于 1 的整数' },
  { key: 'billingType', label: '计费方式', required: true, hint: '月租 / 日租；同合同仅首行必填', aliases: ['计费类型'] },
  { key: 'duration', label: '租赁时长', required: true, hint: '同合同仅首行必填', aliases: ['租赁时间', '时长'] },
  { key: 'startDate', label: '起租日期', required: true, hint: 'YYYY-MM-DD；同合同仅首行必填' },
  { key: 'startDateReason', label: '补录原因', required: false, hint: `非当天起租必填：${START_DATE_REASONS.join(' / ')}`, aliases: ['起租原因'] },
  { key: 'monthlyRent', label: '租金单价', required: true, hint: '每台每期单价，大于 0' },
  { key: 'deposit', label: '押金', required: false, hint: '合同总押金；同合同仅首行填写' },
  { key: 'notes', label: '备注', required: false, hint: '同合同仅首行填写' },
]

const COLUMN_BY_LABEL = new Map<string, ColumnKey>()
for (const column of DRAFT_IMPORT_COLUMNS) { COLUMN_BY_LABEL.set(column.label, column.key); for (const alias of column.aliases ?? []) COLUMN_BY_LABEL.set(alias, column.key) }
export type DraftRawRow = Partial<Record<ColumnKey, string>>
export type DraftValue = { customerCompany: string; customerName: string; customerPhone: string; customerAddress: string; billingType: 'monthly' | 'daily'; duration: number; startDate: string; startDateReason?: (typeof START_DATE_REASONS)[number]; endDate: string; deposit: number; notes: string; items: Array<{ deviceType: DeviceType; deviceName: string; deviceConfig: string; screenSize: string; quantity: number; monthlyRent: number; totalRent: number }> }
export type DraftImportRow = { line: number; lines: number[]; contractKey: string; raw: DraftRawRow; errors: string[]; value: DraftValue | null }

export function parseDelimitedText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!normalized.trim()) return []
  const delimiter = pickDelimiter(normalized)
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (quoted) { if (char === '"') { if (normalized[index + 1] === '"') { cell += '"'; index += 1 } else quoted = false } else cell += char; continue }
    if (char === '"') { quoted = true; continue }
    if (char === delimiter) { row.push(cell); cell = ''; continue }
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    cell += char
  }
  row.push(cell); rows.push(row)
  return rows.filter((cells) => cells.some((value) => value.trim()))
}
function pickDelimiter(text: string) { const first = text.split('\n')[0] ?? ''; const choices = [['\t', first.split('\t').length], [',', first.split(',').length], [';', first.split(';').length]] as const; const best = choices.reduce((a, b) => b[1] > a[1] ? b : a); return best[1] > 1 ? best[0] : ',' }
export function mapDraftTable(table: string[][]) {
  if (!table.length) return { rows: [] as DraftRawRow[], missing: DRAFT_IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.label) }
  const header = table[0].map((cell) => cell.trim().replace(/[*＊\s]/g, ''))
  const keys = header.map((label) => COLUMN_BY_LABEL.get(label) ?? null)
  // 兼容旧模板：没有合同标识时，每一行自动成为独立合同。
  const missing = DRAFT_IMPORT_COLUMNS.filter((c) => c.required && c.key !== 'contractKey' && !keys.includes(c.key)).map((c) => c.label)
  return { missing, rows: table.slice(1).map((cells, rowIndex) => { const row: DraftRawRow = {}; keys.forEach((key, i) => { if (key) row[key] = (cells[i] ?? '').trim() }); if (!row.contractKey) row.contractKey = `LEGACY-${rowIndex + 2}`; return row }) }
}
const toNumber = (value?: string) => { const text = (value ?? '').replace(/[,，\s元台个]/g, ''); if (!text) return null; const n = Number(text); return Number.isFinite(n) ? n : null }
const normalizeDate = (value?: string) => { const text = (value ?? '').trim().replace(/[/.年月]/g, '-').replace(/日$/, ''); const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '' }
const normalizeBillingType = (value?: string): 'monthly' | 'daily' | null => ['月租', '月', 'monthly', 'month'].includes((value ?? '').trim()) ? 'monthly' : ['日租', '日', '天', 'daily', 'day'].includes((value ?? '').trim()) ? 'daily' : null

function validateGroup(rows: Array<{ raw: DraftRawRow; line: number }>, today: string): DraftImportRow {
  const first = rows[0].raw; const errors: string[] = []; const lines = rows.map((r) => r.line); const contractKey = first.contractKey!.trim()
  const customerName = (first.customerName ?? '').trim(); if (customerName.length < 2) errors.push('客户姓名至少 2 个字')
  const customerPhone = (first.customerPhone ?? '').replace(/\D/g, ''); if (!/^1\d{10}$/.test(customerPhone)) errors.push('手机号需为 11 位数字')
  const billingType = normalizeBillingType(first.billingType); if (!billingType) errors.push('计费方式需为月租或日租')
  const duration = toNumber(first.duration); if (duration === null || !Number.isInteger(duration) || duration < 1 || duration > 3650) errors.push('租赁时长需为 1-3650 的整数')
  const startDate = normalizeDate(first.startDate); if (!startDate) errors.push('起租日期格式需为 YYYY-MM-DD')
  let startDateReason: (typeof START_DATE_REASONS)[number] | undefined; const reason = (first.startDateReason ?? '').trim()
  if (startDate && startDate !== today) { if (!reason) errors.push(`非当天起租必须填写补录原因（${START_DATE_REASONS.join(' / ')}）`); else if (!START_DATE_REASONS.includes(reason as never)) errors.push(`补录原因需为 ${START_DATE_REASONS.join(' / ')}，当前为“${reason}”`); else startDateReason = reason as (typeof START_DATE_REASONS)[number] }
  const deposit = (first.deposit ?? '').trim() ? toNumber(first.deposit) : 0; if (deposit === null || deposit < 0) errors.push('押金不能为负数')
  const items: DraftValue['items'] = []
  for (const { raw, line } of rows) {
    const type = (raw.deviceType ?? '').trim() as DeviceType; const quantity = toNumber(raw.quantity); const rent = toNumber(raw.monthlyRent); const name = normalizeDeviceName(type, raw.deviceName); const screenSize = (raw.screenSize ?? '').trim()
    if (!DEVICE_TYPES.includes(type)) errors.push(`第 ${line} 行设备类型无效`)
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1) errors.push(`第 ${line} 行数量需为正整数`)
    if (rent === null || rent <= 0) errors.push(`第 ${line} 行租金单价必须大于 0`)
    if (DEVICE_TYPES.includes(type) && quantity && rent && rent > 0) { const fieldError = validateRentalItemFields({ deviceType: type, deviceName: name, screenSize, quantity, monthlyRent: rent }); if (fieldError) errors.push(`第 ${line} 行：${fieldError}`) }
    if (DEVICE_TYPES.includes(type) && quantity && rent && duration) items.push({ deviceType: type, deviceName: name, deviceConfig: (raw.deviceConfig ?? '').trim(), screenSize, quantity, monthlyRent: rent, totalRent: Math.round(quantity * rent * duration * 100) / 100 })
  }
  const value = errors.length ? null : { customerCompany: (first.customerCompany ?? '').trim(), customerName, customerPhone, customerAddress: (first.customerAddress ?? '').trim(), billingType: billingType!, duration: duration!, startDate, startDateReason, endDate: rentalEndDate(startDate, duration!, billingType!), deposit: deposit!, notes: (first.notes ?? '').trim(), items }
  return { line: lines[0], lines, contractKey, raw: first, errors: [...new Set(errors)], value }
}

export function validateDraftRow(raw: DraftRawRow, line: number, today = shanghaiToday()) {
  return validateGroup([{ raw: { ...raw, contractKey: raw.contractKey || `ROW-${line}` }, line }], today)
}

export function parseDraftImport(text: string, today = shanghaiToday()) {
  const { rows, missing } = mapDraftTable(parseDelimitedText(text)); if (missing.length) return { missing, rows: [] as DraftImportRow[], truncated: false, sourceRowCount: 0 }
  const limited = rows.slice(0, DRAFT_IMPORT_LIMIT); const groups = new Map<string, Array<{ raw: DraftRawRow; line: number }>>()
  limited.forEach((raw, index) => { const key = (raw.contractKey ?? '').trim() || `ROW-${index + 2}`; groups.set(key, [...(groups.get(key) ?? []), { raw, line: index + 2 }]) })
  return { missing: [] as string[], truncated: rows.length > DRAFT_IMPORT_LIMIT, sourceRowCount: rows.length, rows: [...groups.values()].map((group) => validateGroup(group, today)) }
}
export function draftTemplateRows(today = shanghaiToday()) { return [
  ['HT001', '张三', '13800138000', '示例科技有限公司', '福州市鼓楼区示例路 1 号', '台式机', '', '', 'i5/16G/512G', '5', '月租', '6', today, '', '260', '1000', '同一合同可填写多行设备'],
  ['HT001', '', '', '', '', '显示器', '戴尔 U2723QE', '27 英寸', '4K', '5', '', '', '', '', '95', '', ''],
  ['HT002', '李四', '13900139000', '', '', '笔记本', 'ThinkPad T14', '', 'i7/32G/1T', '2', '月租', '3', today, '', '320', '500', ''],
] }
