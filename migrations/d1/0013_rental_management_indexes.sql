-- 仅新增索引，不修改、删除或重算任何业务数据。
CREATE INDEX IF NOT EXISTS rentals_user_lifecycle_created_idx
  ON rentals(userId, lifecycleStatus, createdAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS rentals_user_lifecycle_type_created_idx
  ON rentals(userId, lifecycleStatus, orderType, createdAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS rentals_user_lifecycle_status_end_idx
  ON rentals(userId, lifecycleStatus, status, endDate, id);

CREATE INDEX IF NOT EXISTS rentals_user_lifecycle_assignee_created_idx
  ON rentals(userId, lifecycleStatus, assigneeUserId, createdAt DESC, id DESC);

CREATE INDEX IF NOT EXISTS renewal_adjustments_user_rental_created_idx
  ON renewal_adjustments(userId, rentalId, createdAt DESC, id DESC);
