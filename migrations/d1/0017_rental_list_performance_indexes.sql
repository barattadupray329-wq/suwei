CREATE INDEX IF NOT EXISTS `rentals_user_lifecycle_created_idx`
  ON `rentals` (`userId`, `lifecycleStatus`, `createdAt` DESC);

CREATE INDEX IF NOT EXISTS `rentals_user_lifecycle_status_idx`
  ON `rentals` (`userId`, `lifecycleStatus`, `status`);

CREATE INDEX IF NOT EXISTS `rentals_user_lifecycle_end_idx`
  ON `rentals` (`userId`, `lifecycleStatus`, `endDate`);

CREATE INDEX IF NOT EXISTS `rentals_user_lifecycle_assignee_idx`
  ON `rentals` (`userId`, `lifecycleStatus`, `assigneeUserId`);

CREATE INDEX IF NOT EXISTS `receivable_bills_user_rental_type_idx`
  ON `receivable_bills` (`userId`, `rentalId`, `billType`);
