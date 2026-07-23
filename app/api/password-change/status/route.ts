import { NextResponse } from 'next/server'
import { getPasswordChangeSubject, maskPasswordPhone, PasswordChangeError } from '@/lib/password-change'

export async function GET() {
  try {
    const subject = await getPasswordChangeSubject()
    if (!subject) return NextResponse.json({ message: '请先登录' }, { status: 401 })
    return NextResponse.json({ maskedPhone: maskPasswordPhone(subject.phone) })
  } catch (error) {
    const status = error instanceof PasswordChangeError ? error.status : 500
    return NextResponse.json({ message: error instanceof Error ? error.message : '无法读取账号信息' }, { status })
  }
}
