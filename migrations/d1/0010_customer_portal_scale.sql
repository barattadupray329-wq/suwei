CREATE INDEX IF NOT EXISTS customer_portals_user_status_idx ON customer_portals (userId, status);
CREATE INDEX IF NOT EXISTS customer_portals_user_level_idx ON customer_portals (userId, customerLevel);
CREATE INDEX IF NOT EXISTS customer_portals_user_assignee_idx ON customer_portals (userId, assigneeUserId);
CREATE INDEX IF NOT EXISTS customer_portals_user_updated_idx ON customer_portals (userId, updatedAt);
CREATE INDEX IF NOT EXISTS customer_portals_user_phone_idx ON customer_portals (userId, phone);
CREATE INDEX IF NOT EXISTS rentals_customer_lookup_idx ON rentals (userId, customerPhone, orderType, lifecycleStatus);
CREATE INDEX IF NOT EXISTS receivable_bills_portal_idx ON receivable_bills (userId, rentalId, dueDate, status);
