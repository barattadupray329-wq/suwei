CREATE TABLE IF NOT EXISTS password_change_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER,
  request_ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS password_change_subject_idx
  ON password_change_challenges (subject_type, subject_id);

CREATE INDEX IF NOT EXISTS password_change_phone_created_idx
  ON password_change_challenges (phone, created_at);
