import { NextResponse } from 'next/server'
import { applyVerifiedPasswordChange, getPasswordChangeSubject, PasswordChangeError } from '@/lib/password-change'

export async function POST(request: Request) {
  try {
    const subject = await getPasswordChangeSubject()
    if (!subject) return NextResponse.json({ message: '请先登录' }, { status: 401 })
    const body = await request.json() as { code?: string; newPassword?: string; confirmPassword?: string }
    if (!body.newPassword || body.newPassword !== body.confirmPassword) return NextResponse.json({ message: '两次输入的新密码不一致' }, { status: 400 })
    await applyVerifiedPasswordChange(subject, body.code ?? '', body.newPassword)
    return NextResponse.json({ message: '密码已修改，请重新登录' })
  } catch (error) {
    const known = error instanceof PasswordChangeError
    return NextResponse.json({ message: error instanceof Error ? error.message : '密码修改失败', retryAfter: known ? error.retryAfter : undefined }, { status: known ? error.status : 500 })
  }
}
