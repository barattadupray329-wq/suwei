CREATE TABLE `rental_operations` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `rental_id` integer NOT NULL,
  `operation_no` text NOT NULL,
  `operation_type` text NOT NULL,
  `status` text NOT NULL DEFAULT 'completed',
  `idempotency_key` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `actor_name` text NOT NULL,
  `summary` text NOT NULL,
  `result_json` text NOT NULL DEFAULT '{}',
  `completed_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_operations_user_no_uidx` ON `rental_operations` (`user_id`,`operation_no`);
--> statement-breakpoint
CREATE UNIQUE INDEX `rental_operations_user_idempotency_uidx` ON `rental_operations` (`user_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `rental_operations_user_rental_created_idx` ON `rental_operations` (`user_id`,`rental_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `notification_policies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `scene` text NOT NULL,
  `mode` text NOT NULL DEFAULT 'default_on',
  `enabled` integer NOT NULL DEFAULT 1,
  `days_before` integer,
  `overdue_interval_days` integer,
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_policies_user_scene_uidx` ON `notification_policies` (`user_id`,`scene`);
--> statement-breakpoint
ALTER TABLE `sms_delivery_logs` ADD `operation_id` integer;
--> statement-breakpoint
ALTER TABLE `sms_delivery_logs` ADD `retry_of_id` integer;
--> statement-breakpoint
CREATE INDEX `sms_delivery_logs_operation_idx` ON `sms_delivery_logs` (`user_id`,`operation_id`,`created_at`);
