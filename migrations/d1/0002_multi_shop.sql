CREATE TABLE shops (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  ownerUserId TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

ALTER TABLE organization_members ADD COLUMN shopId TEXT;
ALTER TABLE admin_applications ADD COLUMN shopName TEXT;
ALTER TABLE customer_portals ADD COLUMN assigneeUserId TEXT;
ALTER TABLE customer_phone_sessions ADD COLUMN shop_id TEXT;

INSERT OR IGNORE INTO shops (id, name, ownerUserId, status)
SELECT ap.userId,
       COALESCE(NULLIF(bs.storeName, ''), u.name || '的店铺'),
       ap.userId,
       CASE WHEN ap.active = 1 THEN 'active' ELSE 'suspended' END
FROM account_profiles ap
JOIN user u ON u.id = ap.userId
LEFT JOIN business_settings bs ON bs.userId = ap.userId
WHERE ap.role = 'admin';

UPDATE organization_members SET shopId = ownerId WHERE shopId IS NULL;
UPDATE admin_applications SET shopName = name || '的店铺' WHERE shopName IS NULL;
CREATE INDEX organization_members_shop_idx ON organization_members(shopId);
CREATE INDEX customer_portals_shop_phone_idx ON customer_portals(userId, phone);
CREATE INDEX customer_phone_sessions_shop_phone_idx ON customer_phone_sessions(shop_id, phone);
