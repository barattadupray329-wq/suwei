import { describe, expect, it } from 'vitest'
import { DRAFT_IMPORT_COLUMNS, DRAFT_IMPORT_LIMIT, draftTemplateRows, parseDelimitedText, parseDraftImport, validateDraftRow } from '../lib/draft-import'

const TODAY = '2026-07-25'
const HEADER = DRAFT_IMPORT_COLUMNS.map((column) => (column.required ? `${column.label}*` : column.label)).join(',')

function csv(...rows: string[]) {
  return [HEADER, ...rows].join('\n')
}

describe('parseDelimitedText', () => {
  it('识别制表符分隔的表格粘贴内容', () => {
    expect(parseDelimitedText('a\tb\tc\n1\t2\t3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('保留双引号包裹字段内的逗号与换行', () => {
    expect(parseDelimitedText('名称,备注\n"戴尔, U2723","第一行\n第二行"')).toEqual([['名称', '备注'], ['戴尔, U2723', '第一行\n第二行']])
  })

  it('忽略 BOM 与空白行', () => {
    expect(parseDelimitedText('\uFEFFa,b\n\n,\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseDraftImport', () => {
  it('模板示例数据全部通过校验并自动推导到期日', () => {
    const text = csv(...draftTemplateRows(TODAY).map((row) => row.join(',')))
    const result = parseDraftImport(text, TODAY)
    expect(result.missing).toEqual([])
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((row) => row.errors.length === 0)).toBe(true)
    expect(result.rows[0].value?.endDate).toBe('2027-01-24')
    expect(result.rows[0].value?.items[0].totalRent).toBe(7800)
  })

  it('缺少必填列时给出列名提示而不解析数据', () => {
    const result = parseDraftImport('客户姓名,手机号\n张三,13800138000', TODAY)
    expect(result.missing).toContain('设备类型')
    expect(result.rows).toEqual([])
  })

  it('超过单次上限时截断并按合同标识合并', () => {
    const source = draftTemplateRows(TODAY)[0]
    const rows = Array.from({ length: DRAFT_IMPORT_LIMIT + 5 }, (_, index) => [
      `HT${index + 1}`, ...source.slice(1),
    ].join(','))
    const result = parseDraftImport(csv(...rows), TODAY)
    expect(result.truncated).toBe(true)
    expect(result.rows).toHaveLength(DRAFT_IMPORT_LIMIT)
  })

  it('相同合同标识的多行设备合并为一份合同', () => {
    const text = csv(...draftTemplateRows(TODAY).slice(0, 2).map((row) => row.join(',')))
    const result = parseDraftImport(text, TODAY)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].lines).toEqual([2, 3])
    expect(result.rows[0].value?.items).toHaveLength(2)
  })

  it('行号从表格第 2 行开始，便于业务人员定位', () => {
    const result = parseDraftImport(csv('张三,13800138000,,,台式机,,,,1,月租,1,' + TODAY + ',,100,0,'), TODAY)
    expect(result.rows[0].line).toBe(2)
  })
})

describe('validateDraftRow', () => {
  const base = {
    customerName: '张三', customerPhone: '13800138000', deviceType: '台式机',
    quantity: '2', billingType: '月租', duration: '3', startDate: TODAY, monthlyRent: '200',
  }

  it('容错处理手机号与金额中的分隔符', () => {
    const row = validateDraftRow({ ...base, customerPhone: '138-0013-8000', monthlyRent: '1,200 元' }, 2, TODAY)
    expect(row.errors).toEqual([])
    expect(row.value?.customerPhone).toBe('13800138000')
    expect(row.value?.items[0].monthlyRent).toBe(1200)
  })

  it('兼容斜杠与中文日期写法', () => {
    expect(validateDraftRow({ ...base, startDate: '2026/7/25' }, 2, TODAY).value?.startDate).toBe(TODAY)
    expect(validateDraftRow({ ...base, startDate: '2026年7月25日' }, 2, TODAY).value?.startDate).toBe(TODAY)
  })

  it('日租按天推导到期日', () => {
    const row = validateDraftRow({ ...base, billingType: '日租', duration: '15' }, 2, TODAY)
    expect(row.value?.billingType).toBe('daily')
    expect(row.value?.endDate).toBe('2026-08-08')
  })

  it('非当天起租必须填写补录原因', () => {
    expect(validateDraftRow({ ...base, startDate: '2026-06-01' }, 2, TODAY).errors.join()).toContain('必须填写补录原因')
    expect(validateDraftRow({ ...base, startDate: '2026-06-01', startDateReason: '旧数据转移' }, 2, TODAY).errors).toEqual([])
  })

  it('补录原因填了但不在可选值内时，提示填错而不是没填', () => {
    const errors = validateDraftRow({ ...base, startDate: '2026-06-01', startDateReason: '客户补签合同' }, 2, TODAY).errors.join()
    expect(errors).toContain('客户补签合同')
    expect(errors).not.toContain('必须填写')
  })

  it('显示器必须同时提供品牌与屏幕尺寸', () => {
    expect(validateDraftRow({ ...base, deviceType: '显示器' }, 2, TODAY).errors.join()).toContain('显示器')
    expect(validateDraftRow({ ...base, deviceType: '显示器', deviceName: '戴尔 U2723QE', screenSize: '27 英寸' }, 2, TODAY).errors).toEqual([])
  })

  it('台式机自动补齐设备名称', () => {
    expect(validateDraftRow(base, 2, TODAY).value?.items[0].deviceName).toBe('台式机')
  })

  it('拒绝非法数量、时长、单价与手机号', () => {
    expect(validateDraftRow({ ...base, quantity: '0' }, 2, TODAY).errors.join()).toContain('数量')
    expect(validateDraftRow({ ...base, duration: '3.5' }, 2, TODAY).errors.join()).toContain('租赁时长')
    expect(validateDraftRow({ ...base, monthlyRent: '0' }, 2, TODAY).errors.join()).toContain('租金单价')
    expect(validateDraftRow({ ...base, customerPhone: '13800' }, 2, TODAY).errors.join()).toContain('手机号')
    expect(validateDraftRow({ ...base, deviceType: '服务器' }, 2, TODAY).errors.join()).toContain('设备类型')
  })

  it('押金留空按 0 处理，负数被拒绝', () => {
    expect(validateDraftRow(base, 2, TODAY).value?.deposit).toBe(0)
    expect(validateDraftRow({ ...base, deposit: '-1' }, 2, TODAY).errors.join()).toContain('押金')
  })

  it('校验失败时不生成可落库数据', () => {
    expect(validateDraftRow({ ...base, monthlyRent: 'abc' }, 2, TODAY).value).toBeNull()
  })
})
