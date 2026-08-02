CREATE TABLE IF NOT EXISTS `return_settlements` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `rentalId` integer NOT NULL,
  `returnRecordId` integer NOT NULL,
  `customerPhone` text NOT NULL,
  `calculatedRefund` text DEFAULT '0' NOT NULL,
  `minimumTermMet` integer DEFAULT false NOT NULL,
  `finalRefund` text DEFAULT '0' NOT NULL,
  `handlingType` text NOT NULL,
  `refundStatus` text DEFAULT '无需退款' NOT NULL,
  `refundMethod` text,
  `refundDate` text,
  `reason` text,
  `operatorName` text NOT NULL,
  `createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `return_settlements_user_return_idx` ON `return_settlements` (`userId`, `returnRecordId`);
CREATE INDEX IF NOT EXISTS `return_settlements_user_rental_idx` ON `return_settlements` (`userId`, `rentalId`);

CREATE TABLE IF NOT EXISTS `customer_credit_ledger` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `customerPhone` text NOT NULL,
  `sourceRentalId` integer NOT NULL,
  `returnSettlementId` integer,
  `entryType` text NOT NULL,
  `amount` text NOT NULL,
  `entryDate` text NOT NULL,
  `operatorName` text NOT NULL,
  `notes` text,
  `createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE INDEX IF NOT EXISTS `customer_credit_user_phone_idx` ON `customer_credit_ledger` (`userId`, `customerPhone`);
CREATE INDEX IF NOT EXISTS `customer_credit_user_rental_idx` ON `customer_credit_ledger` (`userId`, `sourceRentalId`);
