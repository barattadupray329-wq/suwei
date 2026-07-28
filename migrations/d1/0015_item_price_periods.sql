CREATE TABLE `rental_item_price_periods` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `rentalId` integer NOT NULL,
  `rentalItemId` integer NOT NULL,
  `sourceRentalItemId` integer NOT NULL,
  `deviceCodes` text NOT NULL,
  `quantity` integer NOT NULL,
  `effectiveDate` text NOT NULL,
  `previousMonthlyRent` text NOT NULL,
  `newMonthlyRent` text NOT NULL,
  `proratedDifference` text NOT NULL DEFAULT '0',
  `reason` text NOT NULL,
  `operatorUserId` text NOT NULL,
  `operatorName` text NOT NULL,
  `createdAt` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `rental_item_price_periods_user_rental_idx` ON `rental_item_price_periods` (`userId`,`rentalId`);
--> statement-breakpoint
CREATE INDEX `rental_item_price_periods_item_effective_idx` ON `rental_item_price_periods` (`rentalItemId`,`effectiveDate`);
