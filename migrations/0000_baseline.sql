CREATE TABLE IF NOT EXISTS `account` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `account_ledger` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `account_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`phone` text,
	`recoveryPhone` text,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `account_profiles_userId_unique` ON `account_profiles` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `account_profiles_phone_unique` ON `account_profiles` (`phone`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`passwordHash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewedBy` text,
	`reviewedAt` integer,
	`rejectionReason` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `admin_applications_username_unique` ON `admin_applications` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `admin_applications_phone_unique` ON `admin_applications` (`phone`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `backup_snapshots` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `business_settings` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `business_settings_userId_unique` ON `business_settings` (`userId`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `buyout_records` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `contract_snapshots` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `contract_snapshots_rentalId_unique` ON `contract_snapshots` (`rentalId`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customer_otp_challenges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`request_ip_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customer_phone_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customer_phone_sessions_token_hash_unique` ON `customer_phone_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customer_portals` (
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
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customer_portals_accessTokenHash_unique` ON `customer_portals` (`accessTokenHash`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customer_portals_userId_phone_unique` ON `customer_portals` (`userId`,`phone`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `loss_records` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organization_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ownerId` text NOT NULL,
	`memberUserId` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`permissions` text DEFAULT 'rentals' NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `organization_members_memberUserId_unique` ON `organization_members` (`memberUserId`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `password_change_challenges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer,
	`request_ip_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `password_change_subject_idx` ON `password_change_challenges` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `password_change_phone_created_idx` ON `password_change_challenges` (`phone`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`rentalId` integer NOT NULL,
	`paymentRecordId` integer NOT NULL,
	`billId` integer NOT NULL,
	`amount` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment_records` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `receivable_bills` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `receivable_bills_userId_billNo_unique` ON `receivable_bills` (`userId`,`billNo`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `renewal_records` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rental_events` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rental_items` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rentals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`assignedEmployeeId` text,
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
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`assignedEmployeeId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `rentals_assigned_employee_idx` ON `rentals` (`assignedEmployeeId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `rentals_customer_phone_idx` ON `rentals` (`customerPhone`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `rentals_userId_contractNo_unique` ON `rentals` (`userId`,`contractNo`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `return_records` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `session` (
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`username` text,
	`displayUsername` text,
	`phoneNumber` text,
	`phoneNumberVerified` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_phoneNumber_unique` ON `user` (`phoneNumber`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000),
	`updatedAt` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `website_packages` (
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
