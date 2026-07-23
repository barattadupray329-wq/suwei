-- Additive-only migration for unified login and role-scoped rental access.
-- Existing rental records remain unassigned until an administrator assigns them.

ALTER TABLE rentals ADD COLUMN assignedEmployeeId TEXT REFERENCES user(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS rentals_assigned_employee_idx ON rentals(assignedEmployeeId);
CREATE INDEX IF NOT EXISTS rentals_customer_phone_idx ON rentals(customerPhone);

ALTER TABLE admin_applications ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS admin_applications_username_unique ON admin_applications(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_applications_phone_unique ON admin_applications(phone);

-- Backfill stable, collision-resistant usernames for legacy pending applications.
UPDATE admin_applications
SET username = 'admin_' || id
WHERE username IS NULL OR trim(username) = '';
