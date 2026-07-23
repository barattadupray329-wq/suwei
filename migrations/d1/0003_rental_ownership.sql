ALTER TABLE rentals ADD COLUMN sourceUserId TEXT;
ALTER TABLE rentals ADD COLUMN sourceName TEXT;
ALTER TABLE rentals ADD COLUMN assigneeUserId TEXT;
ALTER TABLE rentals ADD COLUMN assigneeName TEXT;

CREATE INDEX IF NOT EXISTS rentals_user_contract_number_idx ON rentals (userId, contractNo);
CREATE INDEX IF NOT EXISTS rental_items_user_device_number_idx ON rental_items (userId, deviceCode);
CREATE INDEX IF NOT EXISTS rentals_user_assignee_idx ON rentals (userId, assigneeUserId);
