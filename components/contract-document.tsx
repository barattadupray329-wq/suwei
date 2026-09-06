'use client'

import { useState, useTransition } from 'react'
import { Printer, Save } from 'lucide-react'
import { toast } from 'sonner'
import { saveContractSnapshot } from '@/app/actions/business'
import { formatDeviceConfig } from '@/lib/device-config'
import { userErrorMessage } from '@/lib/errors'

const money=(n:string|number)=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(Number(n))
export const DEFAULT_CONTRACT_TERMS=`一、设备所有权与用途
1. 租赁设备所有权始终归出租方所有，承租方在租期内依法享有占有、使用的权利，不因占有而取得所有权；承租方应按约定用途合理使用，不得用于任何违法违规活动，因违法使用产生的一切后果由承租方自行承担。

二、转借、转租与处置
2. 依据《中华人民共和国民法典》有关融资租赁、租赁合同的规定，未经出租方事先书面同意，承租方不得将租赁设备转借、转租给他人，也不得变卖、抵押、质押或以其他方式处置；如确需交由他人使用，承租方应提前书面告知出租方并取得同意，且仍就设备的使用与安全承担全部责任。承租方擅自处置设备的，出租方有权解除合同并要求赔偿损失。

三、使用地点与场地变更
3. 承租方应在约定的地点及使用范围内使用设备；设备需离开约定使用范围或更换使用场地的，应提前告知出租方，以便设备管理与后续维护。未经告知擅自转移设备导致出租方无法联系或设备灭失的，由承租方承担相应责任。

四、维护与损坏责任划分
4. 租赁设备在正常使用过程中出现的自然故障、非人为质量问题，由出租方负责维修或更换，费用由出租方承担。
5. 因承租方人为损坏、保管不善、违规操作、擅自拆改，或因盗抢、火灾、水浸、雷击等意外及不可抗力造成设备损坏、灭失的，由承租方按设备保值价或实际维修费用承担赔偿责任。
6. 设备保值价：双方可就租赁设备约定保值价人民币______元（此栏可暂不填写；未填写的，一旦发生设备损坏、灭失需要赔偿或经由诉讼主张权利时，以出租方提供的设备购置凭证、市场同类设备价格并扣除合理折旧后核定的价值为准，承租方对该核定方式予以认可）。

五、租金与押金
7. 承租方应按合同约定的金额与周期按时支付租金；押金在租期结束、设备验收无误并结清全部费用后无息退还，出租方可从押金中扣除承租方应付未付的租金、维修费及赔偿款。
8. 承租方逾期支付租金的，出租方有权按约定收取逾期违约金；经催告后在合理期限内仍不支付的，出租方有权依法解除合同、提前收回设备，并要求承租方赔偿由此造成的损失。

六、租期、续租与退租
9. 租期届满需继续租用的，承租方应提前办理续租手续；退租时应将设备及全部配件完好归还，并配合出租方验收，验收产生的损坏或缺失费用由责任方承担。

七、法律适用与争议解决
10. 本合同的订立、效力、解释、履行及争议解决均适用中华人民共和国法律。
11. 本合同在履行过程中发生争议的，双方应友好协商解决；协商不成的，任何一方均可向合同签订地（福建省龙岩市）有管辖权的人民法院提起诉讼。
12. 本合同未尽事宜，双方可另行签订补充协议，补充协议与本合同具有同等法律效力；本合同一式两份，出租方与承租方各执一份，自双方签字（盖章）之日起生效，具有同等法律效力。`
export function ContractDocument({data}:{data:any}){const{rental,items,settings,snapshot}=data;const savedCustomer=snapshot?JSON.parse(snapshot.customerJson):null;const lessor=snapshot?JSON.parse(snapshot.lessorJson):settings;const contractItems=snapshot?JSON.parse(snapshot.itemsJson):items;const[customerType,setCustomerType]=useState<'个人'|'企业'>(snapshot?.customerType||'个人');const[identity,setIdentity]=useState(snapshot?.customerIdentityNo||'');const[company,setCompany]=useState(snapshot?.customerCompany||'');const[credit,setCredit]=useState(snapshot?.customerCreditCode||'');const[terms,setTerms]=useState(snapshot?.terms||settings.contractTerms||DEFAULT_CONTRACT_TERMS);const[pending,start]=useTransition();const save=()=>start(async()=>{try{await saveContractSnapshot(rental.id,{customerType,customerIdentityNo:identity,customerCompany:company,customerCreditCode:credit,terms});toast.success('合同快照已保存')}catch(e){toast.error(userErrorMessage(e,'保存失败，请稍后重试'))}});return <main className="min-h-svh bg-muted p-4 print:bg-card print:p-0"><div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden"><a href="/" className="text-sm text-muted-foreground">返回经营总览</a><div className="flex gap-2"><button onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm"><Save className="size-4"/>保存合同</button><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"><Printer className="size-4"/>打印 / 另存 PDF</button></div></div><article className="mx-auto min-h-[297mm] max-w-[210mm] bg-card px-[14mm] py-[12mm] text-[12px] leading-[1.55] text-foreground shadow-sm print:min-h-0 print:max-w-none print:shadow-none"><h1 className="text-center text-xl font-bold tracking-[.2em]">设备租赁合同</h1><p className="mt-1 text-center text-muted-foreground">合同编号：{rental.contractNo}</p><section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 border-y py-3"><p><strong>出租方：</strong>{lessor.lessorName||'请先在系统设置中完善'}</p><p><strong>主体类型：</strong>{lessor.lessorType}</p><p><strong>证件/信用代码：</strong>{lessor.identityNo||'—'}</p><p><strong>联系人及电话：</strong>{lessor.contactName||'—'} {lessor.phone||''}</p><p className="col-span-2"><strong>地址：</strong>{lessor.address||'—'}</p></section><section className="mt-3 grid grid-cols-2 gap-3 print:hidden"><label>承租方类型<select className="ml-2 rounded border px-2 py-1" value={customerType} onChange={e=>setCustomerType(e.target.value as '个人'|'企业')}><option>个人</option><option>企业</option></select></label>{customerType==='个人'?<label>身份证号<input className="ml-2 rounded border px-2 py-1" value={identity} onChange={e=>setIdentity(e.target.value)}/></label>:<><label>企业名称<input className="ml-2 rounded border px-2 py-1" value={company} onChange={e=>setCompany(e.target.value)}/></label><label>统一社会信用代码<input className="ml-2 rounded border px-2 py-1" value={credit} onChange={e=>setCredit(e.target.value)}/></label></>}</section><section className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1"><p><strong>承租方：</strong>{customerType==='企业'?(company||rental.customerName):rental.customerName}</p><p><strong>{customerType==='企业'?'信用代码':'身份证号'}：</strong>{customerType==='企业'?credit:identity||'—'}</p><p><strong>联系电话：</strong>{rental.customerPhone}</p><p><strong>联系地址：</strong>{rental.customerAddress||'—'}</p></section><h2 className="mt-5 font-bold">一、租赁设备与费用</h2><table className="mt-2 w-full border-collapse"><thead><tr>{['设备类型','设备/型号','配置及编号','数量','月租','合同金额'].map(x=><th key={x} className="border p-1.5 text-left">{x}</th>)}</tr></thead><tbody>{contractItems.map((i:any)=><tr key={i.id}><td className="border p-1.5">{i.deviceType}</td><td className="border p-1.5">{i.deviceName}</td><td className="border p-1.5"><span>{i.deviceCode||''}</span>{formatDeviceConfig(i,true).split(' / ').map((part,index)=><span key={index} className="block">{part}</span>)}</td><td className="border p-1.5">{i.quantity} 台</td><td className="border p-1.5">{money(i.monthlyRent)}</td><td className="border p-1.5">{money(i.totalRent)}</td></tr>)}</tbody></table><div className="mt-2 grid grid-cols-2 gap-1"><p>租赁期限：{rental.startDate} 至 {rental.endDate}</p><p>合同租金合计：{money(rental.totalRent)}</p><p>押金：{money(rental.deposit)}</p><p>收款信息：{lessor.paymentInfo||'双方另行确认'}</p></div><h2 className="mt-4 font-bold">二、合同条款</h2><textarea className="mt-2 min-h-56 w-full resize-none border-0 bg-transparent p-0 text-[11px] leading-[1.5] outline-none print:hidden" value={terms} onChange={e=>setTerms(e.target.value)}/><div className="mt-2 hidden whitespace-pre-line text-[11px] leading-[1.5] print:block">{terms}</div><p className="mt-3 text-[10px] text-muted-foreground print:hidden">提示：本模板为通用业务文本，不替代律师意见，正式使用前请结合当地法律审核。</p><section className="mt-8 grid grid-cols-2 gap-12 break-inside-avoid"><div><p>出租方（签字/盖章）：</p><div className="h-16"/><p>签署日期：____年__月__日</p></div><div><p>承租方（签字/盖章）：</p><div className="h-16"/><p>签署日期：____年__月__日</p></div></section></article></main>}
