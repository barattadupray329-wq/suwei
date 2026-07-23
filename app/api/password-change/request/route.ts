import { NextResponse } from 'next/server'
import { getPasswordChangeSubject, PasswordChangeError, requestPasswordChangeCode } from '@/lib/password-change'

export async function POST(request: Request) {
  try {
    const subject = await getPasswordChangeSubject()
    if (!subject) return NextResponse.json({ message: '请先登录' }, { status: 401 })
    const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const result = await requestPasswordChangeCode(subject, forwarded)
    return NextResponse.json({ message: '验证码已发送', ...result })
  } catch (error) {
    const known = error instanceof PasswordChangeError
    return NextResponse.json({ message: error instanceof Error ? error.message : '验证码发送失败', retryAfter: known ? error.retryAfter : undefined }, { status: known ? error.status : 500 })
  }
}
