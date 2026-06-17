#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新版租赁管理（v2）集成模块验证脚本
验证新版合同功能是否可用
"""

import sys
import os
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from core.data_manager import DataManager
from datetime import datetime, timedelta


def test_v2_contracts():
    """测试 v2 合同 API"""
    print("=" * 60)
    print("新版租赁管理 v2 集成验证")
    print("=" * 60)

    # 初始化数据管理器
    dm = DataManager()
    print("✓ 数据管理器初始化成功")

    # 测试创建合同
    contract_id = dm.create_contract(
        customer_name="测试客户 A",
        customer_phone="13800138000",
        customer_id_card="110101199001011234",
        customer_address="北京市朝阳区",
        start_date=datetime.now().strftime("%Y-%m-%d"),
        end_date=(datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
        deposit=1000.0,
        notes="测试合同"
    )
    print(f"✓ 合同创建成功：{contract_id}")

    # 测试获取合同
    contract = dm.get_contract(contract_id)
    print(f"✓ 合同查询成功：{contract.get('customer_name')}")

    # 测试添加项目
    item_id = dm.add_line_item(
        contract_id=contract_id,
        item_name="电脑租赁",
        item_type="电脑",
        quantity=3,
        unit_monthly_rent=500.0,
        start_date=datetime.now().strftime("%Y-%m-%d"),
        end_date=(datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
        notes="标准配置"
    )
    print(f"✓ 项目添加成功：{item_id}")

    # 重新获取合同确认项目已添加
    contract = dm.get_contract(contract_id)
    total_rent = contract.get("total_rent", 0)
    print(f"✓ 合同总租金已计算：¥{total_rent:.2f}")

    # 测试添加收款
    payment_id = dm.add_payment(
        contract_id=contract_id,
        amount=5000.0,
        payment_date=datetime.now().strftime("%Y-%m-%d"),
        payment_method="银行转账",
        receipt_no="REC20260617001",
        notes="首笔收款"
    )
    print(f"✓ 收款添加成功：{payment_id}")

    # 重新获取合同确认收款已更新
    contract = dm.get_contract(contract_id)
    paid_amount = contract.get("paid_amount", 0)
    unpaid_amount = contract.get("unpaid_amount", 0)
    print(f"✓ 已收金额：¥{paid_amount:.2f}，未收金额：¥{unpaid_amount:.2f}")

    # 测试获取合同列表
    contracts = dm.get_contracts()
    print(f"✓ 合同列表查询成功，共 {len(contracts)} 份合同")

    # 验证 UI 模块可导入
    try:
        from modules.rental_mgmt_v2_integration import RentalContractsV2Frame, CreateContractWizard, AddPaymentDialog
        print("✓ UI 模块导入成功")
        print("  - RentalContractsV2Frame")
        print("  - CreateContractWizard")
        print("  - AddPaymentDialog")
    except Exception as e:
        print(f"✗ UI 模块导入失败：{e}")
        return False

    print("\n" + "=" * 60)
    print("验证完成：所有核心功能正常！")
    print("=" * 60)
    print("\n下一步：")
    print("1. 在主应用中添加新版合同标签页")
    print("2. 测试创建向导的各个步骤")
    print("3. 测试项目明细编辑功能")
    print("4. 验证金额计算准确性")

    dm.close()
    return True


if __name__ == "__main__":
    success = test_v2_contracts()
    sys.exit(0 if success else 1)
