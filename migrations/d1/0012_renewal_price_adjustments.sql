CREATE TABLE IF NOT EXISTS `renewal_adjustments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `rentalId` integer NOT NULL,
  `renewalRecordId` integer NOT NULL,
  `previousUnitPrice` text NOT NULL,
  `correctedUnitPrice` text NOT NULL,
  `previousAmount` text NOT NULL,
  `correctedAmount` text NOT NULL,
  `differenceAmount` text NOT NULL,
  `reason` text NOT NULL,
  `operatorUserId` text NOT NULL,
  `operatorName` text NOT NULL,
  `createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE INDEX IF NOT EXISTS `renewal_adjustments_user_renewal_idx` ON `renewal_adjustments` (`userId`, `renewalRecordId`);
CREATE INDEX IF NOT EXISTS `renewal_adjustments_user_rental_idx` ON `renewal_adjustments` (`userId`, `rentalId`);
