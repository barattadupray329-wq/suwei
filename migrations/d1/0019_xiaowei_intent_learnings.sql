CREATE TABLE IF NOT EXISTS `xiaowei_intent_learnings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `normalized_question` text NOT NULL,
  `resolved_question` text NOT NULL,
  `confirmation_count` integer DEFAULT 1 NOT NULL,
  `correction_count` integer DEFAULT 0 NOT NULL,
  `last_actor_user_id` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `xiaowei_intent_learnings_question_uidx` ON `xiaowei_intent_learnings` (`normalized_question`);
CREATE INDEX IF NOT EXISTS `xiaowei_intent_learnings_updated_idx` ON `xiaowei_intent_learnings` (`updated_at`);
