ALTER TABLE `customer_portals` ADD COLUMN `customerLevel` text NOT NULL DEFAULT 'silver';
--> statement-breakpoint
ALTER TABLE `customer_portals` ADD COLUMN `levelNote` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_customer_portals_user_level` ON `customer_portals` (`userId`, `customerLevel`, `status`);
