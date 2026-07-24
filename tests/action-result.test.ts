import { afterEach, describe, expect, it, vi } from 'vitest'
import { toActionResult } from '../lib/action-result'

describe('Server Action 结果协议', () => {
  afterEach(() => vi.restoreAllMocks())

  it('成功时返回结构化结果', async () => {
    await expect(toActionResult('测试操作', async () => 42)).resolves.toEqual({ ok: true, data: 42 })
  })

  it('业务错误可安全透传给前端', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(toActionResult('测试操作', async () => {
      throw new Error('收款金额超过当前待收金额')
    })).resolves.toEqual({ ok: false, message: '收款金额超过当前待收金额' })
  })

  it('负责人触发器错误会转换为可操作的中文提示', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const cause = new Error('D1_ERROR: rental assignee must belong to the store')
    await expect(toActionResult('创建租赁合同', async () => {
      throw new Error('D1 batch failed', { cause })
    })).resolves.toEqual({ ok: false, message: '维护负责人不属于当前店铺或账号已停用，请重新选择负责人' })
  })

  it('技术错误不会泄露 SQL 内容', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = await toActionResult('测试操作', async () => {
      throw new Error('SQLITE_ERROR: select * from user where token=secret')
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).not.toContain('select *')
  })
})
