'use server'

import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import { and, eq, gt, inArray } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { auditLogs, rentals } from '@/lib/db/schema'
import { maskCustomerPhone, smsFailureMessage } from '@/lib/customer-phone-auth'

const MAX_BATCH = 20
const COOLDOWN_MS = 30 * 60 * 1000

export type SmsReminderResult = { rentalId: number; contractNo: string; ok: boolean; message: string }

export async function sendRentalReminders(rentalIds: number[]): Promise<SmsReminderResult[]> {
  const access = await getAccessContext('租赁操作')
  const ids = [...new Set(rentalIds.filter(Number.isInteger))]
  if (!ids.length) throw new Error('请先选择需要提醒的合同')
  if (ids.length > MAX_BATCH) throw new Error(`每次最多发送 ${MAX_BATCH} 条短信`)

  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET
  const signName = process.env.ALIYUN_SMS_SIGN_NAME
  const templateCode = process.env.ALIYUN_SMS_REMINDER_TEMPLATE_CODE
  if (!accessKeyId || !accessKeySecret || !signName) throw new Error('短信服务尚未配置完整')
  if (!templateCode) throw new Error('请先配置业务提醒短信模板编码')

  const contracts = await db.select({ id: rentals.id, contractNo: rentals.contractNo, customerName: rentals.customerName, customerPhone: rentals.customerPhone, endDate: rentals.endDate, totalRent: rentals.totalRent, paidAmount: rentals.paidAmount }).from(rentals).where(and(eq(rentals.userId, access.userId), inArray(rentals.id, ids)))
  const recent = await db.select({ resourceId: auditLogs.resourceId }).from(auditLogs).where(and(eq(auditLogs.userId, access.userId), eq(auditLogs.action, '发送业务短信'), gt(auditLogs.createdAt, new Date(Date.now() - COOLDOWN_MS))))
  const cooling = new Set(recent.map((item) => item.resourceId))
  const client = new Dysmsapi20170525(new $OpenApi.Config({ accessKeyId, accessKeySecret, endpoint: 'dysmsapi.aliyuncs.com', connectTimeout: 5000, readTimeout: 10000 }))
  const results: SmsReminderResult[] = []

  for (const contract of contracts) {
    if (cooling.has(String(contract.id))) {
      results.push({ rentalId: contract.id, contractNo: contract.contractNo, ok: false, message: '30 分钟内已发送，请稍后再试' })
      continue
    }
    const amount = Math.max(0, Number(contract.totalRent) - Number(contract.paidAmount)).toFixed(2)
    let ok = false
    let message = '发送失败'
    let providerRequestId: string | undefined
    try {
      const response = await client.sendSms(new $Dysmsapi20170525.SendSmsRequest({
        phoneNumbers: contract.customerPhone,
        signName,
        templateCode,
        templateParam: JSON.stringify({ customer: contract.customerName.slice(0, 20), contract: contract.contractNo.slice(0, 30), dueDate: contract.endDate, amount, url: 'tuzhuzu.cn/customer-login' }),
      }))
      providerRequestId = response.body?.requestId
      ok = response.body?.code === 'OK'
      message = ok ? '发送成功' : smsFailureMessage(response.body?.code)
    } catch {
      message = '短信服务请求失败'
    }
    await db.insert(auditLogs).values({
      userId: access.userId,
      actorUserId: access.actorId,
      actorName: access.actorName,
      action: '发送业务短信',
      resourceType: '租赁合同',
      resourceId: String(contract.id),
      summary: `${ok ? '成功' : '失败'}发送合同提醒至 ${maskCustomerPhone(contract.customerPhone)}`,
      metadata: { contractNo: contract.contractNo, phone: maskCustomerPhone(contract.customerPhone), result: ok ? 'success' : 'failed', providerRequestId },
    })
    results.push({ rentalId: contract.id, contractNo: contract.contractNo, ok, message })
  }
  return results
}
