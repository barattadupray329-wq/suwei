import { and, eq } from 'drizzle-orm'
import { sendAliyunSms } from '@/lib/aliyun-sms'
import { db } from '@/lib/db'
import { smsDeliveryLogs } from '@/lib/db/schema'
import { maskCustomerPhone } from '@/lib/customer-phone-auth'

export type BusinessSmsScene = 'rental-created' | 'due-reminder'
export type BusinessSmsTrigger = 'manual' | 'automatic' | 'create-flow'

type SendInput = {
  userId: string
  rentalId: number
  phone: string
  scene: BusinessSmsScene
  triggerType: BusinessSmsTrigger
  actorUserId?: string
  idempotencyKey: string
  params: Record<string, string>
}

export function businessSmsReadiness(scene: BusinessSmsScene) {
  const templateCode = scene === 'rental-created' ? process.env.ALIYUN_SMS_RENTAL_CREATED_TEMPLATE_CODE : process.env.ALIYUN_SMS_REMINDER_TEMPLATE_CODE
  return { configured: Boolean(process.env.ALIBABA_CLOUD_ACCESS_KEY_ID && process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET && process.env.ALIYUN_SMS_SIGN_NAME && templateCode), templateCode: templateCode ?? '' }
}

export async function sendBusinessSms(input: SendInput) {
  const readiness = businessSmsReadiness(input.scene)
  if (!readiness.configured) return { ok: false, message: input.scene === 'rental-created' ? '初始租赁短信模板尚未配置或审核通过' : '到期提醒短信模板尚未配置或审核通过', skipped: true }

  const [existing] = await db.select().from(smsDeliveryLogs).where(eq(smsDeliveryLogs.idempotencyKey, input.idempotencyKey)).limit(1)
  if (existing?.status === 'sent') return { ok: false, message: '该通知已成功发送，为避免重复扣费已跳过', duplicate: true }
  if (!existing) await db.insert(smsDeliveryLogs).values({ userId: input.userId, rentalId: input.rentalId, scene: input.scene, templateCode: readiness.templateCode, maskedPhone: maskCustomerPhone(input.phone), idempotencyKey: input.idempotencyKey, triggerType: input.triggerType, actorUserId: input.actorUserId })

  try {
    const response = await sendAliyunSms({ accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID!, accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET!, phone: input.phone, signName: process.env.ALIYUN_SMS_SIGN_NAME!, templateCode: readiness.templateCode, templateParams: input.params })
    const ok = response.code === 'OK'
    await db.update(smsDeliveryLogs).set({ status: ok ? 'sent' : 'failed', providerRequestId: response.requestId, providerCode: response.code, errorMessage: ok ? null : response.message?.slice(0, 200), sentAt: ok ? new Date() : null, updatedAt: new Date() }).where(and(eq(smsDeliveryLogs.idempotencyKey, input.idempotencyKey), eq(smsDeliveryLogs.userId, input.userId)))
    return { ok, message: ok ? '发送成功' : '短信服务商未接受本次发送', providerCode: response.code }
  } catch (error) {
    await db.update(smsDeliveryLogs).set({ status: 'failed', errorMessage: error instanceof Error ? error.message.slice(0, 200) : '短信请求失败', updatedAt: new Date() }).where(eq(smsDeliveryLogs.idempotencyKey, input.idempotencyKey))
    return { ok: false, message: '短信服务请求失败，请稍后重试' }
  }
}
