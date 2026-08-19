import 'server-only'

import { generateText } from 'ai'

export type XiaoweiChatTurn = { role: 'user' | 'assistant'; content: string }

const MODEL = 'openai/gpt-5.4-mini'

export async function replyNaturally(question: string, history: XiaoweiChatTurn[] = []) {
  const safeHistory = history.slice(-6).map((turn) => ({
    role: turn.role,
    content: turn.content.replace(/1\d{10}/g, '已隐藏手机号').slice(0, 300),
  }))

  const result = await generateText({
    model: MODEL,
    system: `你是“小维”，连维电脑租赁系统中的经营助理。请使用自然、简洁、有温度的中文交流。
你可以问候、致谢、解释概念、理解追问，也可以说明你能查询合同、设备、待收、逾期并协助发送提醒短信。
你不能声称已经查询或修改系统数据，除非系统提供了真实工具结果；不能编造客户、合同、金额、日期或发送状态。
当前第一阶段只允许执行短信与提醒操作，而且所有发送都必须由用户点击确认。其他写操作应说明暂未开放，并告诉用户可在对应业务页面办理。
回答控制在 120 个汉字以内。`,
    messages: [...safeHistory, { role: 'user' as const, content: question.slice(0, 300) }],
    maxOutputTokens: 180,
    temperature: 0.4,
    abortSignal: AbortSignal.timeout(8_000),
  })

  return result.text.trim()
}
