CREATE TABLE IF NOT EXISTS `rental_price_periods` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `rental_id` integer NOT NULL,
  `rental_item_id` integer NOT NULL,
  `start_period` integer NOT NULL,
  `end_period` integer NOT NULL,
  `effective_start` text NOT NULL,
  `effective_end_exclusive` text NOT NULL,
  `quantity` integer NOT NULL,
  `unit_price` text NOT NULL,
  `source` text DEFAULT 'renewal' NOT NULL,
  `notes` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  CHECK (`start_period` > 0),
  CHECK (`end_period` >= `start_period`),
  CHECK (`quantity` > 0)
);
CREATE INDEX IF NOT EXISTS `rental_price_periods_user_rental_idx` ON `rental_price_periods` (`user_id`, `rental_id`);
CREATE INDEX IF NOT EXISTS `rental_price_periods_user_item_period_idx` ON `rental_price_periods` (`user_id`, `rental_item_id`, `start_period`, `end_period`);
CREATE UNIQUE INDEX IF NOT EXISTS `rental_price_periods_item_range_uidx` ON `rental_price_periods` (`user_id`, `rental_item_id`, `start_period`, `end_period`);
