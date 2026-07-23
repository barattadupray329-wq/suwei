import { NextResponse } from 'next/server'
import { applyVerifiedPasswordChange, getPasswordChangeSubject, maskPasswordPhone, PasswordChangeError, requestPasswordChangeCode } from '@/lib/password-change'

const replyError = (error: unknown) => error instanceof PasswordChangeError
  ? NextResponse.json({ message: error.message, retryAfter: error.retryAfter }, { status: error.status })
  : NextResponse.json({ message: '操作失败，请稍后重试' }, { status: 500 })

export async function GET() {
  try {
    const subject = await getPasswordChangeSubject()
    if (!subject) return NextResponse.json({ message: '请先登录' }, { status: 401 })
    return NextResponse.json({ maskedPhone: maskPasswordPhone(subject.phone) })
  } catch (error) { return replyError(error) }
}

export async function POST(request: Request) {
  try {
    const subject = await getPasswordChangeSubject()
    if (!subject) return NextResponse.json({ message: '请先登录' }, { status: 401 })
    const body = await request.json().catch(() => ({})) as { action?: string; code?: string; newPassword?: string; confirmPassword?: string }
    if (body.action === 'request') {
      const forwarded = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      const result = await requestPasswordChangeCode(subject, forwarded)
      return NextResponse.json({ message: '验证码已发送', ...result })
    }
    if (body.action !== 'confirm') return NextResponse.json({ message: '无效操作' }, { status: 400 })
    if (body.newPassword !== body.confirmPassword) return NextResponse.json({ message: '两次输入的新密码不一致' }, { status: 400 })
    await applyVerifiedPasswordChange(subject, body.code ?? '', body.newPassword ?? '')
    return NextResponse.json({ message: '密码已修改，请重新登录' })
  } catch (error) { return replyError(error) }
}
