'use server'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { and, asc, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext, type ModulePermission } from '@/lib/access'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { account, accountProfiles, adminApplications, businessSettings, contractSnapshots, customerPhoneSessions, customerPortals, organizationMembers, paymentRecords, rentalItems, rentals, session, shops, user, websitePackages } from '@/lib/db/schema'
import { hashPassword } from 'better-auth/crypto'
import { accountNameSchema, validateAccountPermissions, validatePasswordConfirmation } from '@/lib/account-validation'

const DEFAULT_TERMS = `1. 交付与验收：承租方签收设备时应核对数量、配置及外观，签收即视为验收合格。\n2. 租金与押金：承租方按约定时间支付租金及押金；押金不得直接抵扣租金。\n3. 使用与保管：承租方应合理使用设备，不得擅自拆机、转租或用于违法活动。\n4. 维修责任：正常使用产生的故障由出租方负责；人为损坏产生的费用由承租方承担。\n5. 丢失与损坏：设备丢失或无法修复时，承租方按双方确认价值承担赔偿。\n6. 续租与退租：续租须在到期前确认；退租以设备实际归还并验收之日为准。\n7. 违约与争议：违约方承担相应损失；争议应先协商，协商不成由出租方所在地有管辖权的人民法院处理。\n8. 通知送达：本合同记载的电话和地址为有效联系方式，变更应及时书面通知。`

async function userId(permission?:ModulePermission) { return (await getAccessContext(permission)).userId }
async function requireManager() { const context=await getAccessContext('账号管理');if(context.role==='employee')throw new Error('仅管理员可管理员工账号');return context }
async function requireSuperAdmin() { const context=await getAccessContext('账号管理');if(context.role!=='super_admin')throw new Error('仅超级管理员可执行此操作');return context }

const websitePackageSchema = z.object({ name: z.string().trim().min(2).max(30), subtitle: z.string().trim().max(60), monthlyPrice: z.coerce.number().int().min(0).max(100000), cpuSpec: z.string().trim().max(60), memorySpec: z.string().trim().max(40), storageSpec: z.string().trim().max(60), graphicsSpec: z.string().trim().max(60), displaySpec: z.string().trim().max(80), audience: z.string().trim().max(100), badge: z.string().trim().max(12), active: z.boolean(), sortOrder: z.coerce.number().int().min(0).max(10000) })
export async function getWebsitePackagesForAdmin(){const context=await requireSuperAdmin();return db.select().from(websitePackages).where(eq(websitePackages.userId,context.userId)).orderBy(asc(websitePackages.sortOrder),asc(websitePackages.id))}
export async function saveWebsitePackage(input:z.infer<typeof websitePackageSchema>&{id?:number}){const context=await requireSuperAdmin();const value=websitePackageSchema.parse(input);const now=new Date();if(input.id){await db.update(websitePackages).set({...value,updatedAt:now}).where(and(eq(websitePackages.id,input.id),eq(websitePackages.userId,context.userId)))}else{await db.insert(websitePackages).values({...value,userId:context.userId,createdAt:now,updatedAt:now})}revalidatePath('/');revalidatePath('/website-packages')}
export async function deleteWebsitePackage(id:number){const context=await requireSuperAdmin();await db.delete(websitePackages).where(and(eq(websitePackages.id,id),eq(websitePackages.userId,context.userId)));revalidatePath('/');revalidatePath('/website-packages')}

export async function getFinanceData(input: { query?: string; type?: string; method?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
  const id = await userId('资金查看')
  const page = Math.max(1, Math.min(500000, Math.trunc(input.page || 1)))
  const pageSize = Math.max(1, Math.min(100, Math.trunc(input.pageSize || 20)))
  const filters = [eq(paymentRecords.userId, id)]
  if (input.from) filters.push(gte(paymentRecords.paymentDate, input.from))
  if (input.to) filters.push(lte(paymentRecords.paymentDate, input.to))
  if (input.type && input.type !== '全部') filters.push(eq(paymentRecords.feeType, input.type))
  if (input.method && input.method !== '全部') filters.push(eq(paymentRecords.paymentMethod, input.method))
  if (input.query) { const pattern = `%${input.query.slice(0, 80)}%`; filters.push(or(like(rentals.contractNo, pattern), like(rentals.customerCompany, pattern), like(rentals.customerName, pattern), like(rentals.customerPhone, pattern), like(rentals.deviceName, pattern))!) }
  const where = and(...filters)
  const joined = db.select({ id: paymentRecords.id, rentalId: paymentRecords.rentalId, amount: paymentRecords.amount, paymentDate: paymentRecords.paymentDate, paymentMethod: paymentRecords.paymentMethod, feeType: paymentRecords.feeType, notes: paymentRecords.notes, operatorName: paymentRecords.operatorName, contractNo: rentals.contractNo, customerCompany: rentals.customerCompany, customerName: rentals.customerName, customerPhone: rentals.customerPhone, deviceName: rentals.deviceName, renewalRecordId: paymentRecords.renewalRecordId }).from(paymentRecords).innerJoin(rentals, and(eq(rentals.id, paymentRecords.rentalId), eq(rentals.userId, id)))
  const now = new Date(); const day = now.toISOString().slice(0, 10); const month = day.slice(0, 7); const year = day.slice(0, 4)
  const [rows, [countRow], [summary], types] = await Promise.all([
    joined.where(where).orderBy(desc(paymentRecords.paymentDate), desc(paymentRecords.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(paymentRecords).innerJoin(rentals, and(eq(rentals.id, paymentRecords.rentalId), eq(rentals.userId, id))).where(where),
    db.select({ today: sql<number>`coalesce(sum(case when ${paymentRecords.paymentDate} = ${day} then cast(${paymentRecords.amount} as real) else 0 end),0)`, month: sql<number>`coalesce(sum(case when ${paymentRecords.paymentDate} like ${month + '%'} then cast(${paymentRecords.amount} as real) else 0 end),0)`, year: sql<number>`coalesce(sum(case when ${paymentRecords.paymentDate} like ${year + '%'} then cast(${paymentRecords.amount} as real) else 0 end),0)`, all: sql<number>`coalesce(sum(cast(${paymentRecords.amount} as real)),0)` }).from(paymentRecords).where(eq(paymentRecords.userId, id)),
    db.select({ type: paymentRecords.feeType, amount: sql<number>`sum(cast(${paymentRecords.amount} as real))` }).from(paymentRecords).where(eq(paymentRecords.userId, id)).groupBy(paymentRecords.feeType),
  ])
  const total = Number(countRow?.count ?? 0)
  return { rows, summary: { today: Number(summary?.today ?? 0), month: Number(summary?.month ?? 0), year: Number(summary?.year ?? 0), all: Number(summary?.all ?? 0) }, types: types.map((row) => [row.type, Number(row.amount)] as [string, number]), total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
}

async function loadSettings(id:string){const [row]=await db.select().from(businessSettings).where(eq(businessSettings.userId,id));return row??{userId:id,storeName:'速维租赁管理',lessorType:'企业',lessorName:'',identityNo:'',contactName:'',phone:'',address:'',paymentInfo:'',contractTerms:DEFAULT_TERMS,themeMode:'system',themeColor:'green'}}
export async function getSettings(){const id=await userId('系统设置');return loadSettings(id)}
export async function getStoreName(){const id=await userId();const settings=await loadSettings(id);return settings.storeName?.trim()||'速维租赁管理'}
const settingsSchema=z.object({storeName:z.string().trim().min(2,'店铺名称至少需要 2 个字').max(40,'店铺名称最多 40 个字'),lessorType:z.enum(['个人','企业']),lessorName:z.string().trim().max(100,'出租方名称最多 100 个字'),identityNo:z.string().optional(),contactName:z.string().optional(),phone:z.string().optional(),address:z.string().optional(),paymentInfo:z.string().optional(),contractTerms:z.string().min(20),themeMode:z.enum(['light','dark','system']),themeColor:z.enum(['green','blue','orange'])})
export async function saveSettings(input:z.infer<typeof settingsSchema>){const id=await userId('系统设置');const v=settingsSchema.parse(input);await db.insert(businessSettings).values({...v,userId:id}).onConflictDoUpdate({target:businessSettings.userId,set:{...v,updatedAt:new Date()}});revalidatePath('/');revalidatePath('/settings')}

export async function getContract(rentalId:number){const id=await userId('合同管理');const [rental]=await db.select().from(rentals).where(and(eq(rentals.userId,id),eq(rentals.id,rentalId)));if(!rental)throw new Error('合同不存在');const items=await db.select().from(rentalItems).where(and(eq(rentalItems.userId,id),eq(rentalItems.rentalId,rentalId))).orderBy(asc(rentalItems.id));const [snapshot]=await db.select().from(contractSnapshots).where(and(eq(contractSnapshots.userId,id),eq(contractSnapshots.rentalId,rentalId)));const settings=await loadSettings(id);return{rental,items,settings,snapshot}}
export async function saveContractSnapshot(rentalId:number,input:{customerType:'个人'|'企业';customerIdentityNo?:string;customerCompany?:string;customerCreditCode?:string;terms:string}){const id=await userId('合同管理');const [rental]=await db.select().from(rentals).where(and(eq(rentals.userId,id),eq(rentals.id,rentalId)));if(!rental)throw new Error('合同不存在');const items=await db.select().from(rentalItems).where(and(eq(rentalItems.userId,id),eq(rentalItems.rentalId,rentalId)));const settings=await loadSettings(id);const values={userId:id,rentalId,customerType:input.customerType,customerIdentityNo:input.customerIdentityNo,customerCompany:input.customerCompany,customerCreditCode:input.customerCreditCode,lessorJson:JSON.stringify(settings),customerJson:JSON.stringify({name:rental.customerName,phone:rental.customerPhone,address:rental.customerAddress}),itemsJson:JSON.stringify(items),terms:input.terms};await db.insert(contractSnapshots).values(values).onConflictDoUpdate({target:contractSnapshots.rentalId,set:{...values,updatedAt:new Date()}});revalidatePath(`/contracts/${rentalId}`)}

async function requireOwnedMember(ownerId: string, memberUserId: string) {
  const [member] = await db
    .select({ memberUserId: organizationMembers.memberUserId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.ownerId, ownerId), eq(organizationMembers.memberUserId, memberUserId)))
  if (!member) throw new Error('员工账号不存在或不属于当前管理员')
}

export async function getAccounts() {
  const context = await requireManager()
  const [owner, members, customers, applications] = await Promise.all([
    db.select({ id: user.id, name: user.name, email: user.username, phone: user.phoneNumber, createdAt: user.createdAt, updatedAt: user.updatedAt }).from(user).where(eq(user.id, context.actorId)),
    db.select({ id: user.id, name: user.name, email: user.username, phone: user.phoneNumber, role: organizationMembers.role, active: organizationMembers.active, permissions: organizationMembers.permissions, updatedAt: organizationMembers.updatedAt }).from(organizationMembers).innerJoin(user, eq(user.id, organizationMembers.memberUserId)).where(and(eq(organizationMembers.ownerId, context.userId), eq(organizationMembers.role, 'employee'))).orderBy(desc(organizationMembers.updatedAt)),
    db.select({ id: customerPortals.id, name: customerPortals.customerName, phone: customerPortals.phone, assigneeUserId: customerPortals.assigneeUserId, status: customerPortals.status, verifiedAt: customerPortals.lastLoginAt, createdAt: customerPortals.createdAt, updatedAt: customerPortals.updatedAt }).from(customerPortals).where(eq(customerPortals.userId, context.userId)).orderBy(desc(customerPortals.updatedAt)),
    context.role === 'super_admin' ? db.select({ id: adminApplications.id, shopName: adminApplications.shopName, name: adminApplications.name, email: adminApplications.email, phone: adminApplications.phone, status: adminApplications.status, createdAt: adminApplications.createdAt }).from(adminApplications).where(eq(adminApplications.status, 'pending')).orderBy(asc(adminApplications.createdAt)) : Promise.resolve([]),
  ])
  return { owner, members, customers, applications, currentRole: context.role as 'super_admin' | 'admin' }
}

const loginAccountSchema = z.string().trim().toLowerCase().min(3, '账号至少需要 3 位').max(80, '账号最多 80 位').regex(/^[a-zA-Z0-9._@+-]+$/, '账号只能包含字母、数字及 . _ @ + -')
const applicationSchema = z.object({ shopName: z.string().trim().min(2, '店铺名称至少需要 2 个字').max(40, '店铺名称最多 40 个字'), name: accountNameSchema, account: loginAccountSchema, phone: z.string().regex(/^1\d{10}$/, '请输入有效的 11 位手机号'), password: z.string().min(8, '密码至少需要 8 位').max(128), confirmPassword: z.string() })
export async function submitAdminApplication(input: z.infer<typeof applicationSchema>) {
  const value = applicationSchema.parse(input)
  if (value.password !== value.confirmPassword) throw new Error('两次输入的密码不一致')
  const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.username, value.account))
  if (existingUser) throw new Error('该登录账号已存在，不能重复申请')
  const [existingPhone] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, value.phone))
  if (existingPhone) throw new Error('该手机号已绑定其他团队账号')
  const [pending] = await db.select({ id: adminApplications.id }).from(adminApplications).where(and(eq(adminApplications.email, value.account), eq(adminApplications.status, 'pending')))
  if (pending) throw new Error('该登录账号已有待审核申请')
  await db.insert(adminApplications).values({ shopName: value.shopName, name: value.name, email: value.account, phone: value.phone, passwordHash: await hashPassword(value.password) })
  return { success: true }
}

export async function reviewAdminApplication(applicationId: number, decision: 'approve' | 'reject') {
  const context = await requireSuperAdmin()
  const [application] = await db.select().from(adminApplications).where(and(eq(adminApplications.id, applicationId), eq(adminApplications.status, 'pending')))
  if (!application) throw new Error('申请不存在或已处理')
  const now = new Date()
  if (decision === 'reject') {
    await db.update(adminApplications).set({ status: 'rejected', reviewedBy: context.actorId, reviewedAt: now, updatedAt: now }).where(eq(adminApplications.id, applicationId))
  } else {
    const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.username, application.email))
    if (existingUser) throw new Error('该登录账号已存在，无法批准')
    const [existingPhone] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, application.phone))
    if (existingPhone) throw new Error('该手机号已绑定其他团队账号')
    const newUserId = randomUUID()
    { const tx = db
      await tx.insert(user).values({ id: newUserId, name: application.name, email: `${newUserId}@account.local`, emailVerified: false, username: application.email, displayUsername: application.email, phoneNumber: application.phone, phoneNumberVerified: true, createdAt: now, updatedAt: now })
      await tx.insert(account).values({ id: randomUUID(), accountId: newUserId, providerId: 'credential', userId: newUserId, password: application.passwordHash, createdAt: now, updatedAt: now })
      await tx.insert(accountProfiles).values({ userId: newUserId, role: 'admin', phone: application.phone, active: true, createdAt: now, updatedAt: now })
      await tx.insert(shops).values({ id: newUserId, name: application.shopName?.trim() || `${application.name}的店铺`, ownerUserId: newUserId, status: 'active', createdAt: now, updatedAt: now })
      await tx.insert(businessSettings).values({ userId: newUserId, storeName: application.shopName?.trim() || `${application.name}的店铺`, updatedAt: now })
      await tx.update(adminApplications).set({ status: 'approved', reviewedBy: context.actorId, reviewedAt: now, updatedAt: now }).where(eq(adminApplications.id, applicationId))
    }
  }
  revalidatePath('/accounts')
}

export async function addMember(input: { name: string; account: string; phone: string; password: string; confirmPassword: string; permissions: string[] }) {
  const { userId: ownerId } = await requireManager()
  const name = accountNameSchema.parse(input.name)
  const loginAccount = loginAccountSchema.parse(input.account)
  const phone = z.string().regex(/^1\d{10}$/, '请输入有效的 11 位手机号').parse(input.phone)
  const password = validatePasswordConfirmation({ newPassword: input.password, confirmPassword: input.confirmPassword })
  const permissions = validateAccountPermissions(input.permissions)
  const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.username, loginAccount))
  if (existingUser) throw new Error('该登录账号已存在，请使用其他账号')
  const [existingPhone] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone))
  if (existingPhone) throw new Error('该手机号已绑定其他团队账号')

  const memberUserId = randomUUID()
  const now = new Date()
  { const tx = db
    await tx.insert(user).values({ id: memberUserId, name, email: `${memberUserId}@account.local`, emailVerified: false, username: loginAccount, displayUsername: loginAccount, phoneNumber: phone, phoneNumberVerified: true, createdAt: now, updatedAt: now })
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: memberUserId,
      providerId: 'credential',
      userId: memberUserId,
      password: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    })
    await tx.insert(accountProfiles).values({ userId: memberUserId, role: 'employee', active: true, createdAt: now, updatedAt: now })
    await tx.insert(organizationMembers).values({ shopId: ownerId, ownerId, memberUserId, role: 'employee', active: true, permissions: permissions.join(','), updatedAt: now })
  }
  revalidatePath('/accounts')
}

const customerSchema = z.object({
  name: accountNameSchema,
  phone: z.string().transform((value) => value.replace(/\D/g, '')).pipe(z.string().regex(/^1\d{10}$/, '请输入有效的 11 位手机号')),
  assigneeUserId: z.string().min(1, '请选择客户负责人'),
})

async function requireShopAssignee(ownerId: string, assigneeUserId: string) {
  if (assigneeUserId === ownerId) return
  await requireOwnedMember(ownerId, assigneeUserId)
}

export async function addCustomer(input: z.input<typeof customerSchema>) {
  const context = await requireManager()
  const value = customerSchema.parse(input)
  await requireShopAssignee(context.userId, value.assigneeUserId)
  const [existing] = await db.select({ id: customerPortals.id, userId: customerPortals.userId }).from(customerPortals).where(eq(customerPortals.phone, value.phone))
  if (existing) throw new Error(existing.userId === context.userId ? '该手机号已是本店客户，不能重复添加' : '该手机号已属于其他店铺')
  const [teamAccount] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, value.phone))
  if (teamAccount) throw new Error('该手机号已绑定团队账号，不能再加入客户团队')
  const now = new Date()
  const legacySecret = createHash('sha256').update(randomBytes(32)).digest('hex')
  await db.insert(customerPortals).values({
    userId: context.userId,
    phone: value.phone,
    customerName: value.name,
    assigneeUserId: value.assigneeUserId,
    accessTokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
    passwordHash: legacySecret,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })
  revalidatePath('/accounts')
}

export async function updateCustomer(customerId: number, input: { name: string; active: boolean; assigneeUserId: string }) {
  const context = await requireManager()
  const name = accountNameSchema.parse(input.name)
  await requireShopAssignee(context.userId, input.assigneeUserId)
  const [customer] = await db.select({ id: customerPortals.id, phone: customerPortals.phone }).from(customerPortals).where(and(eq(customerPortals.id, customerId), eq(customerPortals.userId, context.userId)))
  if (!customer) throw new Error('客户不存在或不属于当前店铺')
  { const tx = db
    await tx.update(customerPortals).set({ customerName: name, assigneeUserId: input.assigneeUserId, status: input.active ? 'active' : 'disabled', updatedAt: new Date() }).where(and(eq(customerPortals.id, customerId), eq(customerPortals.userId, context.userId)))
    if (!input.active) await tx.delete(customerPhoneSessions).where(and(eq(customerPhoneSessions.shopId, context.userId), eq(customerPhoneSessions.phone, customer.phone)))
  }
  revalidatePath('/accounts')
}

export async function updateOwnName(name: string) {
  const { actorId } = await requireManager()
  const validName = accountNameSchema.parse(name)
  await db.update(user).set({ name: validName, updatedAt: new Date() }).where(eq(user.id, actorId))
  revalidatePath('/accounts')
  revalidatePath('/')
}

export async function changeOwnPassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  await requireManager()
  const newPassword = validatePasswordConfirmation(input)
  if (input.currentPassword === newPassword) throw new Error('新密码不能与当前密码相同')
  try {
    await auth.api.changePassword({ headers: await headers(), body: { currentPassword: input.currentPassword, newPassword, revokeOtherSessions: true } })
  } catch {
    throw new Error('当前密码不正确，修改未保存')
  }
}

export async function updateMemberName(memberUserId: string, name: string) {
  const { userId: id } = await requireManager()
  await requireOwnedMember(id, memberUserId)
  const validName = accountNameSchema.parse(name)
  await db.update(user).set({ name: validName, updatedAt: new Date() }).where(eq(user.id, memberUserId))
  revalidatePath('/accounts')
}

export async function resetMemberPassword(memberUserId: string, input: { newPassword: string; confirmPassword: string }) {
  const { userId: id } = await requireManager()
  await requireOwnedMember(id, memberUserId)
  const newPassword = validatePasswordConfirmation(input)
  const [credential] = await db.select({ id: account.id }).from(account).where(and(eq(account.userId, memberUserId), eq(account.providerId, 'credential')))
  if (!credential) throw new Error('该员工没有账号密码登录凭据')
  { const tx = db
    await tx.update(account).set({ password: await hashPassword(newPassword), updatedAt: new Date() }).where(eq(account.id, credential.id))
    await tx.delete(session).where(eq(session.userId, memberUserId))
  }
}

export async function updateMember(memberUserId: string, input: { active: boolean; permissions: string[] }) {
  const { userId: id } = await requireManager()
  await requireOwnedMember(id, memberUserId)
  const validPermissions = validateAccountPermissions(input.permissions)
  { const tx = db
    await tx.update(organizationMembers).set({ active: input.active, permissions: validPermissions.join(','), updatedAt: new Date() }).where(and(eq(organizationMembers.ownerId, id), eq(organizationMembers.memberUserId, memberUserId)))
    if (!input.active) await tx.delete(session).where(eq(session.userId, memberUserId))
  }
  revalidatePath('/accounts')
}
