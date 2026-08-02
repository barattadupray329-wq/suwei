DELETE FROM receivable_bills
WHERE rentalId = 1785143172355701
  AND billNo = 'RETURN-1785143172355701-1785143396222280'
  AND billType = '提前退租减免'
  AND amount = '-473.33';

UPDATE rentals
SET totalRent = '1600.00',
    paymentStatus = '部分收款',
    updatedAt = (unixepoch() * 1000)
WHERE id = 1785143172355701
  AND contractNo = 'HT20260326-001'
  AND totalRent = '1126.67'
  AND paidAmount = '1200.00';
