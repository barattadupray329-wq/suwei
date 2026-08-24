-- 修复历史遗留的逾期续租账单金额错误（在本次退租/续租修复代码上线前生成/更新，未按当时实际剩余设备数计费）
-- 合同 HT20260318-003（rentalId=1787567190276873）：2026-06-12 退还 2 台后，
-- 06-18/07-18/08-18 三期逾期账单仍按退租前的 8 台计费（960.00），应按剩余 6 台重算为 720.00
UPDATE receivable_bills SET amount = '720.00', notes = notes || '；数据修复：按退租后剩余6台重算（原960.00）', updatedAt = unixepoch()*1000
WHERE id IN (1787567190276975, 1787567190276976, 1787567190276977) AND amount = '960.00' AND paidAmount = '0.00';

UPDATE rentals SET totalRent = '5040.00', updatedAt = unixepoch()*1000
WHERE id = 1787567190276873 AND totalRent = '5760.00';

-- 合同 1786012515125991：历史更新时误用了「当前」而非「账期开始日」判断剩余设备数，
-- 账单按剩余2台台式机、0台AOC计费（220.00），实际账期开始日当天应为剩余3台台式机、1台AOC，正确金额360.00
UPDATE receivable_bills SET amount = '360.00', notes = notes || '；数据修复：按账期开始日剩余设备数重算（原220.00）', updatedAt = unixepoch()*1000
WHERE id = 1786013254757017 AND amount = '220.00' AND paidAmount = '0.00';

UPDATE rentals SET totalRent = '1860.00', updatedAt = unixepoch()*1000
WHERE id = 1786012515125991 AND totalRent = '1720.00';
