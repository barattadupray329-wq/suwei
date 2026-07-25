import { describe, expect, it } from 'vitest'
import { chunkRowsForD1, d1RowsPerChunk, D1_MAX_VARIABLES_PER_STATEMENT } from '../lib/d1-batch'

// 该测试锁定一个已修复的生产缺陷：
// D1 单条 SQL 语句的绑定变量数量有上限（约 100 个），批量 INSERT 会把每行的所有字段展开成变量。
// 修复前有两类合同必然创建失败，且同时影响正式录入与草稿转正式两条路径：
//   1. 长租期合同：账单每行 9 个字段，12 期月租 + 押金 = 13 行 = 117 个变量
//   2. 多设备合同：租赁明细每行 28 个字段，4 台设备 = 112 个变量
// 修复方式是按行字段数动态拆成多条 INSERT，并保留在同一个 batch 中以维持原子性。

const D1_HARD_LIMIT = 100
const FIELDS_PER_BILL = 9
const FIELDS_PER_ITEM = 28

const makeRows = (count: number, fieldsPerRow: number) =>
  Array.from({ length: count }, (_, index) =>
    Object.fromEntries([['rowKey', `R-${index + 1}`], ...Array.from({ length: fieldsPerRow - 1 }, (_, i) => [`field${i}`, i])]),
  )

describe('D1 批量插入分块', () => {
  it('任意行数与字段数下，每条语句的绑定变量都不超过 D1 上限', () => {
    // 单行字段数本身就超过预算时无法再拆（只能单行一条语句），因此仅覆盖可拆分的字段规模。
    for (const fieldsPerRow of [1, 9, 28, 45, 89, 90]) {
      for (const count of [1, 2, 4, 13, 25, 37, 200]) {
        for (const chunk of chunkRowsForD1(makeRows(count, fieldsPerRow))) {
          expect(chunk.length * fieldsPerRow).toBeLessThanOrEqual(D1_MAX_VARIABLES_PER_STATEMENT)
          expect(chunk.length * fieldsPerRow).toBeLessThan(D1_HARD_LIMIT)
        }
      }
    }
  })

  it('12 期月租加押金的账单会被拆分，而非触发变量上限', () => {
    const chunks = chunkRowsForD1(makeRows(13, FIELDS_PER_BILL))
    expect(13 * FIELDS_PER_BILL).toBeGreaterThan(D1_HARD_LIMIT) // 修复前的失败条件
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('4 台设备的租赁明细会被拆分，而非触发变量上限', () => {
    const chunks = chunkRowsForD1(makeRows(4, FIELDS_PER_ITEM))
    expect(4 * FIELDS_PER_ITEM).toBeGreaterThan(D1_HARD_LIMIT) // 修复前的失败条件
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('分块不丢行、不重复，且保持原有顺序', () => {
    const rows = makeRows(37, FIELDS_PER_ITEM)
    const flattened = chunkRowsForD1(rows).flat()
    expect(flattened).toHaveLength(rows.length)
    expect(flattened.map((row) => row.rowKey)).toEqual(rows.map((row) => row.rowKey))
    expect(new Set(flattened.map((row) => row.rowKey)).size).toBe(rows.length)
  })

  it('没有待插入数据时不产生任何语句', () => {
    expect(chunkRowsForD1([])).toHaveLength(0)
  })

  it('数据量未超上限时仍只用一条语句', () => {
    expect(chunkRowsForD1(makeRows(3, FIELDS_PER_ITEM))).toHaveLength(1)
    expect(chunkRowsForD1(makeRows(10, FIELDS_PER_BILL))).toHaveLength(1)
  })

  it('单行字段数超过上限时至少保留一行，避免死循环', () => {
    expect(d1RowsPerChunk(200)).toBe(1)
    expect(d1RowsPerChunk(0)).toBe(1)
    expect(chunkRowsForD1(makeRows(3, 120))).toHaveLength(3)
  })
})
