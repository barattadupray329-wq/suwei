# 新版租赁管理系统（v2 Schema）部署指南

## 概述

本次升级为租赁管理系统引入了新的数据架构，支持：
- **项目化租赁**：一张合同可包含多个租赁项目，每个项目独立配置和定价
- **硬件变更追踪**：记录租赁期间的所有硬件配件变更，保留变更前后的完整配置
- **租金变更历史**：跟踪租金调整、优惠、升级加价等所有变更
- **收款流水记录**：详细的收款日志，自动计算已付/未付金额
- **操作审计**：自动记录所有关键操作，用于追踪责任和恢复

## 版本信息

- **数据库版本**：6（从版本 5 升级）
- **新表数量**：6 张
- **兼容性**：向后兼容，旧数据自动迁移
- **首次迁移时间**：约 1-2 秒（取决于旧数据量）

## 部署步骤

### 1. 备份数据库

在运行新版本之前，请备份现有数据库：

```bash
# 复制数据库文件
cp data/rental_data.db data/rental_data.db.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. 部署代码

将以下文件添加到项目中：

```
core/data_manager.py              # 更新了 DB_VERSION=6 和新迁移方法
modules/rental_mgmt_v2_forms.py   # 新的 Tkinter 表单组件
test_rental_v2_schema.py          # 验证脚本
```

### 3. 运行迁移

启动应用程序时，迁移会自动执行：

```python
from core.data_manager import DataManager

dm = DataManager()  # 自动执行 Migration 006
# 迁移过程：
# 1. 创建 6 张新表（如果不存在）
# 2. 从 rental_records 迁移旧数据为合同和项目
# 3. 创建必要的索引
```

### 4. 验证迁移

运行测试脚本验证迁移成功：

```bash
python test_rental_v2_schema.py
```

预期输出：
```
============================================================
测试总结: 通过 5/5, 失败 0/5
============================================================
```

### 5. 集成到 UI（可选，第二阶段）

目前新版 API 和表单组件已就位，可以：

- **添加新增合同按钮**到现有 rental_mgmt.py
- **创建新合同**使用 `DataManager.create_contract()`
- **添加项目**使用 `DataManager.add_line_item()`
- **记录收款**使用 `DataManager.add_payment()`

新旧合同可以共存，旧合同继续使用原有界面。

## 新 API 接口参考

### 创建合同

```python
contract_id = dm.create_contract(
    customer_name="客户名称",
    customer_phone="13800138000",
    start_date="2026-06-17",
    end_date="2027-06-17",
    customer_id_card="身份证号",
    customer_address="地址",
    deposit=1000.0,
    notes="备注",
    operator_name="操作人"
)
```

### 获取合同列表

```python
# 获取所有合同
contracts = dm.get_contracts()

# 按状态筛选
contracts = dm.get_contracts(status="在租")

# 按客户名称筛选
contracts = dm.get_contracts(customer_name="张三")
```

### 获取合同详情

```python
contract = dm.get_contract(contract_id)
# contract["line_items"] 包含所有项目
# contract["total_rent"] 自动汇总
# contract["paid_amount"] 自动汇总
# contract["unpaid_amount"] 自动汇总
```

### 添加租赁项目

```python
item_id = dm.add_line_item(
    contract_id=contract_id,
    item_name="ThinkPad T14",
    item_type="笔记本",
    quantity=2,
    unit_monthly_rent=300.0,
    start_date="2026-06-17",
    end_date="2027-06-17",
    hardware_json='{"cpu": "i5", "memory": "16G"}',
    notes="项目备注",
    operator_name="操作人"
)
```

### 添加收款

```python
payment_id = dm.add_payment(
    contract_id=contract_id,
    amount=500.0,
    payment_date="2026-06-17",
    payment_method="银行转账",
    receipt_no="凭证号",
    notes="收款备注",
    operator_name="操作人"
)
# 收款会自动更新 contract.paid_amount 和 contract.unpaid_amount
```

## 新表结构概览

### rental_contracts（租赁合同主表）

| 字段 | 类型 | 说明 |
|------|------|------|
| contract_id | TEXT | 合同编号（PK） |
| old_record_id | TEXT | 兼容旧系统的记录 ID |
| customer_name | TEXT | 客户名称 |
| customer_phone | TEXT | 联系电话 |
| customer_id_card | TEXT | 身份证号 |
| customer_address | TEXT | 地址 |
| contract_start_date | TEXT | 合同开始日期 |
| contract_end_date | TEXT | 合同结束日期 |
| status | TEXT | 状态：在租/已退租/已丢失/已买断/已逾期 |
| deposit | REAL | 押金 |
| total_rent | REAL | 合同总租金（汇总） |
| paid_amount | REAL | 已付金额（汇总） |
| unpaid_amount | REAL | 未付金额（汇总） |
| created_by | TEXT | 创建人 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
| notes | TEXT | 备注 |

### rental_line_items（租赁项目明细）

| 字段 | 类型 | 说明 |
|------|------|------|
| item_id | TEXT | 项目编号（PK） |
| contract_id | TEXT | 关联合同 ID（FK） |
| item_name | TEXT | 项目名称 |
| item_type | TEXT | 设备类型：电脑/显示器/配件包/其他 |
| quantity | INTEGER | 数量 |
| unit_monthly_rent | REAL | 单台月租 |
| monthly_rent | REAL | 月租小计（quantity × unit_monthly_rent） |
| total_rent | REAL | 项目总租金 |
| start_date | TEXT | 项目起租日期 |
| end_date | TEXT | 项目到期日期 |
| hardware_snapshot_json | TEXT | 签约时硬件配置快照（不可改） |
| current_hardware_json | TEXT | 当前硬件配置 |
| status | TEXT | 项目状态 |
| created_by | TEXT | 创建人 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
| notes | TEXT | 备注 |

### rental_payment_logs（收款记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| payment_id | TEXT | 收款编号（PK） |
| contract_id | TEXT | 关联合同 ID（FK） |
| payment_date | TEXT | 收款日期 |
| amount | REAL | 收款金额 |
| payment_method | TEXT | 收款方式 |
| payment_account | TEXT | 收款账户 |
| receipt_no | TEXT | 凭证号 |
| operator_name | TEXT | 操作人 |
| created_at | TEXT | 记录时间 |
| notes | TEXT | 备注 |

### rental_hardware_change_logs（硬件变更历史）

| 字段 | 类型 | 说明 |
|------|------|------|
| change_id | TEXT | 变更编号（PK） |
| contract_id | TEXT | 关联合同 ID（FK） |
| item_id | TEXT | 关联项目 ID（FK） |
| change_date | TEXT | 变更日期 |
| change_type | TEXT | 变更类型：更换整机/更换配件/新增配件/减少配件/维修替换/客户损坏/升级配置/降级配置 |
| change_reason | TEXT | 变更原因 |
| old_hardware_json | TEXT | 变更前硬件配置 |
| new_hardware_json | TEXT | 变更后硬件配置 |
| cost_amount | REAL | 费用金额 |
| cost_type | TEXT | 费用类型：免费更换/客户赔偿/升级加价/维修成本/内部成本 |
| responsible_person | TEXT | 责任人 |
| operator_name | TEXT | 操作人 |
| created_at | TEXT | 记录时间 |
| notes | TEXT | 备注 |

### rental_price_change_logs（租金变更历史）

| 字段 | 类型 | 说明 |
|------|------|------|
| price_change_id | TEXT | 变更编号（PK） |
| contract_id | TEXT | 关联合同 ID（FK） |
| item_id | TEXT | 关联项目 ID（FK） |
| change_date | TEXT | 变更日期 |
| effective_date | TEXT | 生效日期 |
| old_unit_monthly_rent | REAL | 原单台月租 |
| new_unit_monthly_rent | REAL | 新单台月租 |
| old_quantity | INTEGER | 原数量 |
| new_quantity | INTEGER | 新数量 |
| old_monthly_rent | REAL | 原月租小计 |
| new_monthly_rent | REAL | 新月租小计 |
| difference_amount | REAL | 差额 |
| change_reason | TEXT | 变更原因 |
| approval_status | TEXT | 审批状态 |
| operator_name | TEXT | 操作人 |
| created_at | TEXT | 记录时间 |
| notes | TEXT | 备注 |

### rental_audit_logs（操作审计日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| audit_id | TEXT | 审计编号（PK） |
| contract_id | TEXT | 关联合同 ID |
| item_id | TEXT | 关联项目 ID |
| action_type | TEXT | 操作类型：create_contract/add_line_item/payment_add/hardware_change/price_change/import_data 等 |
| action_title | TEXT | 操作标题 |
| before_json | TEXT | 修改前数据 |
| after_json | TEXT | 修改后数据 |
| operator_name | TEXT | 操作人 |
| created_at | TEXT | 记录时间 |
| notes | TEXT | 备注 |

## 旧数据迁移说明

### 自动迁移过程

首次启动新版本时，系统会自动：

1. **检测旧数据**：扫描 `rental_records` 表中的 JSON 数据
2. **创建新合同**：将旧记录的客户信息转换为新合同
3. **生成默认项目**：创建一条"默认租赁项目"，包含原来的数量和价格
4. **迁移硬件配置**：将旧硬件 JSON 作为项目的硬件快照和当前配置
5. **迁移收款记录**：如果有已付金额，生成一条初始收款记录
6. **记录审计日志**：标记为"migration"操作，便于追踪

### 迁移后的结果

- **原 ID 保留**：新合同使用原记录 ID 作为 contract_id
- **old_record_id 字段**：保存旧记录 ID，便于回溯
- **旧表保留**：rental_records 表保留，不删除
- **可回滚**：如有问题，可从备份数据库恢复

## 性能考虑

### 索引优化

新表上已创建以下索引以优化查询性能：

```
rental_contracts:
  - idx_rental_contracts_customer_name
  - idx_rental_contracts_customer_phone
  - idx_rental_contracts_status
  - idx_rental_contracts_end_date

rental_line_items:
  - idx_rental_line_items_contract
  - idx_rental_line_items_status
  - idx_rental_line_items_type

rental_payment_logs:
  - idx_payment_contract
  - idx_payment_date
  - idx_payment_receipt

rental_hardware_change_logs:
  - idx_hardware_change_contract
  - idx_hardware_change_item
  - idx_hardware_change_date
  - idx_hardware_change_type

rental_price_change_logs:
  - idx_price_change_contract
  - idx_price_change_item
  - idx_price_change_date
  - idx_price_change_effective_date

rental_audit_logs:
  - idx_audit_contract
  - idx_audit_item
  - idx_audit_action
  - idx_audit_date
```

### 金额汇总策略

- `contract.total_rent` = SUM(line_item.total_rent for all items)
- `contract.paid_amount` = SUM(payment.amount for all payments)
- `contract.unpaid_amount` = total_rent - paid_amount

这些字段在每次添加项目或收款后自动更新，避免复杂 JOIN 查询。

## 故障排查

### 迁移失败

如果迁移过程中出现错误：

1. **检查日志**：查看 `logs/` 目录中的错误日志
2. **检查数据完整性**：运行 `test_rental_v2_schema.py` 验证
3. **从备份恢复**：替换 `data/rental_data.db` 为备份文件
4. **手动修复**：如需手动处理，使用 SQLite 工具检查数据

### 数据不一致

如果发现合同总租金、已付金额不匹配：

```python
# 手动触发汇总更新
from core.data_manager import DataManager

dm = DataManager()
dm.update_contract_summary(contract_id)
dm.close()
```

## 测试清单

部署前请确认以下各项：

- [ ] 备份了原数据库
- [ ] 运行了 `test_rental_v2_schema.py`，全部测试通过
- [ ] 旧数据正确迁移（检查合同数、项目数、金额汇总）
- [ ] 现有租赁管理功能正常运行（旧合同仍可查看）
- [ ] 新 API 测试成功（创建合同、添加项目、记录收款）

## 后续计划

### 第二阶段：UI 集成
- [ ] 在 rental_mgmt.py 中添加"新增合同 v2"入口
- [ ] 实现 HardwareChangeDialog 组件
- [ ] 实现 PriceChangeDialog 组件
- [ ] 更新详情页为标签页结构

### 第三阶段：报表和分析
- [ ] 硬件变更频率分析
- [ ] 租金变更趋势分析
- [ ] 收款状态统计
- [ ] 审计日志查询工具

## 支持和联系

如有问题，请参考：

1. **测试脚本**：`test_rental_v2_schema.py` 包含完整的功能演示
2. **API 文档**：本文件中的接口参考部分
3. **源代码注释**：`core/data_manager.py` 中的 v2 相关方法有详细注释

## 版本历史

- **v2.0** (2026-06-17)：首次发布，包含新版数据架构、项目化租赁、硬件追踪、审计日志
- **v2.0.1**：规划中，将整合 UI 组件和详情页标签页

---

**最后更新**：2026-06-17  
**部署者**：Oz Agent  
**审核状态**：已验证，全部测试通过
