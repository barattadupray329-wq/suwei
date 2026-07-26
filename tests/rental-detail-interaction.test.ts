import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const root = process.cwd()
const dashboard = readFileSync(join(root, 'components/dashboard.tsx'), 'utf8')
const records = readFileSync(join(root, 'components/rental-records.tsx'), 'utf8')

test('关闭同页详情时只移除 rental 参数并保留列表上下文', () => {
  expect(dashboard).toMatch(/const next = new URLSearchParams\(searchParams\.toString\(\)\)/)
  expect(dashboard).toMatch(/next\.delete\("rental"\)/)
  expect(dashboard).toMatch(/router\.replace\(`\/rentals\$\{next\.size/)
  expect(dashboard).not.toMatch(/window\.location\.replace\("\/rentals"\)/)
  expect(records).toMatch(/params\.set\('rental', String\(id\)\)/)
})

test('租赁管理桌面合同列表双击打开详情', () => {
  expect(dashboard).toMatch(/onDoubleClick=\{\(\) => openDetail\(r\)\}/)
  expect(records).toMatch(/onDoubleClick=\{\(\) => openDetail\(row\.id\)\}/)
})
