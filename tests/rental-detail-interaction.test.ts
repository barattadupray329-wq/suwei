import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const root = process.cwd()
const dashboard = readFileSync(join(root, 'components/dashboard.tsx'), 'utf8')
const records = readFileSync(join(root, 'components/rental-records.tsx'), 'utf8')

test('带 rental 参数关闭详情时使用整页替换恢复完整列表', () => {
  expect(dashboard).toMatch(
    /if \(searchParams\.has\("rental"\)\) \{\s*window\.location\.replace\("\/rentals"\);\s*return;/,
  )
  expect(dashboard).not.toMatch(
    /setDialog\(null\);\s*setSelected\(null\);\s*if \(searchParams\.has\("rental"\)\)/,
  )
})

test('租赁管理桌面合同列表双击打开详情', () => {
  expect(dashboard).toMatch(/onDoubleClick=\{\(\) => openDetail\(r\)\}/)
  expect(records).toMatch(/onDoubleClick=\{\(\) => openDetail\(row\.id\)\}/)
})
