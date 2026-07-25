-- 一次性清理脚本：删除测试合同 HT20260624-001（rentalId=1784892723233564）
-- 及其全部关联业务、资金记录，并删除客户门户账号 18039825452。
-- 执行方式：pnpm exec wrangler d1 execute suwei-db --remote --file scripts/cleanup-test-contract.sql
DELETE FROM payment_allocations WHERE rentalId = 1784892723233564;
DELETE FROM payment_records WHERE rentalId = 1784892723233564;
DELETE FROM receivable_bills WHERE rentalId = 1784892723233564;
DELETE FROM account_ledger WHERE rentalId = 1784892723233564;
DELETE FROM return_records WHERE rentalId = 1784892723233564;
DELETE FROM loss_records WHERE rentalId = 1784892723233564;
DELETE FROM buyout_records WHERE rentalId = 1784892723233564;
DELETE FROM renewal_records WHERE rentalId = 1784892723233564;
DELETE FROM rental_events WHERE rentalId = 1784892723233564;
DELETE FROM contract_snapshots WHERE rentalId = 1784892723233564;
DELETE FROM rental_items WHERE rentalId = 1784892723233564;
DELETE FROM rentals WHERE id = 1784892723233564;
DELETE FROM customer_phone_sessions WHERE phone = '18039825452';
DELETE FROM customer_otp_challenges WHERE phone = '18039825452';
DELETE FROM sms_delivery_logs WHERE rental_id = 1784892723233564;
DELETE FROM customer_portals WHERE phone = '18039825452';
