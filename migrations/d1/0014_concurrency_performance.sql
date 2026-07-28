CREATE INDEX IF NOT EXISTS session_user_expires_idx ON session(userId, expiresAt);
CREATE INDEX IF NOT EXISTS session_expires_idx ON session(expiresAt);
CREATE INDEX IF NOT EXISTS organization_members_shop_active_idx ON organization_members(shopId, active, memberUserId);
CREATE INDEX IF NOT EXISTS organization_members_owner_active_idx ON organization_members(ownerId, active, memberUserId);
CREATE INDEX IF NOT EXISTS rentals_dashboard_idx ON rentals(userId, lifecycleStatus, orderType, status, endDate);
CREATE INDEX IF NOT EXISTS rentals_due_order_idx ON rentals(userId, orderType, lifecycleStatus, endDate, createdAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS rental_items_device_summary_idx ON rental_items(userId, deviceType, rentalId);
