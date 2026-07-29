CREATE TABLE `payment_discounts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `rentalId` integer NOT NULL,
  `paymentRecordId` integer NOT NULL,
  `amount` text NOT NULL,
  `reason` text NOT NULL,
  `reversedAt` integer,
  `createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  CONSTRAINT `payment_discounts_paymentRecordId_unique` UNIQUE(`paymentRecordId`)
);
--> statement-breakpoint
CREATE INDEX `payment_discounts_user_rental_idx` ON `payment_discounts` (`userId`,`rentalId`);
