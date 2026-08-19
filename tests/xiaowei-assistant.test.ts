import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const action = readFileSync(resolve(process.cwd(), 'app/actions/xiaowei.ts'), 'utf8')
const shell = readFileSync(resolve(process.cwd(), 'components/app-shell.tsx'), 'utf8')
const assistant = readFileSync(resolve(process.cwd(), 'components/xiaowei-assistant.tsx'), 'utf8')
const catalog = readFileSync(resolve(process.cwd(), 'lib/xiaowei-question-catalog.ts'), 'utf8')

describe('小维经营助手', () => {
  it('每次提问都通过服务端权限上下文隔离门店和客户经理数据', () => {
    expect(action).toContain("getAccessContext('租赁操作')")
    expect(action).toMatch(/eq\(rentals\.assigneeUserId,\s*access\.actorId\)/)
    expect(action).toMatch(/eq\(rentals\.userId,\s*access\.userId\)/)
  })

  it('覆盖经营查询、到期、待收和风控能力', () => {
    expect(action).toContain('租赁概况')
    expect(action).toContain('月度实际租金收款排行')
    expect(action).toContain('月度退租排行')
    expect(action).toContain('维修业务概况')
    expect(action).toContain('待收与逾期分析')
    expect(action).toContain('经营风控扫描')
    expect(action).toContain('到期提醒')
    expect(action).toContain('在租${hw[2]}排行')
  })

  it('识别问题中的客户姓名、公司或手机号并查询在租情况', () => {
    expect(action).toContain('mentionedCustomers')
    expect(action).toContain('q.includes(name)')
    expect(action).toContain('当前有 ${activeRentals.length} 份在租合同，共 ${quantity} 台设备')
    expect(action).toContain('请确认具体客户')
  })

  it('优先区分客户、负责人和设备排行，避免答非所问', () => {
    expect(action.indexOf('if(asksPerson)')).toBeLessThan(action.lastIndexOf("if(/逾期|待收"))
    expect(action).toContain("客户${asksAmount?'合同额':'在租数量'}排行")
    expect(action).toContain("负责人${asksAmount?'合同额':'在租数量'}排行")
    expect(action).toContain('请确认评价口径')
    expect(action).toContain('哪个客户在租数量最多？')
    expect(action).toContain('电脑配置需要按硬件比较')
  })

  it('提供覆盖全部业务域的可搜索问题目录', () => {
    for (const category of ['合同经营', '客户查询', '设备分析', '硬件配置', '收款财务', '退租续租', '维修换机', '丢失买断', '人员业绩', '经营风控', '综合分析']) {
      expect(catalog).toContain(category)
    }
    expect(catalog).toContain('易先生还有几台在租？')
    expect(catalog).toContain('哪个月实际租金收款最多？')
    expect(catalog).toContain('哪个月退租最多？')
    expect(assistant).toContain('查看全部问题')
    expect(assistant).toContain('catalogSearch')
    expect(assistant).toContain('activeCategory')
  })

  it('支持多轮澄清、全局学习和回答纠正', () => {
    expect(action).toContain('xiaoweiIntentLearnings')
    expect(action).toContain('normalizedQuestion')
    expect(action).toContain('needsClarification:true')
    expect(action).toContain('confirmationCount')
    expect(action).toContain('correctionCount')
    expect(assistant).toContain('answer.suggestions')
    expect(assistant).toContain('答非所问，重新选择')
    expect(assistant).toContain('submit(currentQuestion, suggestion)')
    expect(assistant).toContain('setMessages')
    expect(assistant).toContain('setQuestion(\'\')')
  })

  it('支持客户代词追问并保持客户级数据范围', () => {
    expect(action).toContain('XiaoweiContext')
    expect(action).toContain('context?.customerPhone===rental.customerPhone')
    expect(action).toContain('/他|她|该客户|这个客户|这位客户|其|他的|她的/')
    expect(action).toContain('customerIds.has(b.rentalId)')
    expect(action).toContain("`${name}的待收与逾期`")
    expect(assistant).toContain('answer?.context')
    expect(assistant).toContain('clarification, conversationContext')
  })

  it('按客户和对话语义确认发送到期或逾期提醒短信', () => {
    expect(action).toContain("type:'send-reminders'")
    expect(action).toContain("scene=asksOverdue||(!dueRentals.length&&overdueRentals.length)?'overdue':'due'")
    expect(action).toContain("sceneLabel=scene==='overdue'?'逾期催收':'到期提醒'")
    expect(action).toContain("pendingAction:{type:'send-reminders',scene")
    expect(assistant).toContain('sendRentalReminders(action.rentalIds, action.scene)')
    expect(assistant).toContain('answer.pendingAction.label')
    expect(assistant).toContain('发送成功 ${sent} 条，已发送过 ${skipped} 条，发送失败 ${failed} 条')
    expect(assistant).toContain('此前已发送成功，本次未重复发送')
  })

  it('只向有租赁权限的店铺主管和客户经理显示入口', () => {
    expect(shell).toContain("role !== 'super_admin' && can('租赁操作')")
    expect(shell).toContain('<XiaoweiAssistant/>')
    expect(assistant).toContain('精确查询，不猜数字')
    expect(assistant).toContain('小维只分析系统已有数据')
  })
})
