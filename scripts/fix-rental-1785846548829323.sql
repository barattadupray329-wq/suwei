BEGIN TRANSACTION;

-- 合同设备后续月租从 2026-08 账期起改为 90 元/台
UPDATE rental_items
SET monthlyRent = '90', updatedAt = CURRENT_TIMESTAMP
WHERE id = 103 AND rentalId = 1785846548829323;

UPDATE rentals
SET monthlyRent = '90', updatedAt = CURRENT_TIMESTAMP
WHERE id = 1785846548829323;

-- 2026-08 账期：5 台 × 90 = 450，保留原收款对应关系
UPDATE receivable_bills
SET amount = '450.00', paidAmount = '450.00', status = '已结清',
    notes = '合同到期后继续使用，2026-08-02 至 2026-09-01 月租；月租已更正为 90 元/台，共 5 台',
    updatedAt = CURRENT_TIMESTAMP
WHERE id = 1785846548829425 AND rentalId = 1785846548829323;

-- 2026-09 账期：退 4 台后只剩 1 台，5 台原账单 450 减免 4 台 360，剩余应收 90
UPDATE receivable_bills
SET amount = '90.00', paidAmount = '0.00', status = '待收',
    notes = '合同到期后继续使用，2026-09-02 至 2026-10-02 月租；台式机 4 台退租后按剩余 1 台计租，月租 90 元/台',
    updatedAt = CURRENT_TIMESTAMP
WHERE id = 1788250922956556 AND rentalId = 1785846548829323;

-- 将原按 110 元/台生成的退租调整更正为 4 台 × 90 = 360 元
UPDATE receivable_bills
SET amount = '-360.00', notes = '提前退租按月租 90 元/台计算：退回台式机 4 台，减免 360 元', updatedAt = CURRENT_TIMESTAMP
WHERE id = 1788250922956557 AND rentalId = 1785846548829323;

-- 保留收款与审计记录，合同汇总按修正后的有效账期与退款后净已收重算
UPDATE rentals
SET totalRent = '1280.00', paidAmount = '1190.00', paymentStatus = '部分收款', quantity = 1, monthlyRent = '90', updatedAt = CURRENT_TIMESTAMP
WHERE id = 1785846548829323;

INSERT INTO account_ledger (userId, rentalId, entryType, amount, entryDate, operatorName, notes)
SELECT userId, 1785846548829323, '租金待退', '-360.00', '2026-09-03', '系统账务修正', '月租从 110 元更正为 90 元/台，并按退 4 台重算本期减免；保留为租金待退，供后续退款处理'
FROM rentals WHERE id = 1785846548829323;

COMMIT;
