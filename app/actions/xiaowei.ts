'use server'

import { and, eq } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { buyoutRecords, lossRecords, paymentRecords, receivableBills, renewalRecords, rentalEvents, rentalItems, rentals, returnRecords } from '@/lib/db/schema'

export type XiaoweiAnswer = { title:string; summary:string; facts:string[]; scope:string; href:string; hrefLabel:string; updatedAt:string }
type Rental = typeof rentals.$inferSelect
type Item = typeof rentalItems.$inferSelect
const n=(v:unknown)=>Number(v||0)
const money=(v:number)=>`¥${v.toLocaleString('zh-CN',{maximumFractionDigits:2})}`
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date())
const active=(s:string)=>['在租','逾期'].includes(s)
const available=(i:Item)=>Math.max(0,i.quantity-i.returnedQuantity-i.boughtOutQuantity-i.lostQuantity)
const clean=(v:unknown)=>String(v??'').trim().replace(/\s+/g,' ')
const valid=(v:unknown)=>{const x=clean(v);return x&&!/^(未填写|无|暂无|不详|未知|其他|-)$/i.test(x)?x:''}
function rank<T>(rows:T[],key:(r:T)=>string,value:(r:T)=>number,limit=5){const map=new Map<string,number>();for(const row of rows){const k=valid(key(row));if(k)map.set(k,(map.get(k)||0)+value(row))}return [...map].sort((a,b)=>b[1]-a[1]).slice(0,limit)}
const month=(d:string)=>d.slice(0,7)
const customer=(r:Rental)=>valid(r.customerCompany)||valid(r.customerName)||r.customerPhone
function range(q:string,now:string){if(/本月|这个月|当月/.test(q))return{from:`${now.slice(0,7)}-01`,label:'本月'};if(/今年|本年/.test(q))return{from:`${now.slice(0,4)}-01-01`,label:'今年'};return{from:'',label:''}}

export async function askXiaowei(raw:string):Promise<XiaoweiAnswer>{
 const q=raw.trim().slice(0,200);if(q.length<2)throw new Error('请把问题描述得更具体一些')
 const access=await getAccessContext('租赁操作');if(access.role==='super_admin'||!access.shopId)throw new Error('平台主管不访问店铺经营数据')
 const employee=access.role==='employee';const where=employee?and(eq(rentals.userId,access.userId),eq(rentals.assigneeUserId,access.actorId)):eq(rentals.userId,access.userId)
 const all=await db.select().from(rentals).where(where);const official=all.filter(r=>r.orderType==='official'&&r.lifecycleStatus!=='deleted');const ids=new Set(official.map(r=>r.id))
 const [rawItems,rawBills,rawPayments,rawReturns,rawEvents,rawRenewals,rawLosses,rawBuyouts]=await Promise.all([
  db.select().from(rentalItems).where(eq(rentalItems.userId,access.userId)),db.select().from(receivableBills).where(eq(receivableBills.userId,access.userId)),db.select().from(paymentRecords).where(eq(paymentRecords.userId,access.userId)),db.select().from(returnRecords).where(eq(returnRecords.userId,access.userId)),db.select().from(rentalEvents).where(eq(rentalEvents.userId,access.userId)),db.select().from(renewalRecords).where(eq(renewalRecords.userId,access.userId)),db.select().from(lossRecords).where(eq(lossRecords.userId,access.userId)),db.select().from(buyoutRecords).where(eq(buyoutRecords.userId,access.userId))])
 const own=<T extends {rentalId:number}>(x:T[])=>x.filter(r=>ids.has(r.rentalId));const items=own(rawItems),bills=own(rawBills),payments=own(rawPayments),returns=own(rawReturns),events=own(rawEvents),renewals=own(rawRenewals),losses=own(rawLosses),buyouts=own(rawBuyouts)
 const now=today(),period=range(q,now),scoped=official.filter(r=>(!period.from||r.startDate>=period.from)&&r.startDate<=now);const scope=`${employee?`仅统计由你负责的合同（${access.actorName}）`:`统计门店全部经营数据（${access.shopName}）`}${period.label?` · ${period.label}`:''}`;const base={scope,updatedAt:new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date())}
 const answer=(title:string,summary:string,facts:string[],href='/rentals',hrefLabel='查看业务明细'):XiaoweiAnswer=>({...base,title,summary,facts,href,hrefLabel})
 const monthly=/哪个月|哪月|月份|每月|月度/.test(q), asksAmount=/金额|租金|收入|业绩|合同额|收款/.test(q), asksRank=/最多|最高|排行|排名|前\s*\d+/.test(q)

 if(monthly&&/收款|实收|到账/.test(q)){const rent=payments.filter(p=>/租金/.test(p.feeType));const r=rank(rent,p=>month(p.paymentDate),p=>n(p.amount),12);return answer('月度实际租金收款排行',r.length?`${r[0][0]} 实收租金最多，共 ${money(r[0][1])}。`:'暂无租金收款记录。',r.map(([k,v],i)=>`${i+1}. ${k}：${money(v)}`),'/finance','查看资金流水')}
 if(monthly&&/退租|归还/.test(q)){const r=rank(returns,x=>month(x.returnDate),x=>x.quantity,12);return answer('月度退租排行',r.length?`${r[0][0]} 退租最多，共 ${r[0][1]} 台。`:'暂无退租记录。',r.map(([k,v],i)=>`${i+1}. ${k}：${v} 台`),'/rentals?status=returned','查看退租记录')}
 if(monthly&&/续租/.test(q)){const r=rank(renewals,x=>month(x.renewalDate),x=>x.quantity,12);return answer('月度续租排行',r.length?`${r[0][0]} 续租最多，共 ${r[0][1]} 台。`:'暂无续租记录。',r.map(([k,v],i)=>`${i+1}. ${k}：${v} 台`))}

 const hardware:[RegExp,keyof Item,string][]=[[/CPU|处理器/i,'cpu','CPU'],[/内存|RAM/i,'memory','内存'],[/硬盘|存储|SSD/i,'storage','硬盘'],[/显卡|GPU/i,'graphicsCard','显卡'],[/主板/i,'motherboard','主板'],[/电源/i,'powerSupply','电源']]
 const hw=hardware.find(([re])=>re.test(q));if(hw&&asksRank){const activeIds=new Set(scoped.filter(r=>active(r.status)).map(r=>r.id)),rows=items.filter(i=>activeIds.has(i.rentalId)&&available(i)>0),ranking=rank(rows,i=>clean(i[hw[1]]),available);return answer(`在租${hw[2]}排行`,ranking.length?`${ranking[0][0]} 当前最多，共 ${ranking[0][1]} 台。`:`现有设备尚未填写可用的${hw[2]}结构化数据。`,ranking.map(([k,v],i)=>`${i+1}. ${k}：${v} 台`),'/rentals?status=active','查看在租设备')}
 if(/硬件/.test(q)&&asksRank)return answer('请确认硬件类型','你想比较哪一种硬件？配置中的各类硬件需要分别统计。',['CPU：哪个 CPU 租得最多？','内存：哪个内存配置租得最多？','硬盘：哪个硬盘配置租得最多？','显卡：哪个显卡租得最多？'])

 const asksPerson=/哪个人|谁租|客户.*最多|租户.*最多|哪个公司.*最多/.test(q),asksAssignee=/负责人|客户经理|业务员|员工|谁的业绩/.test(q)
 if(asksPerson){const rows=scoped.filter(r=>active(r.status)),r=rank(rows,customer,x=>asksAmount?n(x.totalRent):x.quantity);return answer(`客户${asksAmount?'合同额':'在租数量'}排行`,r.length?`${r[0][0]}最多，${asksAmount?money(r[0][1]):`${r[0][1]} 台`}。`:'暂无客户租赁数据。',r.map(([k,v],i)=>`${i+1}. ${k}：${asksAmount?money(v):`${v} 台`}`))}
 if(asksAssignee){if(employee)return answer('负责人数据范围说明','你只能查看自己负责的合同，无法比较其他客户经理。',[`正式合同 ${official.length} 份`,`在租合同 ${official.filter(r=>active(r.status)).length} 份`]);const r=rank(scoped.filter(x=>active(x.status)),x=>x.assigneeName||'',x=>asksAmount?n(x.totalRent):x.quantity);return answer(`负责人${asksAmount?'合同额':'在租数量'}排行`,r.length?`${r[0][0]}当前最高。`:'暂无负责人数据。',r.map(([k,v],i)=>`${i+1}. ${k}：${asksAmount?money(v):`${v} 台`}`))}

 if(/配置|型号|机型|设备类型|品类|哪类|什么设备/.test(q)&&asksRank){const activeIds=new Set(scoped.filter(r=>active(r.status)).map(r=>r.id)),rows=items.filter(i=>activeIds.has(i.rentalId)&&available(i)>0);const field: keyof Item=/配置/.test(q)?'deviceConfig':/型号|机型/.test(q)?'deviceName':'deviceType';const label=field==='deviceConfig'?'配置':field==='deviceName'?'型号':'设备类型';if(field==='deviceConfig')return answer('电脑配置需要按硬件比较','整段配置文本写法不统一，直接排行会产生错误结果。请选择具体硬件。',['哪个 CPU 租得最多？','哪个内存配置租得最多？','哪个硬盘配置租得最多？','哪个显卡租得最多？']);const r=rank(rows,i=>clean(i[field]),available);return answer(`在租${label}排行`,r.length?`${r[0][0]} 当前最多，共 ${r[0][1]} 台。`:'暂无可统计数据。',r.map(([k,v],i)=>`${i+1}. ${k}：${v} 台`))}

 if(/逾期|待收|欠款|应收|催收/.test(q)){const outstanding=bills.map(b=>({...b,unpaid:Math.max(0,n(b.amount)-n(b.paidAmount))})).filter(b=>b.unpaid>0),overdue=outstanding.filter(b=>b.dueDate<now);return answer('待收与逾期分析',`当前待收 ${money(outstanding.reduce((s,b)=>s+b.unpaid,0))}，其中逾期 ${money(overdue.reduce((s,b)=>s+b.unpaid,0))}。`,[`待收账单 ${outstanding.length} 笔`,`逾期账单 ${overdue.length} 笔`,`涉及逾期客户 ${new Set(overdue.map(b=>official.find(r=>r.id===b.rentalId)?.customerPhone).filter(Boolean)).size} 位`],'/rentals?settlement=outstanding','查看待收合同')}
 if(/维修/.test(q)){const rows=events.filter(e=>e.eventType==='维修');return answer('维修业务概况',`共登记维修 ${rows.length} 次，其中 ${rows.filter(e=>e.status!=='已完成').length} 次尚未完成。`,[`维修成本 ${money(rows.reduce((s,e)=>s+n(e.repairCost),0))}`,`客户承担 ${money(rows.reduce((s,e)=>s+n(e.customerCharge),0))}`])}
 if(/丢失/.test(q))return answer('设备丢失概况',`共登记丢失 ${losses.reduce((s,x)=>s+x.quantity,0)} 台。`,[`丢失记录 ${losses.length} 笔`,`应赔金额 ${money(losses.reduce((s,x)=>s+n(x.amount),0))}`])
 if(/买断/.test(q))return answer('设备买断概况',`共买断 ${buyouts.reduce((s,x)=>s+x.quantity,0)} 台。`,[`买断记录 ${buyouts.length} 笔`,`买断金额 ${money(buyouts.reduce((s,x)=>s+n(x.amount),0))}`])
 if(/退租|归还/.test(q))return answer('退租业务概况',`共退租 ${returns.reduce((s,x)=>s+x.quantity,0)} 台。`,[`退租记录 ${returns.length} 笔`,`押金扣款 ${money(returns.reduce((s,x)=>s+n(x.deductionAmount),0))}`])
 if(/续租/.test(q))return answer('续租业务概况',`共续租 ${renewals.reduce((s,x)=>s+x.quantity,0)} 台。`,[`续租记录 ${renewals.length} 笔`,`续租金额 ${money(renewals.reduce((s,x)=>s+n(x.renewalAmount),0))}`])
 if(/到期/.test(q)){const days=Math.min(90,Math.max(1,Number(q.match(/(\d+)\s*天/)?.[1]||7))),d=new Date(`${now}T00:00:00+08:00`);d.setDate(d.getDate()+days);const end=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(d),due=official.filter(r=>active(r.status)&&r.endDate>=now&&r.endDate<=end);return answer(`未来 ${days} 天到期提醒`,`共有 ${due.length} 份合同、${due.reduce((s,r)=>s+r.quantity,0)} 台设备即将到期。`,due.slice(0,5).map(r=>`${r.customerName}：${r.contractNo}，${r.endDate} 到期`))}
 if(/风险|风控|异常|押金/.test(q)){const overdue=bills.filter(b=>b.dueDate<now&&n(b.amount)>n(b.paidAmount)),noDeposit=official.filter(r=>active(r.status)&&n(r.deposit)<=0),large=official.filter(r=>active(r.status)&&r.quantity>=10);return answer('经营风控扫描','以下是基于系统记录的经营提醒，不替代人工审核。',[`逾期合同 ${new Set(overdue.map(b=>b.rentalId)).size} 份`,`在租但押金为 0 的合同 ${noDeposit.length} 份`,`单份在租 10 台以上合同 ${large.length} 份`])}
 if(/租了多少|租出|新增|本月|这个月|今年/.test(q)){const qty=scoped.reduce((s,r)=>s+r.quantity,0),label=period.label||'当前范围';return answer(`${label}租赁概况`,`${label}新增 ${scoped.length} 份正式合同，共租出 ${qty} 台。`,[`合同总额 ${money(scoped.reduce((s,r)=>s+n(r.totalRent),0))}`,`统计截止 ${now}`])}
 if(/最好|最优|最重要|表现最好/.test(q))return answer('请确认评价口径','“最好”可以按不同经营指标判断，请选择口径。',['租赁数量最多','合同金额最高','实际回款最多','逾期率最低'])
 return answer('我还需要更明确的问题','我可以查询本系统的合同、客户、设备、财务和业务事件数据。',['哪个客户租得最多？','哪个月实收租金最多？','哪个月退租最多？','哪个 CPU、内存、硬盘或显卡租得最多？','维修、续租、退租、丢失或买断情况怎么样？'],'/dashboard','查看经营总览')
}
