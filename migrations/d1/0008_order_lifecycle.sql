ALTER TABLE `rentals` ADD COLUMN `orderType` text NOT NULL DEFAULT 'official';
ALTER TABLE `rentals` ADD COLUMN `lifecycleStatus` text NOT NULL DEFAULT 'active';
ALTER TABLE `rentals` ADD COLUMN `confirmedAt` integer;
ALTER TABLE `rentals` ADD COLUMN `confirmedBy` text;
ALTER TABLE `rentals` ADD COLUMN `deletedAt` integer;
ALTER TABLE `rentals` ADD COLUMN `deletedBy` text;
ALTER TABLE `rentals` ADD COLUMN `deleteReason` text;

UPDATE `rentals`
SET `orderType` = 'official',
    `lifecycleStatus` = 'active',
    `confirmedAt` = COALESCE(`confirmedAt`, `createdAt`),
    `confirmedBy` = COALESCE(`confirmedBy`, `sourceUserId`, `userId`)
WHERE `orderType` IS NULL OR `orderType` = 'official';

CREATE INDEX IF NOT EXISTS `idx_rentals_user_lifecycle_created` ON `rentals` (`userId`, `lifecycleStatus`, `createdAt` DESC);
CREATE INDEX IF NOT EXISTS `idx_rentals_user_type_lifecycle` ON `rentals` (`userId`, `orderType`, `lifecycleStatus`);
CREATE INDEX IF NOT EXISTS `idx_rentals_user_deleted` ON `rentals` (`userId`, `deletedAt`);
