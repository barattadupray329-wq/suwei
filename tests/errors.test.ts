import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppError, safeError, userErrorMessage } from '../lib/errors'

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

  it.each([
    ['Failed to fetch', '网络连接失败，请检查网络后重试', 503],
    ['Request timed out', '请求超时，请稍后重试', 504],
    ['Unauthorized', '登录状态已失效，请重新登录', 401],
    ['Permission denied', '没有执行此操作的权限', 403],
    ['Unique constraint failed', '该记录已存在，请勿重复提交', 409],
    ['Unexpected token in JSON', '服务器返回内容异常，请稍后重试', 502],
  ])('将英文技术错误转换为中文：%s', (raw, message, status) => {
    expect(safeError(new Error(raw))).toEqual({ message, status })
    expect(userErrorMessage(new Error(raw))).toBe(message)
  })

  it('保留安全的中文业务提示并拦截乱码和敏感信息', () => {
    expect(userErrorMessage(new Error('合同已关闭，不能继续收款'))).toBe('合同已关闭，不能继续收款')
    expect(userErrorMessage(new Error('保存失�，SQL token=secret'), '保存失败')).toBe('保存失败')
    expect(userErrorMessage(undefined, '请求失败')).toBe('请求失败')
  })
})
