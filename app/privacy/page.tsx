import type { Metadata } from 'next'
import { LegalDocument, LegalSection } from '@/components/legal-document'
import { getPublicBusiness } from '@/lib/public-business'

export const metadata: Metadata = { title: '隐私政策', description: '速维电脑租赁客户服务隐私政策' }

export default async function PrivacyPage() {
  const business = await getPublicBusiness()
  return <LegalDocument title="隐私政策" updated="2026年7月24日" business={business}>
    <p>本政策适用于客户通过本网站或小程序查询本人租赁信息、接收租赁事务通知及联系售后服务。我们遵循合法、正当、必要和诚信原则处理个人信息。</p>
    <LegalSection title="一、我们收集的信息"><p>为订立和履行租赁合同，我们可能处理姓名、签约手机号、联系地址、合同编号、租赁设备、租期、应收与实收记录及服务记录。</p><p>登录客户服务中心时，我们处理手机号、短信验证码校验结果、登录时间、IP 与必要安全日志。验证码不用于营销。</p></LegalSection>
    <LegalSection title="二、处理目的与方式"><p>上述信息仅用于身份核验、展示本人合同和设备、履行交付与售后、发送起租及到期提醒、处理续租或退租、财务核对、争议处理和保障系统安全。</p><p>系统按签约手机号隔离客户数据，不会通过短信发送身份证号码、完整设备配置或其他不必要的敏感信息。</p></LegalSection>
    <LegalSection title="三、第三方服务"><p>我们可能向阿里云短信服务提供签约手机号、短信模板编码及模板所需的最少合同变量，用于发送验证码和租赁事务通知。阿里云仅作为技术服务提供方处理这些信息。</p><p>未来接入信用或反欺诈服务前，我们将另行说明数据范围并在法律要求的情况下取得单独同意，不会以本政策概括授权替代。</p></LegalSection>
    <LegalSection title="四、保存期限与安全"><p>合同与交易记录按照履约、会计、税务及争议处理所需的最短期限保存；验证码短期有效，安全日志在实现安全目的所需期限内保存。超过必要期限后删除或匿名化，法律另有规定除外。</p><p>我们采取访问控制、权限隔离、传输保护、审计日志与手机号脱敏等措施，但互联网服务无法承诺绝对安全。</p></LegalSection>
    <LegalSection title="五、您的权利"><p>您可以联系经营者申请查阅、更正、复制或删除个人信息，撤回可撤回的同意，或提出账号注销申请。依法必须保留的合同、交易或争议记录可能无法立即删除，我们会说明原因。</p><p>若您认为信息展示错误，请勿将验证码提供给他人，并通过本页联系电话提交核验申请。</p></LegalSection>
    <LegalSection title="六、未成年人"><p>本服务原则上面向具备相应民事行为能力的租赁客户。未成年人订立租赁合同应由监护人依法参与。</p></LegalSection>
    <LegalSection title="七、政策更新"><p>发生处理目的、信息范围或第三方服务重大变化时，我们会更新本政策并依法重新取得必要同意。</p></LegalSection>
  </LegalDocument>
}
