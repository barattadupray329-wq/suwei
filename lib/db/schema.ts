import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

const timestampMs = (name: string) => integer(name, { mode: 'timestamp_ms' })
const jsonText = <T = unknown>(name: string) => text(name, { mode: 'json' }).$type<T>()
const now = sql`(unixepoch() * 1000)`

export const user = sqliteTable('user', { id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(), emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false), image: text('image'), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now), username: text('username').unique(), displayUsername: text('displayUsername'), phoneNumber: text('phoneNumber').unique(), phoneNumberVerified: integer('phoneNumberVerified', { mode: 'boolean' }).notNull().default(false) })
export const session = sqliteTable('session', { id: text('id').primaryKey(), expiresAt: timestampMs('expiresAt').notNull(), token: text('token').notNull().unique(), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now), ipAddress: text('ipAddress'), userAgent: text('userAgent'), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }) })
export const account = sqliteTable('account', { id: text('id').primaryKey(), accountId: text('accountId').notNull(), providerId: text('providerId').notNull(), userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), accessToken: text('accessToken'), refreshToken: text('refreshToken'), idToken: text('idToken'), accessTokenExpiresAt: timestampMs('accessTokenExpiresAt'), refreshTokenExpiresAt: timestampMs('refreshTokenExpiresAt'), scope: text('scope'), password: text('password'), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now) })
export const verification = sqliteTable('verification', { id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(), expiresAt: timestampMs('expiresAt').notNull(), createdAt: timestampMs('createdAt').default(now), updatedAt: timestampMs('updatedAt').default(now) })

export const rentals = sqliteTable('rentals', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), assignedEmployeeId: text('assignedEmployeeId').references(() => user.id, { onDelete: 'set null' }), contractNo: text('contractNo').notNull(), customerCompany: text('customer_company'), customerName: text('customerName').notNull(), customerPhone: text('customerPhone').notNull(), customerAddress: text('customerAddress'), deviceName: text('deviceName').notNull(), deviceType: text('deviceType').notNull().default('台式机'), deviceConfig: text('deviceConfig'), deviceCode: text('deviceCode'), cpu: text('cpu'), motherboard: text('motherboard'), memory: text('memory'), storage: text('storage'), graphicsCard: text('graphicsCard'), powerSupply: text('powerSupply'), caseModel: text('caseModel'), monitorInfo: text('monitorInfo'), screenSize: text('screenSize'), screenResolution: text('screenResolution'), refreshRate: text('refreshRate'), panelType: text('panelType'), ports: text('ports'), batteryInfo: text('batteryInfo'), adapterInfo: text('adapterInfo'), accessories: text('accessories'), colorGamut: text('colorGamut'), quantity: integer('quantity').notNull().default(1), startDate: text('startDate').notNull(), endDate: text('endDate').notNull(), monthlyRent: text('monthlyRent').notNull().default('0'), totalRent: text('totalRent').notNull().default('0'), deposit: text('deposit').notNull().default('0'), paidAmount: text('paidAmount').notNull().default('0'), paymentStatus: text('paymentStatus').notNull().default('待收款'), status: text('status').notNull().default('在租'), notes: text('notes'), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now) }, (table) => [unique().on(table.userId, table.contractNo), index('rentals_assigned_employee_idx').on(table.assignedEmployeeId), index('rentals_customer_phone_idx').on(table.customerPhone)])

export const rentalItems = sqliteTable('rental_items', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(),
  deviceName: text('deviceName').notNull(), deviceType: text('deviceType').notNull().default('台式机'), deviceCode: text('deviceCode'), deviceConfig: text('deviceConfig'),
  quantity: integer('quantity').notNull().default(1), startDate: text('startDate'), endDate: text('endDate'), monthlyRent: text('monthlyRent').notNull().default('0'), totalRent: text('totalRent').notNull().default('0'), boughtOutQuantity: integer('boughtOutQuantity').notNull().default(0), returnedQuantity: integer('returnedQuantity').notNull().default(0), lostQuantity: integer('lostQuantity').notNull().default(0), buyoutAmount: text('buyoutAmount').notNull().default('0'),
  cpu: text('cpu'), motherboard: text('motherboard'), memory: text('memory'), storage: text('storage'), graphicsCard: text('graphicsCard'), powerSupply: text('powerSupply'), caseModel: text('caseModel'), monitorInfo: text('monitorInfo'), screenSize: text('screenSize'), screenResolution: text('screenResolution'), refreshRate: text('refreshRate'), panelType: text('panelType'), ports: text('ports'), batteryInfo: text('batteryInfo'), adapterInfo: text('adapterInfo'), accessories: text('accessories'), colorGamut: text('colorGamut'),
  createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now),
})

export const buyoutRecords = sqliteTable('buyout_records', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), rentalItemId: integer('rentalItemId').notNull(), quantity: integer('quantity').notNull(), unitPrice: text('unitPrice').notNull(), amount: text('amount').notNull(), buyoutDate: text('buyoutDate').notNull(), notes: text('notes'), createdAt: timestampMs('createdAt').notNull().default(now),
})

export const renewalRecords = sqliteTable('renewal_records', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), sourceRentalItemId: integer('sourceRentalItemId').notNull(), renewedRentalItemId: integer('renewedRentalItemId').notNull(), quantity: integer('quantity').notNull(), renewalMonths: integer('renewalMonths'), billingUnit: text('billingUnit'), duration: integer('duration'), unitPrice: text('unitPrice'), oldMonthlyRent: text('oldMonthlyRent').notNull(), newMonthlyRent: text('newMonthlyRent').notNull(), oldEndDate: text('oldEndDate').notNull(), newEndDate: text('newEndDate').notNull(), renewalAmount: text('renewalAmount').notNull().default('0'), renewalDate: text('renewalDate').notNull(), notes: text('notes'), createdAt: timestampMs('createdAt').notNull().default(now),
})

export const paymentRecords = sqliteTable('payment_records', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), renewalRecordId: integer('renewalRecordId'), buyoutRecordId: integer('buyoutRecordId'), returnRecordId: integer('returnRecordId'), lossRecordId: integer('lossRecordId'), operatorName: text('operatorName'), amount: text('amount').notNull(), paymentDate: text('paymentDate').notNull(), paymentMethod: text('paymentMethod').notNull(), feeType: text('feeType').notNull(), notes: text('notes'), createdAt: timestampMs('createdAt').notNull().default(now),
})

export const receivableBills = sqliteTable('receivable_bills', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), billNo: text('billNo').notNull(), periodStart: text('periodStart').notNull(), periodEnd: text('periodEnd').notNull(), dueDate: text('dueDate').notNull(), billType: text('billType').notNull().default('租金'), amount: text('amount').notNull(), paidAmount: text('paidAmount').notNull().default('0'), status: text('status').notNull().default('待收'), notes: text('notes'), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now),
}, (table) => [unique().on(table.userId, table.billNo)])

export const paymentAllocations = sqliteTable('payment_allocations', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), paymentRecordId: integer('paymentRecordId').notNull(), billId: integer('billId').notNull(), amount: text('amount').notNull(), createdAt: timestampMs('createdAt').notNull().default(now),
})

export const accountLedger = sqliteTable('account_ledger', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), entryType: text('entryType').notNull(), amount: text('amount').notNull(), entryDate: text('entryDate').notNull(), paymentRecordId: integer('paymentRecordId'), relatedEntryId: integer('relatedEntryId'), operatorName: text('operatorName').notNull(), notes: text('notes'), createdAt: timestampMs('createdAt').notNull().default(now),
})

export const rentalEvents = sqliteTable('rental_events', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), eventType: text('eventType').notNull(), status: text('status').notNull().default('已完成'), eventDate: text('eventDate').notNull(), itemId: integer('itemId'), beforeSnapshot: jsonText('beforeSnapshot'), afterSnapshot: jsonText('afterSnapshot'), reason: text('reason'), feeAdjustment: text('feeAdjustment').notNull().default('0'), repairCost: text('repairCost').notNull().default('0'), customerCharge: text('customerCharge').notNull().default('0'), faultDescription: text('faultDescription'), resolution: text('resolution'), completedDate: text('completedDate'), operatorName: text('operatorName').notNull(), notes: text('notes'), createdAt: timestampMs('createdAt').notNull().default(now),
})

export const returnRecords = sqliteTable('return_records', { id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), rentalItemId: integer('rentalItemId').notNull(), quantity: integer('quantity').notNull(), returnDate: text('returnDate').notNull(), condition: text('condition').notNull(), deductionAmount: text('deductionAmount').notNull().default('0'), depositRefund: text('depositRefund').notNull().default('0'), notes: text('notes'), operatorName: text('operatorName').notNull(), createdAt: timestampMs('createdAt').notNull().default(now) })
export const lossRecords = sqliteTable('loss_records', { id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull(), rentalItemId: integer('rentalItemId').notNull(), quantity: integer('quantity').notNull(), lossDate: text('lossDate').notNull(), unitCompensation: text('unitCompensation').notNull(), amount: text('amount').notNull(), notes: text('notes'), operatorName: text('operatorName').notNull(), createdAt: timestampMs('createdAt').notNull().default(now) })
export const businessSettings = sqliteTable('business_settings', { id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull().unique(), storeName: text('storeName'), lessorType: text('lessorType').notNull().default('企业'), lessorName: text('lessorName').notNull().default(''), identityNo: text('identityNo'), contactName: text('contactName'), phone: text('phone'), address: text('address'), paymentInfo: text('paymentInfo'), contractTerms: text('contractTerms'), themeMode: text('themeMode').notNull().default('system'), themeColor: text('themeColor').notNull().default('green'), updatedAt: timestampMs('updatedAt').notNull().default(now) })
export const contractSnapshots = sqliteTable('contract_snapshots', { id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), rentalId: integer('rentalId').notNull().unique(), customerType: text('customerType').notNull().default('个人'), customerIdentityNo: text('customerIdentityNo'), customerCompany: text('customerCompany'), customerCreditCode: text('customerCreditCode'), lessorJson: text('lessorJson').notNull(), customerJson: text('customerJson').notNull(), itemsJson: text('itemsJson').notNull(), terms: text('terms').notNull(), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now) })
export const organizationMembers = sqliteTable('organization_members', { id: integer('id').primaryKey({ autoIncrement: true }), ownerId: text('ownerId').notNull(), memberUserId: text('memberUserId').notNull().unique(), role: text('role').notNull().default('employee'), active: integer('active', { mode: 'boolean' }).notNull().default(true), permissions: text('permissions').notNull().default('rentals'), updatedAt: timestampMs('updatedAt').notNull().default(now) })

export const accountProfiles = sqliteTable('account_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull().unique(), role: text('role').notNull().default('employee'), phone: text('phone').unique(), recoveryPhone: text('recoveryPhone'), active: integer('active', { mode: 'boolean' }).notNull().default(true), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now),
})

export const adminApplications = sqliteTable('admin_applications', {
  id: integer('id').primaryKey({ autoIncrement: true }), name: text('name').notNull(), username: text('username').unique(), email: text('email').notNull(), phone: text('phone').notNull().unique(), passwordHash: text('passwordHash').notNull(), status: text('status').notNull().default('pending'), reviewedBy: text('reviewedBy'), reviewedAt: timestampMs('reviewedAt'), rejectionReason: text('rejectionReason'), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now),
})

export const websitePackages = sqliteTable('website_packages', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), name: text('name').notNull(), subtitle: text('subtitle').notNull().default(''), monthlyPrice: integer('monthlyPrice').notNull(), cpuSpec: text('cpuSpec').notNull().default(''), memorySpec: text('memorySpec').notNull().default(''), storageSpec: text('storageSpec').notNull().default(''), graphicsSpec: text('graphicsSpec').notNull().default(''), displaySpec: text('displaySpec').notNull().default(''), audience: text('audience').notNull().default(''), badge: text('badge').notNull().default(''), active: integer('active', { mode: 'boolean' }).notNull().default(true), sortOrder: integer('sortOrder').notNull().default(0), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now),
})

export const backupSnapshots = sqliteTable('backup_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), backupType: text('backupType').notNull().default('scheduled'), schemaVersion: integer('schemaVersion').notNull().default(1), recordCount: integer('recordCount').notNull().default(0), checksum: text('checksum').notNull(), payload: jsonText('payload').notNull(), status: text('status').notNull().default('ready'), createdAt: timestampMs('createdAt').notNull().default(now),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), actorUserId: text('actorUserId').notNull(), actorName: text('actorName').notNull(), action: text('action').notNull(), resourceType: text('resourceType').notNull(), resourceId: text('resourceId'), summary: text('summary').notNull(), metadata: jsonText('metadata').notNull().default({}), createdAt: timestampMs('createdAt').notNull().default(now),
})

export const customerPortals = sqliteTable('customer_portals', {
  id: integer('id').primaryKey({ autoIncrement: true }), userId: text('userId').notNull(), phone: text('phone').notNull(), customerName: text('customerName').notNull(), accessTokenHash: text('accessTokenHash').notNull().unique(), passwordHash: text('passwordHash').notNull(), status: text('status').notNull().default('active'), failedAttempts: integer('failedAttempts').notNull().default(0), lockedUntil: timestampMs('lockedUntil'), sessionVersion: integer('sessionVersion').notNull().default(1), lastLoginAt: timestampMs('lastLoginAt'), createdAt: timestampMs('createdAt').notNull().default(now), updatedAt: timestampMs('updatedAt').notNull().default(now),
}, (table) => [unique().on(table.userId, table.phone)])

export const customerOtpChallenges = sqliteTable('customer_otp_challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestampMs('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumedAt: timestampMs('consumed_at'),
  requestIpHash: text('request_ip_hash').notNull(),
  createdAt: timestampMs('created_at').notNull().default(now),
})

export const passwordChangeChallenges = sqliteTable('password_change_challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectType: text('subject_type').notNull(),
  subjectId: text('subject_id').notNull(),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestampMs('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumedAt: timestampMs('consumed_at'),
  requestIpHash: text('request_ip_hash').notNull(),
  createdAt: timestampMs('created_at').notNull().default(now),
}, (table) => [index('password_change_subject_idx').on(table.subjectType, table.subjectId), index('password_change_phone_created_idx').on(table.phone, table.createdAt)])

export const customerPhoneSessions = sqliteTable('customer_phone_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phone: text('phone').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestampMs('expires_at').notNull(),
  createdAt: timestampMs('created_at').notNull().default(now),
  lastSeenAt: timestampMs('last_seen_at').notNull().default(now),
})

export type Rental = typeof rentals.$inferSelect
export type RentalItem = typeof rentalItems.$inferSelect
export type BuyoutRecord = typeof buyoutRecords.$inferSelect
export type RenewalRecord = typeof renewalRecords.$inferSelect
export type PaymentRecord = typeof paymentRecords.$inferSelect
export type RentalEvent = typeof rentalEvents.$inferSelect
export type ReceivableBill = typeof receivableBills.$inferSelect
export type PaymentAllocation = typeof paymentAllocations.$inferSelect
export type AccountLedgerEntry = typeof accountLedger.$inferSelect
export type CustomerPortal = typeof customerPortals.$inferSelect
