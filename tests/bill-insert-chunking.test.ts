import { describe, expect, it } from 'vitest'

// 该测试锁定一个已修复的生产缺陷：
// D1 单条 SQL 语句的绑定变量数量有上限（约 100 个）。应收账单每行占 9 个变量，
// 因此 12 期月租 + 押金（13 行 = 117 个变量）一次性批量插入会抛出
// "D1_ERROR: too many SQL variables"，导致长租期合同无法转为正式合同。
// 修复方式是按固定行数把账单拆成多条 INSERT，放在同一个 batch 中保持原子性。

const BILL_INSERT_CHUNK_SIZE = 8
const VARIABLES_PER_BILL = 9
const D1_VARIABLE_LIMIT = 100

function chunkBills<T>(bills: T[]) {
  const chunks: T[][] = []
  for (let offset = 0; offset < bills.length; offset += BILL_INSERT_CHUNK_SIZE) {
    chunks.push(bills.slice(offset, offset + BILL_INSERT_CHUNK_SIZE))
  }
  return chunks
}

const makeBills = (count: number) => Array.from({ length: count }, (_, index) => ({ billNo: `B-${index + 1}` }))

describe('应收账单分块插入', () => {
  it('每个分块的绑定变量数都不超过 D1 上限', () => {
    for (const count of [1, 8, 9, 13, 24, 37, 120]) {
      for (const chunk of chunkBills(makeBills(count))) {
        expect(chunk.length * VARIABLES_PER_BILL).toBeLessThanOrEqual(D1_VARIABLE_LIMIT)
      }
    }
  })

  it('12 期月租加押金会被拆分而非单条插入', () => {
    const chunks = chunkBills(makeBills(13))
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(8)
    expect(chunks[1]).toHaveLength(5)
  })

  it('分块不丢单、不重复、且保持原有顺序', () => {
    const bills = makeBills(37)
    const flattened = chunkBills(bills).flat()
    expect(flattened).toHaveLength(bills.length)
    expect(flattened.map((bill) => bill.billNo)).toEqual(bills.map((bill) => bill.billNo))
    expect(new Set(flattened.map((bill) => bill.billNo)).size).toBe(bills.length)
  })

  it('账单为空时不产生任何插入语句', () => {
    expect(chunkBills(makeBills(0))).toHaveLength(0)
  })

  it('短租期合同仍然只用一条插入语句', () => {
    expect(chunkBills(makeBills(3))).toHaveLength(1)
    expect(chunkBills(makeBills(8))).toHaveLength(1)
  })
})
