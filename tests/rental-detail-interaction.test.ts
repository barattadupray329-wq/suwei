import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const root = process.cwd()
const dashboard = readFileSync(join(root, 'components/dashboard.tsx'), 'utf8')
const records = readFileSync(join(root, 'components/rental-records.tsx'), 'utf8')

test('带 rental 参数关闭详情时返回并保留原查询条件', () => {
  expect(dashboard).toMatch(/params\.delete\("rental"\)/)
  expect(dashboard).toMatch(/params\.delete\("new"\)/)
  expect(dashboard).toMatch(/if \(searchParams\.has\("rental"\)\) \{\s*returnToList\(\);\s*return;/)
})

test('详情入口保留筛选参数，续租和退租成功后返回列表', () => {
  expect(records).toMatch(/const params = listParams\(\)\s*params\.set\('rental', String\(id\)\)/)
  expect(records).toMatch(/href=\{detailHref\(row\.id\)\}/)
  expect(dashboard).toMatch(/续租已办理", \{ returnToList: true \}/)
  expect(dashboard).toMatch(/退租已登记", \{ returnToList: true \}/)
})

test('新增租赁保留来源筛选，关闭或成功后返回来源页面', () => {
  expect(records).toMatch(/const params = listParams\(\)\s*params\.set\('new', '1'\)/)
  expect(records).toMatch(/href=\{newRentalHref\(\)\}/)
  expect(dashboard).toMatch(/onClose=\{\(\) => searchParams\.has\("new"\) \? returnToList\(\) : setDialog\(null\)\}/)
  expect(dashboard).toMatch(/if \(searchParams\.has\("new"\)\) returnToList\(\)/)
})

test('业务弹窗只能通过右上角关闭按钮关闭', () => {
  expect(dashboard).not.toMatch(/if \(e\.currentTarget === e\.target\) onClose\(\)/)
  expect(dashboard).toMatch(/aria-label="关闭"\s*onClick=\{onClose\}/)
})

test('租赁管理桌面合同列表双击打开详情', () => {
  expect(dashboard).toMatch(/onDoubleClick=\{\(\) => openDetail\(r\)\}/)
  expect(records).toMatch(/onDoubleClick=\{\(\) => openDetail\(row\.id\)\}/)
})
