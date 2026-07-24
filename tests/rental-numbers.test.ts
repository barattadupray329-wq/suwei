import { describe, expect, it } from 'vitest'
import {
  buildRentalNumbers,
  buildRentalNumberPreview,
  normalizeRentalDate,
} from '../lib/rental-numbers'

describe('租赁编号生成', () => {
  it('为空数据库生成首个合同与设备编号', () => {
    expect(
      buildRentalNumbers('2026-07-23', [
        { deviceType: '台式机', quantity: 1 },
      ]),
    ).toEqual({
      contractNo: 'HT20260723-001',
      deviceCodes: ['PC20260723-001'],
    })
  })

  it('按同日已有编号递增并忽略异常编号', () => {
    const result = buildRentalNumbers(
      '2026-07-23',
      [{ deviceType: '笔记本', quantity: 1 }],
      ['HT20260723-002', 'HT20260723-错误', 'HT20260722-099'],
      ['NB20260723-003', '无效编号'],
    )
    expect(result).toEqual({
      contractNo: 'HT20260723-003',
      deviceCodes: ['NB20260723-004'],
    })
  })

  it('支持多设备类型和连续数量区间', () => {
    const result = buildRentalNumberPreview('2026-07-23', [
      { deviceType: '台式机', quantity: 3 },
      { deviceType: '台式机', quantity: 2 },
      { deviceType: '显示器', quantity: 2 },
    ])
    expect(result.deviceCodes).toEqual([
      'PC20260723-001～PC20260723-003',
      'PC20260723-004～PC20260723-005',
      'MON20260723-001～MON20260723-002',
    ])
  })

  it('会读取已有范围编号的结束序号', () => {
    const result = buildRentalNumbers(
      '2026-07-23',
      [{ deviceType: '台式机', quantity: 1 }],
      [],
      ['PC20260723-001～PC20260723-006'],
    )
    expect(result.deviceCodes).toEqual(['PC20260723-007'])
  })

  it('无效日期使用指定兜底日期', () => {
    expect(normalizeRentalDate('', '2026-07-23')).toBe('2026-07-23')
  })
})
