ALTER TABLE `renewal_records` ADD `status` text DEFAULT '有效' NOT NULL;
--> statement-breakpoint
ALTER TABLE `renewal_records` ADD `reversedAt` integer;
--> statement-breakpoint
ALTER TABLE `renewal_records` ADD `reversedBy` text;
--> statement-breakpoint
ALTER TABLE `renewal_records` ADD `reversalReason` text;
--> statement-breakpoint
ALTER TABLE `receivable_bills` ADD `renewalRecordId` integer;
--> statement-breakpoint
ALTER TABLE `receivable_bills` ADD `reversedAt` integer;
--> statement-breakpoint
UPDATE `receivable_bills`
SET `renewalRecordId` = CAST(substr(`billNo`, length('RENEW-' || `rentalId` || '-') + 1) AS integer)
WHERE `billNo` LIKE 'RENEW-' || `rentalId` || '-%'
  AND `billNo` NOT LIKE 'RENEW-ADJ-%';
--> statement-breakpoint
UPDATE `receivable_bills`
SET `renewalRecordId` = CAST(substr(`billNo`, length('RENEW-ADJ-') + 1, instr(substr(`billNo`, length('RENEW-ADJ-') + 1), '-') - 1) AS integer)
WHERE `billNo` LIKE 'RENEW-ADJ-%';
--> statement-breakpoint
CREATE INDEX `renewal_records_user_rental_status_idx` ON `renewal_records` (`userId`,`rentalId`,`status`);
--> statement-breakpoint
CREATE INDEX `receivable_bills_user_renewal_idx` ON `receivable_bills` (`userId`,`renewalRecordId`);
