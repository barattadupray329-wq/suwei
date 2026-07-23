'use server'

import { headers } from 'next/headers'
import {
  applyVerifiedPasswordChange,
  getPasswordChangeSubject,
  maskPasswordPhone,
  PasswordChangeError,
  requestPasswordChangeCode,
} from '@/lib/password-change'

export async function getPasswordChangeStatus() {
  const subject = await getPasswordChangeSubject()
  return subject ? { maskedPhone: maskPasswordPhone(subject.phone) } : null
}

export async function sendPasswordChangeCode() {
  const subject = await getPasswordChangeSubject()
  if (!subject) throw new Error('登录状态已失效，请重新登录')
  const requestHeaders = await headers()
  const ip = requestHeaders.get('cf-connecting-ip') ?? requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  try {
    return await requestPasswordChangeCode(subject, ip)
  } catch (error) {
    if (error instanceof PasswordChangeError) throw new Error(error.message)
    throw error
  }
}

export async function confirmPasswordChange(input: { code: string; newPassword: string; confirmPassword: string }) {
  const subject = await getPasswordChangeSubject()
  if (!subject) throw new Error('登录状态已失效，请重新登录')
  if (input.newPassword !== input.confirmPassword) throw new Error('两次输入的新密码不一致')
  try {
    await applyVerifiedPasswordChange(subject, input.code, input.newPassword)
    return { success: true }
  } catch (error) {
    if (error instanceof PasswordChangeError) throw new Error(error.message)
    throw error
  }
}
