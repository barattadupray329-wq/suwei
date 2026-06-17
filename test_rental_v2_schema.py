#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
租赁管理 v2 数据库迁移和功能验证测试
"""

import os
import sys
import json
import tempfile
from datetime import datetime, timedelta

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.data_manager import DataManager


def test_migration():
    """测试数据库迁移"""
    print("=" * 60)
    print("测试 1：数据库迁移")
    print("=" * 60)
    
    # 创建临时数据目录
    with tempfile.TemporaryDirectory() as tmpdir:
        dm = DataManager(data_dir=tmpdir)
        
        # 检查新表是否存在
        cursor = dm.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rental_%'"
        )
        tables = [row[0] for row in cursor.fetchall()]
        
        expected_tables = [
            'rental_contracts', 'rental_line_items', 'rental_hardware_change_logs',
            'rental_price_change_logs', 'rental_payment_logs', 'rental_audit_logs'
        ]
        
        for table in expected_tables:
            if table in tables:
                print(f"✓ 表 '{table}' 已创建")
            else:
                print(f"✗ 表 '{table}' 未创建")
                return False
        
        dm.close()
        print("\n✓ 迁移测试通过\n")
        return True


def test_old_data_migration():
    """测试旧数据迁移"""
    print("=" * 60)
    print("测试 2：旧数据迁移")
    print("=" * 60)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        dm = DataManager(data_dir=tmpdir)
        
        # 创建旧格式租赁记录
        old_record = {
            "id": "R202206170001",
            "renter": {"name": "张三", "phone": "13800138000", "id_card": "110101199001011234", "address": "北京市朝阳区"},
            "quantity": 2,
            "lease_info": {
                "start_date": "2022-06-17",
                "end_date": "2023-06-17",
                "monthly_rent": 300,
                "total_rent": 3600,
                "deposit": 500,
                "lease_months": 12
            },
            "status": "在租",
            "paid_amount": 1000,
            "renew_history": [],
            "hardware": {"cpu": "i5", "ram": "8G", "disk": "256G"}
        }
        
        # 添加记录
        dm.add_record(old_record)
        dm.conn.commit()
        
        # 触发迁移
        dm._migrate_legacy_rental_records_to_v2()
        
        # 检查新表中的数据
        contracts = dm.get_contracts()
        print(f"✓ 新建合同数：{len(contracts)}")
        
        if contracts:
            contract = contracts[0]
            print(f"  - 合同 ID: {contract['contract_id']}")
            print(f"  - 客户名称: {contract['customer_name']}")
            print(f"  - 合同状态: {contract['status']}")
            
            # 检查项目
            items = dm.conn.execute(
                "SELECT COUNT(*) as cnt FROM rental_line_items WHERE contract_id = ?",
                (contract['contract_id'],)
            ).fetchone()
            print(f"  - 租赁项目数: {items['cnt']}")
        
        dm.close()
        print("\n✓ 旧数据迁移测试通过\n")
        return True


def test_contract_creation():
    """测试合同创建"""
    print("=" * 60)
    print("测试 3：合同创建和项目添加")
    print("=" * 60)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        dm = DataManager(data_dir=tmpdir)
        
        # 创建合同
        contract_id = dm.create_contract(
            customer_name="李四",
            customer_phone="13900139000",
            start_date="2026-06-17",
            end_date="2027-06-17",
            customer_id_card="110102199201021234",
            customer_address="北京市东城区",
            deposit=1000,
            notes="新建合同测试"
        )
        print(f"✓ 合同已创建: {contract_id}")
        
        # 添加项目
        item_id = dm.add_line_item(
            contract_id=contract_id,
            item_name="ThinkPad T14",
            item_type="笔记本",
            quantity=2,
            unit_monthly_rent=300,
            start_date="2026-06-17",
            end_date="2027-06-17",
            hardware_json=json.dumps({"cpu": "i5-1240P", "memory": "16G"}),
            notes="项目1"
        )
        print(f"✓ 项目已添加: {item_id}")
        
        # 检查汇总
        contract = dm.get_contract(contract_id)
        print(f"✓ 合同总租金: ¥{contract['total_rent']:.2f}")
        print(f"✓ 已付金额: ¥{contract['paid_amount']:.2f}")
        print(f"✓ 未付金额: ¥{contract['unpaid_amount']:.2f}")
        
        dm.close()
        print("\n✓ 合同创建测试通过\n")
        return True


def test_payment():
    """测试收款记录"""
    print("=" * 60)
    print("测试 4：收款记录")
    print("=" * 60)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        dm = DataManager(data_dir=tmpdir)
        
        # 创建合同和项目
        contract_id = dm.create_contract(
            customer_name="王五",
            customer_phone="13810138100",
            start_date="2026-06-17",
            end_date="2027-06-17",
            deposit=500
        )
        
        dm.add_line_item(
            contract_id=contract_id,
            item_name="显示器",
            item_type="显示器",
            quantity=1,
            unit_monthly_rent=100,
            start_date="2026-06-17",
            end_date="2027-06-17"
        )
        
        # 添加收款
        payment_id = dm.add_payment(
            contract_id=contract_id,
            amount=500,
            payment_date=datetime.now().strftime("%Y-%m-%d"),
            payment_method="银行转账",
            receipt_no="TXN20260617001"
        )
        print(f"✓ 收款已记录: {payment_id}")
        
        # 检查更新后的汇总
        contract = dm.get_contract(contract_id)
        print(f"✓ 收款后已付金额: ¥{contract['paid_amount']:.2f}")
        print(f"✓ 收款后未付金额: ¥{contract['unpaid_amount']:.2f}")
        
        # 检查收款日志
        payments = dm.conn.execute(
            "SELECT COUNT(*) as cnt FROM rental_payment_logs WHERE contract_id = ?",
            (contract_id,)
        ).fetchone()
        print(f"✓ 收款记录数: {payments['cnt']}")
        
        dm.close()
        print("\n✓ 收款记录测试通过\n")
        return True


def test_audit_logs():
    """测试审计日志"""
    print("=" * 60)
    print("测试 5：审计日志")
    print("=" * 60)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        dm = DataManager(data_dir=tmpdir)
        
        contract_id = dm.create_contract(
            customer_name="赵六",
            customer_phone="13820138200",
            start_date="2026-06-17",
            end_date="2027-06-17"
        )
        
        # 检查审计日志
        logs = dm.conn.execute(
            "SELECT action_type, action_title FROM rental_audit_logs WHERE contract_id = ? ORDER BY created_at",
            (contract_id,)
        ).fetchall()
        
        print(f"✓ 审计日志条数: {len(logs)}")
        for log in logs:
            print(f"  - {log['action_type']}: {log['action_title']}")
        
        dm.close()
        print("\n✓ 审计日志测试通过\n")
        return True


def main():
    """运行所有测试"""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 58 + "║")
    print("║" + "  新版租赁管理数据库迁移和功能验证".center(58) + "║")
    print("║" + " " * 58 + "║")
    print("╚" + "=" * 58 + "╝")
    print("\n")
    
    tests = [
        ("数据库迁移", test_migration),
        ("旧数据迁移", test_old_data_migration),
        ("合同创建", test_contract_creation),
        ("收款记录", test_payment),
        ("审计日志", test_audit_logs),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ {name} 测试失败: {e}\n")
            failed += 1
    
    print("=" * 60)
    print(f"测试总结: 通过 {passed}/{len(tests)}, 失败 {failed}/{len(tests)}")
    print("=" * 60)
    print()
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
