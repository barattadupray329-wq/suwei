CREATE TABLE `ai_usage_daily` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `usageDate` text NOT NULL,
  `requests` integer DEFAULT 0 NOT NULL,
  `estimatedNeurons` integer DEFAULT 0 NOT NULL,
  `updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_daily_user_date_unique` ON `ai_usage_daily` (`userId`,`usageDate`);
