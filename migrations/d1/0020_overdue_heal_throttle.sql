CREATE TABLE `overdue_heal_throttle` (
	`userId` text PRIMARY KEY NOT NULL,
	`lastHealAt` integer NOT NULL
);
