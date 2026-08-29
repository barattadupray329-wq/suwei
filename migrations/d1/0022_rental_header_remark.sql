-- 合同详情头部的"随时可改备注"：记录诸如"合同签的是A，实际给B使用"这类灵活说明，方便后期查看。
-- 与创建时录入的 notes（业务备注）区分开：notes 是建单时的原始备注，headerRemark 是可随时改动的头部速记。
ALTER TABLE rentals ADD COLUMN headerRemark text;
