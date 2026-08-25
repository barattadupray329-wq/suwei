import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { loadBusinessExportData, parseBusinessExportQuery } from '@/app/api/exports/business/route'
import { buildBusinessExportWorkbook } from '@/lib/business-export-excel'
import { safeError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const access = await getAccessContext('系统设置')
    if (access.role === 'employee') return NextResponse.json({ error: '仅管理员可以导出完整数据' }, { status: 403 })
    const { from, to } = parseBusinessExportQuery(request.nextUrl.searchParams)
    const { data } = await loadBusinessExportData(access.userId, from, to)
    const workbook = buildBusinessExportWorkbook(data)
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    const body = new Uint8Array(workbook).buffer as ArrayBuffer
    return new Response(body, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="suwei-business-${stamp}.xlsx"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    const safe = safeError(error, '导出失败，请稍后重试')
    return NextResponse.json({ error: safe.message }, { status: safe.status })
  }
}
