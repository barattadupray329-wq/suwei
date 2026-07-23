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
