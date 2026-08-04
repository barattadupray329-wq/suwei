import { describe, expect, it } from 'vitest'
import { normalizeSmsCustomerName } from '../lib/sms-template-params'

describe('normalizeSmsCustomerName', () => {
  it('移除中文括号中的联系人备注', () => {
    expect(normalizeSmsCustomerName('谢群芳（谢毅）')).toBe('谢群芳')
    expect(normalizeSmsCustomerName('邓隆辉（曾用名：吴龙飞）')).toBe('邓隆辉')
  })

  it('保留姓名允许的中文、英文和间隔点', () => {
    expect(normalizeSmsCustomerName('阿依古丽·买买提')).toBe('阿依古丽·买买提')
    expect(normalizeSmsCustomerName(' Alice Zhang ')).toBe('AliceZhang')
  })

  it('空姓名使用安全称呼', () => {
    expect(normalizeSmsCustomerName('（未登记）')).toBe('客户')
  })
})
