-- 仅新增索引，不修改、删除或重算任何业务数据。
CREATE INDEX IF NOT EXISTS payment_records_user_rental_date_idx
  ON payment_records(userId, rentalId, paymentDate);

CREATE INDEX IF NOT EXISTS receivable_bills_user_rental_due_idx
  ON receivable_bills(userId, rentalId, dueDate);

CREATE INDEX IF NOT EXISTS receivable_bills_user_due_idx
  ON receivable_bills(userId, dueDate);
