import type { Metadata } from 'next'
import { LegalDocument, LegalSection } from '@/components/legal-document'
import { getPublicBusiness } from '@/lib/public-business'

export const metadata: Metadata = { title: '客户服务用户协议', description: '速维电脑租赁客户服务用户协议' }

export default async function TermsPage() {
  const business = await getPublicBusiness()
  return <LegalDocument title="客户服务用户协议" updated="2026年7月24日" business={business}>
    <p>本协议规范客户使用租赁信息查询、短信验证及售后联系功能。具体租赁价格、押金、设备、赔偿和违约责任以双方确认的租赁合同及有效补充约定为准。</p>
    <LegalSection title="一、账号与身份验证"><p>您应使用合同记载的本人手机号获取验证码，并妥善保管验证码。不得查询、传播或利用他人的租赁信息。发现手机号被冒用时应立即联系经营者。</p></LegalSection>
    <LegalSection title="二、服务内容"><p>客户服务中心用于查看本人合同、设备、租期、账单与负责人信息。页面数据如与双方签署的有效合同不一致，应及时联系负责人核验，不应自行修改或伪造记录。</p></LegalSection>
    <LegalSection title="三、短信通知"><p>起租通知、到期前提醒、收退租沟通属于履行合同所需的事务性通知，不用于发送无关商业营销。您变更手机号后应及时通知负责人，否则可能无法收到提醒。</p><p>短信提醒是便利服务，不替代合同约定的付款、续租或退租义务；未收到短信不当然免除已明确约定的义务。</p></LegalSection>
    <LegalSection title="四、重要合同条款提示"><p><strong className="text-foreground">押金扣除、设备损坏或丢失赔偿、逾期费用、自动续租、违约责任和争议解决属于可能对您有重大影响的条款。</strong>经营者应在签约前以显著方式提示并按要求说明，您应充分阅读后再确认。</p><p>后台默认条款不当然视为双方已协商一致；具体责任应根据实际损失、过错、法律规定及双方有效约定确定。</p></LegalSection>
    <LegalSection title="五、禁止行为"><p>不得攻击系统、批量请求验证码、绕过身份验证、非法获取个人信息，或将租赁设备用于违法活动。我们可为保护系统和客户暂停异常访问，并依法保留证据。</p></LegalSection>
    <LegalSection title="六、责任与争议"><p>因不可抗力、通信运营商或第三方基础服务故障导致的短时不可用，我们将合理修复。经营者不得通过本协议排除依法应承担的责任或不合理加重客户责任。</p><p>争议应优先协商；协商不成的，按法律规定由有管辖权的人民法院处理。具体合同已有合法有效约定的，从其约定。</p></LegalSection>
    <LegalSection title="七、联系我们"><p>咨询、投诉、个人信息申请及账号注销，可通过页面底部经营者联系方式提交。我们将在核验身份后依法处理。</p></LegalSection>
  </LegalDocument>
}
