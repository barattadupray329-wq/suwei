ALTER TABLE receivable_bills ADD COLUMN waivedAmount TEXT NOT NULL DEFAULT '0';

CREATE TABLE waiver_records (
  id INTEGER PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  rentalId INTEGER NOT NULL,
  billId INTEGER NOT NULL,
  clientRequestId TEXT NOT NULL,
  amount TEXT NOT NULL,
  waiverDate TEXT NOT NULL,
  waiverType TEXT NOT NULL,
  reason TEXT NOT NULL,
  operatorUserId TEXT NOT NULL,
  operatorName TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX waiver_records_user_request_bill_unique
  ON waiver_records (userId, clientRequestId, billId);
CREATE INDEX waiver_records_user_rental_idx
  ON waiver_records (userId, rentalId);
