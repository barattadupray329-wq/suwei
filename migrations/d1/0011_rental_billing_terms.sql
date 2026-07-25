-- 将计费方式与租赁时长固化到合同主表，替代从备注文本反推的脆弱做法。
ALTER TABLE `rentals` ADD COLUMN `billingType` text NOT NULL DEFAULT 'monthly';
ALTER TABLE `rentals` ADD COLUMN `duration` integer NOT NULL DEFAULT 1;

-- 历史数据回填：备注首行由系统生成，形如「计费方式：日租；租赁时间：15天」。
UPDATE `rentals`
SET `billingType` = CASE WHEN `notes` LIKE '%计费方式：日租%' THEN 'daily' ELSE 'monthly' END;

UPDATE `rentals`
SET `duration` = CASE
  WHEN `billingType` = 'daily'
    THEN MAX(1, CAST(julianday(`endDate`) - julianday(`startDate`) AS integer) + 1)
  ELSE MAX(1, CAST(ROUND((julianday(`endDate`) - julianday(`startDate`) + 1) / 30.4375) AS integer))
END;
