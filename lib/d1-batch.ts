// D1 单条 SQL 语句的绑定变量数量有上限，批量 INSERT 会把每一行的所有字段都展开成变量。
// 长租期合同（账单每行 9 个字段，12 期月租加押金共 13 行）与多设备合同
// （明细每行 28 个字段，4 台设备即 112 个变量）都会触发 "too many SQL variables"。
// 这里按行字段数动态计算每批行数，调用方再据此拆成多条 INSERT。
export const D1_MAX_VARIABLES_PER_STATEMENT = 90

/** 按单行字段数计算每批最多可插入的行数，保证单条语句的绑定变量不超过 D1 上限。 */
export function d1RowsPerChunk(fieldsPerRow: number) {
  if (!Number.isFinite(fieldsPerRow) || fieldsPerRow <= 0) return 1
  return Math.max(1, Math.floor(D1_MAX_VARIABLES_PER_STATEMENT / fieldsPerRow))
}

/** 把待插入的行按绑定变量上限切分成多个批次，保持原有顺序、不丢行也不重复。 */
export function chunkRowsForD1<T extends Record<string, unknown>>(rows: T[]): T[][] {
  if (!rows.length) return []
  const fieldsPerRow = Math.max(...rows.map((row) => Object.keys(row).length))
  const rowsPerChunk = d1RowsPerChunk(fieldsPerRow)
  const chunks: T[][] = []
  for (let offset = 0; offset < rows.length; offset += rowsPerChunk) {
    chunks.push(rows.slice(offset, offset + rowsPerChunk))
  }
  return chunks
}
