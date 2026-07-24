CREATE TABLE IF NOT EXISTS `sms_delivery_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `rental_id` integer,
  `scene` text NOT NULL,
  `template_code` text NOT NULL,
  `masked_phone` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `provider_request_id` text,
  `provider_code` text,
  `error_message` text,
  `trigger_type` text NOT NULL,
  `actor_user_id` text,
  `sent_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `sms_delivery_logs_idempotency_key_unique` ON `sms_delivery_logs` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sms_delivery_logs_user_rental_idx` ON `sms_delivery_logs` (`user_id`, `rental_id`, `created_at`);
