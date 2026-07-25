import { rentalEndDate } from './rental-calculations'
import { normalizeDeviceName, shanghaiToday, START_DATE_REASONS, validateRentalItemFields } from './rental-form-rules'

export const DRAFT_IMPORT_LIMIT = 200

export const DEVICE_TYPES = ['台式机', '笔记本', '显示器', '一体机', '其他'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

type ColumnKey =
  | 'customerCompany' | 'customerName' | 'customerPhone' | 'customerAddress'
  | 'deviceType' | 'deviceName' | 'deviceConfig' | 'screenSize' | 'quantity'
  | 'billingType' | 'duration' | 'startDate' | 'startDateReason'
  | 'monthlyRent' | 'deposit' | 'notes'

type Column = { key: ColumnKey; label: string; required: boolean; hint: string; aliases?: string[] }

export const DRAFT_IMPORT_COLUMNS: Column[] = [
  { key: 'customerName', label: '客户姓名', required: true, hint: '至少 2 个字' },
  { key: 'customerPhone', label: '手机号', required: true, hint: '11 位手机号' },
  { key: 'customerCompany', label: '客户单位', required: false, hint: '可留空' },
  { key: 'customerAddress', label: '客户地址', required: false, hint: '可留空' },
  { key: 'deviceType', label: '设备类型', required: true, hint: DEVICE_TYPES.join(' / ') },
  { key: 'deviceName', label: '设备名称', required: false, hint: '台式机可留空，其他类型必填' },
  { key: 'screenSize', label: '屏幕尺寸', required: false, hint: '显示器必填，如 24 英寸' },
  { key: 'deviceConfig', label: '设备配置', required: false, hint: '可留空' },
  { key: 'quantity', label: '数量', required: true, hint: '不少于 1 的整数' },
  { key: 'billingType', label: '计费方式', required: true, hint: '月租 / 日租', aliases: ['计费类型'] },
  { key: 'duration', label: '租赁时长', required: true, hint: '月租填月数，日租填天数', aliases: ['租赁时间', '时长'] },
  { key: 'startDate', label: '起租日期', required: true, hint: 'YYYY-MM-DD' },
  { key: 'startDateReason', label: '补录原因', required: false, hint: `非当天起租必填：${START_DATE_REASONS.join(' / ')}`, aliases: ['起租原因'] },
  { key: 'monthlyRent', label: '租金单价', required: true, hint: '大于 0，按台按期计价' },
  { key: 'deposit', label: '押金', required: false, hint: '留空按 0 处理' },
  { key: 'notes', label: '备注', required: false, hint: '可留空' },
]

const COLUMN_BY_LABEL = new Map<string, ColumnKey>()
for (const column of DRAFT_IMPORT_COLUMNS) {
  COLUMN_BY_LABEL.set(column.label, column.key)
  for (const alias of column.aliases ?? []) COLUMN_BY_LABEL.set(alias, column.key)
}

export type DraftRawRow = Partial<Record<ColumnKey, string>>

export type DraftImportRow = {
  line: number
  raw: DraftRawRow
  errors: string[]
  value: {
    customerCompany: string
    customerName: string
    customerPhone: string
    customerAddress: string
    billingType: 'monthly' | 'daily'
    duration: number
    startDate: string
    startDateReason?: (typeof START_DATE_REASONS)[number]
    endDate: string
    deposit: number
    notes: string
    items: Array<{
      deviceType: DeviceType
      deviceName: string
      deviceConfig: string
      screenSize: string
      quantity: number
      monthlyRent: number
      totalRent: number
    }>
  } | null
}

/** 解析 CSV / TSV 文本（支持双引号包裹、字段内换行与逗号）。表格软件粘贴默认使用制表符。 */
export function parseDelimitedText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!normalized.trim()) return []
  const delimiter = pickDelimiter(normalized)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (quoted) {
      if (char === '"') {
        if (normalized[index + 1] === '"') { cell += '"'; index += 1 } else quoted = false
      } else cell += char
      continue
    }
    if (char === '"') { quoted = true; continue }
    if (char === delimiter) { row.push(cell); cell = ''; continue }
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    cell += char
  }
  row.push(cell)
  rows.push(row)
  return rows.filter((cells) => cells.some((value) => value.trim()))
}

function pickDelimiter(text: string) {
  const firstLine = text.split('\n')[0] ?? ''
  const counts = [
    ['\t', firstLine.split('\t').length],
    [',', firstLine.split(',').length],
    [';', firstLine.split(';').length],
  ] as const
  const best = counts.reduce((winner, current) => (current[1] > winner[1] ? current : winner))
  return best[1] > 1 ? best[0] : ','
}

/** 依据表头把二维表映射成字段对象；缺少表头时返回明确提示。 */
export function mapDraftTable(table: string[][]) {
  if (!table.length) return { rows: [] as DraftRawRow[], missing: DRAFT_IMPORT_COLUMNS.filter((column) => column.required).map((column) => column.label) }
  const header = table[0].map((cell) => cell.trim().replace(/[*＊\s]/g, ''))
  const keys = header.map((label) => COLUMN_BY_LABEL.get(label) ?? null)
  const missing = DRAFT_IMPORT_COLUMNS.filter((column) => column.required && !keys.includes(column.key)).map((column) => column.label)
  const rows = table.slice(1).map((cells) => {
    const row: DraftRawRow = {}
    keys.forEach((key, index) => {
      if (key) row[key] = (cells[index] ?? '').trim()
    })
    return row
  })
  return { rows, missing }
}

function toNumber(value: string | undefined) {
  const text = (value ?? '').replace(/[,，\s元台个]/g, '')
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

function normalizeDate(value: string | undefined) {
  const text = (value ?? '').trim().replace(/[/.年月]/g, '-').replace(/日$/, '')
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return ''
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function normalizeBillingType(value: string | undefined): 'monthly' | 'daily' | null {
  const text = (value ?? '').trim()
  if (['月租', '月', 'monthly', 'month'].includes(text)) return 'monthly'
  if (['日租', '日', '天', 'daily', 'day'].includes(text)) return 'daily'
  return null
}

/** 校验单行并生成可直接落库的草稿数据；错误信息面向业务人员。 */
export function validateDraftRow(raw: DraftRawRow, line: number, today = shanghaiToday()): DraftImportRow {
  const errors: string[] = []
  const customerName = (raw.customerName ?? '').trim()
  if (customerName.length < 2) errors.push('客户姓名至少 2 个字')
  const customerPhone = (raw.customerPhone ?? '').replace(/\D/g, '')
  if (!/^1\d{10}$/.test(customerPhone)) errors.push('手机号需为 11 位数字')

  const deviceType = (raw.deviceType ?? '').trim() as DeviceType
  if (!DEVICE_TYPES.includes(deviceType)) errors.push(`设备类型需为 ${DEVICE_TYPES.join(' / ')}`)

  const quantity = toNumber(raw.quantity)
  if (quantity === null || !Number.isInteger(quantity) || quantity < 1) errors.push('数量需为不小于 1 的整数')

  const billingType = normalizeBillingType(raw.billingType)
  if (!billingType) errors.push('计费方式需为月租或日租')

  const duration = toNumber(raw.duration)
  if (duration === null || !Number.isInteger(duration) || duration < 1 || duration > 3650) errors.push('租赁时长需为 1-3650 的整数')

  const startDate = normalizeDate(raw.startDate)
  if (!startDate) errors.push('起租日期格式需为 YYYY-MM-DD')

  const reasonText = (raw.startDateReason ?? '').trim()
  let startDateReason: (typeof START_DATE_REASONS)[number] | undefined
  if (startDate && startDate !== today) {
    if (!START_DATE_REASONS.includes(reasonText as (typeof START_DATE_REASONS)[number])) errors.push(`非当天起租必须填写补录原因（${START_DATE_REASONS.join(' / ')}）`)
    else startDateReason = reasonText as (typeof START_DATE_REASONS)[number]
  }

  const monthlyRent = toNumber(raw.monthlyRent)
  if (monthlyRent === null || monthlyRent <= 0) errors.push('租金单价必须大于 0')

  const depositText = (raw.deposit ?? '').trim()
  const deposit = depositText ? toNumber(depositText) : 0
  if (deposit === null || deposit < 0) errors.push('押金不能为负数')

  const deviceName = normalizeDeviceName(deviceType, raw.deviceName)
  const screenSize = (raw.screenSize ?? '').trim()
  if (DEVICE_TYPES.includes(deviceType) && quantity !== null && monthlyRent !== null && monthlyRent > 0) {
    const fieldError = validateRentalItemFields({ deviceType, deviceName, screenSize, quantity, monthlyRent })
    if (fieldError) errors.push(fieldError)
  }

  if (errors.length) return { line, raw, errors, value: null }

  const safeQuantity = quantity as number
  const safeDuration = duration as number
  const safeRent = monthlyRent as number
  return {
    line,
    raw,
    errors,
    value: {
      customerCompany: (raw.customerCompany ?? '').trim(),
      customerName,
      customerPhone,
      customerAddress: (raw.customerAddress ?? '').trim(),
      billingType: billingType as 'monthly' | 'daily',
      duration: safeDuration,
      startDate,
      startDateReason,
      endDate: rentalEndDate(startDate, safeDuration, billingType as 'monthly' | 'daily'),
      deposit: deposit as number,
      notes: (raw.notes ?? '').trim(),
      items: [{
        deviceType,
        deviceName,
        deviceConfig: (raw.deviceConfig ?? '').trim(),
        screenSize,
        quantity: safeQuantity,
        monthlyRent: safeRent,
        totalRent: Math.round(safeQuantity * safeRent * safeDuration * 100) / 100,
      }],
    },
  }
}

export function parseDraftImport(text: string, today = shanghaiToday()) {
  const table = parseDelimitedText(text)
  const { rows, missing } = mapDraftTable(table)
  if (missing.length) return { missing, rows: [] as DraftImportRow[], truncated: false }
  const limited = rows.slice(0, DRAFT_IMPORT_LIMIT)
  return {
    missing: [] as string[],
    truncated: rows.length > DRAFT_IMPORT_LIMIT,
    rows: limited.map((row, index) => validateDraftRow(row, index + 2, today)),
  }
}

export function draftTemplateRows(today = shanghaiToday()) {
  return [
    ['张三', '13800138000', '示例科技有限公司', '福州市鼓楼区示例路 1 号', '台式机', '', '', 'i5/16G/512G', '5', '月租', '6', today, '', '260', '1000', '批量导入示例，可整行删除'],
    ['李四', '13900139000', '', '', '显示器', '戴尔 U2723QE', '27 英寸', '', '2', '月租', '3', today, '', '95', '0', ''],
  ]
}
