import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppError, safeError } from '../lib/errors'

describe('安全错误输出', () => {
  it('映射登录和权限错误', () => {
    expect(safeError(new Error('未登录'))).toEqual({ message: '未登录', status: 401 })
    expect(safeError(new Error('账号已停用'))).toEqual({ message: '账号已停用', status: 403 })
    expect(safeError(new Error('没有该模块的操作权限'))).toEqual({ message: '没有该模块的操作权限', status: 403 })
  })

  it('保留明确的业务错误', () => {
    expect(safeError(new AppError('日期格式无效', 400))).toEqual({ message: '日期格式无效', status: 400 })
  })

  it('安全展示 Zod 校验错误', () => {
    const result = z.string().min(3, '至少输入 3 个字').safeParse('a')
    if (result.success) throw new Error('测试数据应校验失败')
    expect(safeError(result.error)).toEqual({ message: '至少输入 3 个字', status: 400 })
  })

  it('不泄露数据库和内部错误', () => {
    const result = safeError(new Error('password authentication failed for postgresql://user:secret@host/db'), '读取失败')
    expect(result).toEqual({ message: '读取失败', status: 500 })
    expect(result.message).not.toContain('postgresql')
  })
})
