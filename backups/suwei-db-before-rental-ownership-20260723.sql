PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0000_greedy_norrin_radd.sql','2026-07-22 08:57:02');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0001_unified_login.sql','2026-07-22 14:03:30');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0002_multi_shop.sql','2026-07-22 15:53:50');
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO "account" ("id","accountId","providerId","userId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","createdAt","updatedAt") VALUES('2813428f-f04a-4b3e-a5fe-aabc33d23a75','46381639-3712-475f-9998-27d4d5b9d88a','credential','46381639-3712-475f-9998-27d4d5b9d88a',NULL,NULL,NULL,NULL,NULL,NULL,'b980c0c1598eff88e72d32ad830914cb:03cd817ff605900980ab43907b1fa407a62435ad2adb23bc3c1ebd47741f4850968f3285cdd09caff869e7d7fb56ea4bbea56a2b6b4d2cb8d8da4449716dd0bf',1784716390337,1784716390337);
INSERT INTO "account" ("id","accountId","providerId","userId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","createdAt","updatedAt") VALUES('d5a3bedc-9cf0-42af-8aa7-12bdefb2936b','c7e71d61-a737-4d42-a042-55d2edffa0fe','credential','c7e71d61-a737-4d42-a042-55d2edffa0fe',NULL,NULL,NULL,NULL,NULL,NULL,'b140d6fda66715f5de714048914a787a:3f3e02ae19f4686f090191e4bedbe52f4600ebeaa4991e7b30b1125e2a18f5d463ee1c40c256bce7bea69077c3cc015b1ba2b46641e29a4d365a1cfde0139c01',1784744757503,1784744757503);
CREATE TABLE `account_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`entryType` text NOT NULL,
	`amount` text NOT NULL,
	`entryDate` text NOT NULL,
	`paymentRecordId` integer,
	`relatedEntryId` integer,
	`operatorName` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `account_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`phone` text,
	`recoveryPhone` text,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO "account_profiles" ("id","userId","role","phone","recoveryPhone","active","createdAt","updatedAt") VALUES(1,'46381639-3712-475f-9998-27d4d5b9d88a','super_admin','18039808323',NULL,1,1784716390337,1784733256000);
INSERT INTO "account_profiles" ("id","userId","role","phone","recoveryPhone","active","createdAt","updatedAt") VALUES(2,'c7e71d61-a737-4d42-a042-55d2edffa0fe','admin','18046476181',NULL,1,1784744757503,1784744757503);
CREATE TABLE `admin_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`passwordHash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewedBy` text,
	`reviewedAt` integer,
	`rejectionReason` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
, shopName TEXT);
INSERT INTO "admin_applications" ("id","name","email","phone","passwordHash","status","reviewedBy","reviewedAt","rejectionReason","createdAt","updatedAt","shopName") VALUES(1,'速维电脑','swdn1234','18046476181','b140d6fda66715f5de714048914a787a:3f3e02ae19f4686f090191e4bedbe52f4600ebeaa4991e7b30b1125e2a18f5d463ee1c40c256bce7bea69077c3cc015b1ba2b46641e29a4d365a1cfde0139c01','approved','46381639-3712-475f-9998-27d4d5b9d88a',1784744757503,NULL,1784744732000,1784744757503,'速维电脑');
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`actorUserId` text NOT NULL,
	`actorName` text NOT NULL,
	`action` text NOT NULL,
	`resourceType` text NOT NULL,
	`resourceId` text,
	`summary` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO "audit_logs" ("id","userId","actorUserId","actorName","action","resourceType","resourceId","summary","metadata","createdAt") VALUES(1,'c7e71d61-a737-4d42-a042-55d2edffa0fe','46381639-3712-475f-9998-27d4d5b9d88a','超级管理员','创建','租赁合同','1','创建合同 HT20260722-001（连俊文）','{"totalRent":300,"quantity":1,"source":"customer-portal-test"}',1784717888000);
CREATE TABLE `backup_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`backupType` text DEFAULT 'scheduled' NOT NULL,
	`schemaVersion` integer DEFAULT 1 NOT NULL,
	`recordCount` integer DEFAULT 0 NOT NULL,
	`checksum` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO "backup_snapshots" ("id","userId","backupType","schemaVersion","recordCount","checksum","payload","status","createdAt") VALUES(1,'46381639-3712-475f-9998-27d4d5b9d88a','daily:2026-07-22',1,0,'9b3008d9ef36c2763670575e997649107ca4de00b6f690ebe08bc60831d52f66','{"format":"suwei-rental-backup","schemaVersion":1,"createdAt":"2026-07-22T10:54:24.565Z","userId":"46381639-3712-475f-9998-27d4d5b9d88a","tables":{"rentals":[],"rentalItems":[],"buyoutRecords":[],"renewalRecords":[],"paymentRecords":[],"receivableBills":[],"paymentAllocations":[],"accountLedger":[],"rentalEvents":[],"returnRecords":[],"lossRecords":[],"businessSettings":[],"contractSnapshots":[],"customerPortals":[]}}','ready',1784717664000);
INSERT INTO "backup_snapshots" ("id","userId","backupType","schemaVersion","recordCount","checksum","payload","status","createdAt") VALUES(2,'c7e71d61-a737-4d42-a042-55d2edffa0fe','daily:2026-07-23',1,1,'2ebbfe41d1aefbaba7245c6065a7a0b94b84a1be936d19ab2745c811bba6cf7b','{"format":"suwei-rental-backup","schemaVersion":1,"createdAt":"2026-07-22T18:26:38.276Z","userId":"c7e71d61-a737-4d42-a042-55d2edffa0fe","tables":{"rentals":[],"rentalItems":[],"buyoutRecords":[],"renewalRecords":[],"paymentRecords":[],"receivableBills":[],"paymentAllocations":[],"accountLedger":[],"rentalEvents":[],"returnRecords":[],"lossRecords":[],"businessSettings":[{"id":1,"userId":"c7e71d61-a737-4d42-a042-55d2edffa0fe","storeName":"速维电脑","lessorType":"企业","lessorName":"","identityNo":null,"contactName":null,"phone":null,"address":null,"paymentInfo":null,"contractTerms":null,"themeMode":"system","themeColor":"green","updatedAt":"2026-07-22T18:25:57.503Z"}],"contractSnapshots":[],"customerPortals":[]}}','ready',1784744798000);
CREATE TABLE `business_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`storeName` text,
	`lessorType` text DEFAULT '企业' NOT NULL,
	`lessorName` text DEFAULT '' NOT NULL,
	`identityNo` text,
	`contactName` text,
	`phone` text,
	`address` text,
	`paymentInfo` text,
	`contractTerms` text,
	`themeMode` text DEFAULT 'system' NOT NULL,
	`themeColor` text DEFAULT 'green' NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO "business_settings" ("id","userId","storeName","lessorType","lessorName","identityNo","contactName","phone","address","paymentInfo","contractTerms","themeMode","themeColor","updatedAt") VALUES(1,'c7e71d61-a737-4d42-a042-55d2edffa0fe','速维电脑','企业','',NULL,NULL,NULL,NULL,NULL,NULL,'system','green',1784744757503);
CREATE TABLE `buyout_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`rentalItemId` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unitPrice` text NOT NULL,
	`amount` text NOT NULL,
	`buyoutDate` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `contract_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`customerType` text DEFAULT '个人' NOT NULL,
	`customerIdentityNo` text,
	`customerCompany` text,
	`customerCreditCode` text,
	`lessorJson` text NOT NULL,
	`customerJson` text NOT NULL,
	`itemsJson` text NOT NULL,
	`terms` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `customer_otp_challenges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`request_ip_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO "customer_otp_challenges" ("id","phone","code_hash","expires_at","attempts","consumed_at","request_ip_hash","created_at") VALUES(6,'18039808323','768da9110e930ee69a10a4eeea05c48993fbdf18d3c3e5200b9dd38af6553944',1784744040216,0,1784743755922,'6dcabe69e0045b171907675dc75256b620eca6db662869fe82375a23dd191f51',1784743740000);
INSERT INTO "customer_otp_challenges" ("id","phone","code_hash","expires_at","attempts","consumed_at","request_ip_hash","created_at") VALUES(7,'18046476181','b74eda0e20a4499ba3125585f162d13e031516fcf467e6c79cfc04174f6783c4',1784745079885,0,1784744796310,'6dcabe69e0045b171907675dc75256b620eca6db662869fe82375a23dd191f51',1784744780000);
INSERT INTO "customer_otp_challenges" ("id","phone","code_hash","expires_at","attempts","consumed_at","request_ip_hash","created_at") VALUES(8,'18046476181','f96fd08d0ae5e298fb13a0e69ca129b1ee00caaeed3e5a384204771f76d597da',1784745487343,0,1784745210709,'6dcabe69e0045b171907675dc75256b620eca6db662869fe82375a23dd191f51',1784745187000);
INSERT INTO "customer_otp_challenges" ("id","phone","code_hash","expires_at","attempts","consumed_at","request_ip_hash","created_at") VALUES(9,'18046476181','61df4cf30d77f820d5740e11a4cd0b5d68dac078989c383fd3eefc1872fd045e',1784745639036,0,1784745349929,'6dcabe69e0045b171907675dc75256b620eca6db662869fe82375a23dd191f51',1784745339000);
CREATE TABLE `customer_phone_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
, shop_id TEXT);
INSERT INTO "customer_phone_sessions" ("id","phone","token_hash","expires_at","created_at","last_seen_at","shop_id") VALUES(3,'18039808323','113141abf693758c13b730370fbbf2c79f8e13d900eca65a2f485fc4c773dfba',1784768588246,1784725389000,1784725389000,NULL);
CREATE TABLE `customer_portals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`phone` text NOT NULL,
	`customerName` text NOT NULL,
	`accessTokenHash` text NOT NULL,
	`passwordHash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`failedAttempts` integer DEFAULT 0 NOT NULL,
	`lockedUntil` integer,
	`sessionVersion` integer DEFAULT 1 NOT NULL,
	`lastLoginAt` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
, assigneeUserId TEXT);
INSERT INTO "customer_portals" ("id","userId","phone","customerName","accessTokenHash","passwordHash","status","failedAttempts","lockedUntil","sessionVersion","lastLoginAt","createdAt","updatedAt","assigneeUserId") VALUES(1,'c7e71d61-a737-4d42-a042-55d2edffa0fe','18039808323','连俊文','dbb437846465768781a339bffa246858fac0aed4ec38e25a7b7432d01295d3cd','ced187efbd45b9da501b1754272ee762:96d5d3c4c1672e099833f499592fd5e3d65b3fde82e097d5675dc6bc597356e80242d54c44a14575ab89051b67acd4a0395fcc7ba0d0eafcba87fe3fbf2ee4ed','active',0,NULL,6,1784743755922,1784717888000,1784743755922,'c7e71d61-a737-4d42-a042-55d2edffa0fe');
CREATE TABLE `loss_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`rentalItemId` integer NOT NULL,
	`quantity` integer NOT NULL,
	`lossDate` text NOT NULL,
	`unitCompensation` text NOT NULL,
	`amount` text NOT NULL,
	`notes` text,
	`operatorName` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `organization_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ownerId` text NOT NULL,
	`memberUserId` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`permissions` text DEFAULT 'rentals' NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
, shopId TEXT);
CREATE TABLE `payment_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`paymentRecordId` integer NOT NULL,
	`billId` integer NOT NULL,
	`amount` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `payment_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`renewalRecordId` integer,
	`buyoutRecordId` integer,
	`returnRecordId` integer,
	`lossRecordId` integer,
	`operatorName` text,
	`amount` text NOT NULL,
	`paymentDate` text NOT NULL,
	`paymentMethod` text NOT NULL,
	`feeType` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `receivable_bills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`billNo` text NOT NULL,
	`periodStart` text NOT NULL,
	`periodEnd` text NOT NULL,
	`dueDate` text NOT NULL,
	`billType` text DEFAULT '租金' NOT NULL,
	`amount` text NOT NULL,
	`paidAmount` text DEFAULT '0' NOT NULL,
	`status` text DEFAULT '待收' NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO "receivable_bills" ("id","userId","rentalId","billNo","periodStart","periodEnd","dueDate","billType","amount","paidAmount","status","notes","createdAt","updatedAt") VALUES(1,'c7e71d61-a737-4d42-a042-55d2edffa0fe',1,'HT20260722-001-001','2026-07-22','2026-08-20','2026-07-22','日租租金','300.00','0','待收',NULL,1784717888000,1784717888000);
INSERT INTO "receivable_bills" ("id","userId","rentalId","billNo","periodStart","periodEnd","dueDate","billType","amount","paidAmount","status","notes","createdAt","updatedAt") VALUES(2,'c7e71d61-a737-4d42-a042-55d2edffa0fe',1,'HT20260722-001-DEP','2026-07-22','2026-07-22','2026-07-22','押金','500.00','0','待收',NULL,1784717888000,1784717888000);
CREATE TABLE `renewal_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`sourceRentalItemId` integer NOT NULL,
	`renewedRentalItemId` integer NOT NULL,
	`quantity` integer NOT NULL,
	`renewalMonths` integer,
	`billingUnit` text,
	`duration` integer,
	`unitPrice` text,
	`oldMonthlyRent` text NOT NULL,
	`newMonthlyRent` text NOT NULL,
	`oldEndDate` text NOT NULL,
	`newEndDate` text NOT NULL,
	`renewalAmount` text DEFAULT '0' NOT NULL,
	`renewalDate` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `rental_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`eventType` text NOT NULL,
	`status` text DEFAULT '已完成' NOT NULL,
	`eventDate` text NOT NULL,
	`itemId` integer,
	`beforeSnapshot` text,
	`afterSnapshot` text,
	`reason` text,
	`feeAdjustment` text DEFAULT '0' NOT NULL,
	`repairCost` text DEFAULT '0' NOT NULL,
	`customerCharge` text DEFAULT '0' NOT NULL,
	`faultDescription` text,
	`resolution` text,
	`completedDate` text,
	`operatorName` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `rental_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`deviceName` text NOT NULL,
	`deviceType` text DEFAULT '台式机' NOT NULL,
	`deviceCode` text,
	`deviceConfig` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`startDate` text,
	`endDate` text,
	`monthlyRent` text DEFAULT '0' NOT NULL,
	`totalRent` text DEFAULT '0' NOT NULL,
	`boughtOutQuantity` integer DEFAULT 0 NOT NULL,
	`returnedQuantity` integer DEFAULT 0 NOT NULL,
	`lostQuantity` integer DEFAULT 0 NOT NULL,
	`buyoutAmount` text DEFAULT '0' NOT NULL,
	`cpu` text,
	`motherboard` text,
	`memory` text,
	`storage` text,
	`graphicsCard` text,
	`powerSupply` text,
	`caseModel` text,
	`monitorInfo` text,
	`screenSize` text,
	`screenResolution` text,
	`refreshRate` text,
	`panelType` text,
	`ports` text,
	`batteryInfo` text,
	`adapterInfo` text,
	`accessories` text,
	`colorGamut` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO "rental_items" ("id","userId","rentalId","deviceName","deviceType","deviceCode","deviceConfig","quantity","startDate","endDate","monthlyRent","totalRent","boughtOutQuantity","returnedQuantity","lostQuantity","buyoutAmount","cpu","motherboard","memory","storage","graphicsCard","powerSupply","caseModel","monitorInfo","screenSize","screenResolution","refreshRate","panelType","ports","batteryInfo","adapterInfo","accessories","colorGamut","createdAt","updatedAt") VALUES(1,'c7e71d61-a737-4d42-a042-55d2edffa0fe',1,'测试设备 A','其他','DEV20260722-001','客户门户测试设备',1,'2026-07-22','2026-08-20','10.00','300.00',0,0,0,'0',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1784717888000,1784717888000);
CREATE TABLE `rentals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`contractNo` text NOT NULL,
	`customer_company` text,
	`customerName` text NOT NULL,
	`customerPhone` text NOT NULL,
	`customerAddress` text,
	`deviceName` text NOT NULL,
	`deviceType` text DEFAULT '台式机' NOT NULL,
	`deviceConfig` text,
	`deviceCode` text,
	`cpu` text,
	`motherboard` text,
	`memory` text,
	`storage` text,
	`graphicsCard` text,
	`powerSupply` text,
	`caseModel` text,
	`monitorInfo` text,
	`screenSize` text,
	`screenResolution` text,
	`refreshRate` text,
	`panelType` text,
	`ports` text,
	`batteryInfo` text,
	`adapterInfo` text,
	`accessories` text,
	`colorGamut` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`startDate` text NOT NULL,
	`endDate` text NOT NULL,
	`monthlyRent` text DEFAULT '0' NOT NULL,
	`totalRent` text DEFAULT '0' NOT NULL,
	`deposit` text DEFAULT '0' NOT NULL,
	`paidAmount` text DEFAULT '0' NOT NULL,
	`paymentStatus` text DEFAULT '待收款' NOT NULL,
	`status` text DEFAULT '在租' NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
INSERT INTO "rentals" ("id","userId","contractNo","customer_company","customerName","customerPhone","customerAddress","deviceName","deviceType","deviceConfig","deviceCode","cpu","motherboard","memory","storage","graphicsCard","powerSupply","caseModel","monitorInfo","screenSize","screenResolution","refreshRate","panelType","ports","batteryInfo","adapterInfo","accessories","colorGamut","quantity","startDate","endDate","monthlyRent","totalRent","deposit","paidAmount","paymentStatus","status","notes","createdAt","updatedAt") VALUES(1,'c7e71d61-a737-4d42-a042-55d2edffa0fe','HT20260722-001',NULL,'连俊文','18039808323',NULL,'测试设备 A','其他',NULL,'DEV20260722-001',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-07-22','2026-08-20','10.00','300.00','500.00','0','待收款','在租','计费方式：日租；租赁时间：30天；客户短信查询测试',1784717888000,1784717888000);
CREATE TABLE `return_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`rentalItemId` integer NOT NULL,
	`quantity` integer NOT NULL,
	`returnDate` text NOT NULL,
	`condition` text NOT NULL,
	`deductionAmount` text DEFAULT '0' NOT NULL,
	`depositRefund` text DEFAULT '0' NOT NULL,
	`notes` text,
	`operatorName` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('WWXCRPVUKjTQqJZHhiINUFx1Ccgop1zx',1784802808266,'5DwNfKaj0NlLuVSI58nlMt5OogQy2KKe',1784716408266,1784716408266,'','node','46381639-3712-475f-9998-27d4d5b9d88a');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('jrf70D1NI1uwWoNLZ3OhNU1BQtb2YIIZ',1785321239835,'ZVDBOjI68Y8eMxa4VlvYE2Ho9TltH5O2',1784716439835,1784716439835,'','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 QuarkPC/6.9.8.899','46381639-3712-475f-9998-27d4d5b9d88a');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('sYgzQNEVgBTE9IXsIjKJZSPjgsFBKE5e',1785321657011,'oxEFog9GiMqv06TmDlevE8j8nXhSIVqC',1784716857011,1784716857011,'','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0','46381639-3712-475f-9998-27d4d5b9d88a');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('yOT8TSJxm1CcMsgCiozk2rFRMpG1ySpb',1785321683072,'kereyWcBQJJqdV5NYjPbVWllu1B9xHvb',1784716883072,1784716883072,'','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36','46381639-3712-475f-9998-27d4d5b9d88a');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('Q9G3VFgrahZuIY7R1WW4YirMGDu73SnK',1785322591315,'5OhfkbWWF9CQ309Vf6lPHFdzyaeDeINc',1784717791315,1784717791315,'','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0','46381639-3712-475f-9998-27d4d5b9d88a');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('mT1aCTXjQe2PtPlPXy4kZDRAfyPcdR8p',1785325009236,'DE3JnZdDYatmPXsNZHIAFbrKAgKq8X7m',1784720209236,1784720209236,'','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 QuarkPC/6.9.8.899','46381639-3712-475f-9998-27d4d5b9d88a');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('PMXb6JSeLVDep8R5U1kroEEG59RPrtcn',1785337908041,'t7n1f0pWV8koFyUqiBp3l2c3Oj1Z10SC',1784733108041,1784733108041,'','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36 EdgA/149.0.0.0','46381639-3712-475f-9998-27d4d5b9d88a');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('8a03e7bb-778c-49f1-9fe0-17ac52f9dc27',1785348555922,'nEh9g4N1vqswJg0_gYARLRuuxxfxEWJy9x9QkteBaiM',1784743755922,1784743755922,NULL,NULL,'46381639-3712-475f-9998-27d4d5b9d88a');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('2376ed47-285d-4bab-be99-5f15655170d5',1785350010709,'G29dUyBcJXfNUanDI2zh3urFUfibfTn_DO9OXUAcj0Y',1784745210709,1784745210709,NULL,NULL,'c7e71d61-a737-4d42-a042-55d2edffa0fe');
INSERT INTO "session" ("id","expiresAt","token","createdAt","updatedAt","ipAddress","userAgent","userId") VALUES('cb0362f1-1011-49a2-b598-2af963969f1a',1785350149929,'jF-Q6IP-PGe-NPlbROxEqEtNdk4rGJjT7aRWRLOWvps',1784745349929,1784745349929,NULL,NULL,'c7e71d61-a737-4d42-a042-55d2edffa0fe');
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
, username TEXT, displayUsername TEXT, phoneNumber TEXT, phoneNumberVerified INTEGER NOT NULL DEFAULT 0);
INSERT INTO "user" ("id","name","email","emailVerified","image","createdAt","updatedAt","username","displayUsername","phoneNumber","phoneNumberVerified") VALUES('46381639-3712-475f-9998-27d4d5b9d88a','超级管理员连','625730448@qq.com',1,NULL,1784716390337,1784733256000,'625730448@qq.com','625730448@qq.com','18039808323',1);
INSERT INTO "user" ("id","name","email","emailVerified","image","createdAt","updatedAt","username","displayUsername","phoneNumber","phoneNumberVerified") VALUES('c7e71d61-a737-4d42-a042-55d2edffa0fe','速维电脑','c7e71d61-a737-4d42-a042-55d2edffa0fe@account.local',0,NULL,1784744757503,1784744757503,'swdn1234','swdn1234','18046476181',1);
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000),
	`updatedAt` integer DEFAULT (unixepoch() * 1000)
);
CREATE TABLE `website_packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`monthlyPrice` integer NOT NULL,
	`cpuSpec` text DEFAULT '' NOT NULL,
	`memorySpec` text DEFAULT '' NOT NULL,
	`storageSpec` text DEFAULT '' NOT NULL,
	`graphicsSpec` text DEFAULT '' NOT NULL,
	`displaySpec` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`badge` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE shops (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  ownerUserId TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
INSERT INTO "shops" ("id","name","ownerUserId","status","createdAt","updatedAt") VALUES('c7e71d61-a737-4d42-a042-55d2edffa0fe','速维电脑','c7e71d61-a737-4d42-a042-55d2edffa0fe','active',1784744757503,1784744757503);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',3);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('account_profiles',2);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('backup_snapshots',2);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('rentals',1);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('rental_items',1);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('receivable_bills',2);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('customer_portals',1);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('audit_logs',1);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('customer_otp_challenges',9);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('customer_phone_sessions',4);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('admin_applications',1);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('business_settings',1);
CREATE UNIQUE INDEX `account_profiles_userId_unique` ON `account_profiles` (`userId`);
CREATE UNIQUE INDEX `account_profiles_phone_unique` ON `account_profiles` (`phone`);
CREATE UNIQUE INDEX `business_settings_userId_unique` ON `business_settings` (`userId`);
CREATE UNIQUE INDEX `contract_snapshots_rentalId_unique` ON `contract_snapshots` (`rentalId`);
CREATE UNIQUE INDEX `customer_phone_sessions_token_hash_unique` ON `customer_phone_sessions` (`token_hash`);
CREATE UNIQUE INDEX `customer_portals_accessTokenHash_unique` ON `customer_portals` (`accessTokenHash`);
CREATE UNIQUE INDEX `customer_portals_userId_phone_unique` ON `customer_portals` (`userId`,`phone`);
CREATE UNIQUE INDEX `organization_members_memberUserId_unique` ON `organization_members` (`memberUserId`);
CREATE UNIQUE INDEX `receivable_bills_userId_billNo_unique` ON `receivable_bills` (`userId`,`billNo`);
CREATE UNIQUE INDEX `rentals_userId_contractNo_unique` ON `rentals` (`userId`,`contractNo`);
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
CREATE UNIQUE INDEX user_username_unique ON user(username);
CREATE UNIQUE INDEX user_phone_number_unique ON user(phoneNumber);
CREATE INDEX organization_members_shop_idx ON organization_members(shopId);
CREATE INDEX customer_portals_shop_phone_idx ON customer_portals(userId, phone);
CREATE INDEX customer_phone_sessions_shop_phone_idx ON customer_phone_sessions(shop_id, phone);
