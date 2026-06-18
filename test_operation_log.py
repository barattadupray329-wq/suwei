#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""操作记录功能测试 - 验证 DataManager 版本历史和 rental_mgmt UI 集成。"""

import json
import os
import sys
import tempfile
import tkinter as tk
from pathlib import Path
from datetime import datetime

# 确保项目路径在 sys.path 中
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from core.data_manager import DataManager


def test_data_manager_version_history():
    """测试 DataManager 的版本历史记录功能"""
    print("\n" + "=" * 60)
    print("[TEST 1] DataManager 版本历史记录")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmp:
        data_dir = Path(tmp)
        dm = DataManager(str(data_dir))

        # 1. 创建记录
        rec = {
            "renter": {
                "name": "张三",
                "phone": "13800138000",
                "id_card": "110101199001011234",
                "address": "北京市朝阳区",
            },
            "quantity": 1,
            "lease_info": {
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "monthly_rent": 500.0,
                "total_rent": 6000.0,
                "deposit": 1000.0,
            },
            "status": "在租",
            "paid_amount": 0,
            "renew_history": [],
            "hardware": {"cpu": "i5-12400F", "ram": "16GB"},
        }
        assert dm.add_record(rec), "创建记录失败"
        rid = rec["id"]
        print(f"  ✅ 创建记录: {rid}")

        # 2. 验证初始版本历史
        versions = dm.get_record_versions(rid)
        assert len(versions) >= 1, f"版本历史应至少包含 1 条记录，实际: {len(versions)}"
        assert versions[0]["action"] == "create", f"首条版本应为 create，实际: {versions[0]['action']}"
        print(f"  ✅ 初始版本记录: {len(versions)} 条")

        # 3. 编辑记录（修改已付金额）
        assert dm.update_record(rid, {"paid_amount": 1000.0}), "更新记录失败"
        updated = dm.get_record_by_id(rid)
        assert updated["paid_amount"] == 1000.0, "已付金额未更新"
        print(f"  ✅ 编辑记录: paid_amount=1000")

        # 4. 验证编辑后的版本历史
        versions = dm.get_record_versions(rid)
        assert len(versions) >= 3, f"版本历史应至少包含 3 条（create+before_update+update），实际: {len(versions)}"
        
        actions = [v["action"] for v in versions]
        assert "before_update" in actions, "缺少编辑前快照版本"
        assert "update" in actions, "缺少编辑版本"
        print(f"  ✅ 版本历史: {len(versions)} 条 (包含编辑前快照)")

        # 5. 再次编辑（修改状态）
        assert dm.update_record(rid, {"status": "已退租"}), "状态更新失败"
        updated = dm.get_record_by_id(rid)
        assert updated["status"] == "已退租", "状态未更新"
        print(f"  ✅ 编辑记录: status=已退租")

        # 6. 验证最新版本历史
        versions = dm.get_record_versions(rid)
        assert len(versions) >= 5, f"版本历史应至少包含 5 条，实际: {len(versions)}"
        print(f"  ✅ 版本历史: {len(versions)} 条 (包含两次编辑)")

        # 7. 验证版本数据完整性
        for v in versions:
            assert "version_id" in v, "缺少 version_id"
            assert "created_at" in v, "缺少 created_at"
            assert "action" in v, "缺少 action"
            if v.get("data"):
                assert "id" in v["data"], "数据快照缺少 id"
                assert "renter" in v["data"], "数据快照缺少 renter"
        print(f"  ✅ 所有版本数据完整性验证通过")

        dm.close()

    print("  ✅ DataManager 版本历史记录测试通过\n")
    return True


def test_rollback_functionality():
    """测试记录回滚功能"""
    print("\n" + "=" * 60)
    print("[TEST 2] 记录回滚功能")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmp:
        data_dir = Path(tmp)
        dm = DataManager(str(data_dir))

        # 创建记录
        rec = {
            "renter": {"name": "李四", "phone": "13900139000", "id_card": "", "address": ""},
            "quantity": 1,
            "lease_info": {
                "start_date": "2024-03-01",
                "end_date": "2025-03-01",
                "monthly_rent": 800.0,
                "total_rent": 9600.0,
                "deposit": 1600.0,
            },
            "status": "在租",
            "paid_amount": 0,
            "renew_history": [],
            "hardware": {},
        }
        assert dm.add_record(rec), "创建记录失败"
        rid = rec["id"]
        print(f"  ✅ 创建记录: {rid} (paid_amount=0)")

        # 获取初始版本
        versions = dm.get_record_versions(rid)
        initial_version = versions[-1]  # 最旧版本（最后一条）
        initial_paid = initial_version["data"]["paid_amount"]
        print(f"  ✅ 初始版本 ID: {initial_version['version_id']}, paid_amount={initial_paid}")

        # 多次编辑
        dm.update_record(rid, {"paid_amount": 2000.0})
        print(f"  ✅ 编辑: paid_amount=2000")
        dm.update_record(rid, {"paid_amount": 5000.0})
        print(f"  ✅ 编辑: paid_amount=5000")
        dm.update_record(rid, {"status": "已逾期"})
        print(f"  ✅ 编辑: status=已逾期")

        # 验证当前状态
        current = dm.get_record_by_id(rid)
        assert current["paid_amount"] == 5000.0, f"当前已付金额应为 5000，实际: {current['paid_amount']}"
        assert current["status"] == "已逾期", f"当前状态应为已逾期，实际: {current['status']}"
        print(f"  ✅ 当前状态验证通过")

        # 回滚到初始版本
        assert dm.rollback_record(rid, initial_version["version_id"]), "回滚失败"
        rolled_back = dm.get_record_by_id(rid)
        assert rolled_back["paid_amount"] == initial_paid, f"回滚后 paid_amount 应为 {initial_paid}，实际: {rolled_back['paid_amount']}"
        print(f"  ✅ 回滚成功: paid_amount 恢复为 {initial_paid}")

        # 验证回滚操作也被记录
        versions = dm.get_record_versions(rid)
        latest_action = versions[0]["action"]
        assert latest_action == "rollback", f"最新版本操作应为 rollback，实际: {latest_action}"
        print(f"  ✅ 回滚操作已记录到版本历史")

        dm.close()

    print("  ✅ 记录回滚功能测试通过\n")
    return True


def test_ui_methods_exist():
    """测试 rental_mgmt 模块中新增的 UI 方法是否存在"""
    print("\n" + "=" * 60)
    print("[TEST 3] UI 方法存在性检查")
    print("=" * 60)

    try:
        from modules.rental_mgmt import RentalManagementFrame
        print("  ✅ RentalManagementFrame 导入成功")

        # 检查方法是否存在
        required_methods = [
            "_show_operation_log",
            "_show_version_detail_dialog",
            "_rollback_to_version",
        ]

        for method_name in required_methods:
            assert hasattr(RentalManagementFrame, method_name), f"缺少方法: {method_name}"
            print(f"  ✅ 方法存在: {method_name}")

        # 创建临时 Tk 根窗口用于实例化检查
        root = tk.Tk()
        root.withdraw()

        # 创建 DataManager 模拟
        with tempfile.TemporaryDirectory() as tmp:
            dm = DataManager(str(Path(tmp)))
            dm.close()

            # 创建 mock app
            class MockApp:
                def __init__(self):
                    self.username = "test_user"
                    self.data_manager = DataManager(str(Path(tmp)))

            mock_app = MockApp()

            # 尝试实例化框架
            frame = RentalManagementFrame(root, mock_app)
            print("  ✅ RentalManagementFrame 实例化成功")

            # 检查详情面板是否包含操作记录按钮
            # 注意：这里只检查方法是否存在，不实际渲染 UI
            assert hasattr(frame, "_show_operation_log"), "缺少 _show_operation_log 方法"
            assert hasattr(frame, "_show_version_detail_dialog"), "缺少 _show_version_detail_dialog 方法"
            assert hasattr(frame, "_rollback_to_version"), "缺少 _rollback_to_version 方法"

            frame.destroy()
            mock_app.data_manager.close()

        root.destroy()

    except Exception as e:
        print(f"  ❌ UI 方法检查失败: {e}")
        return False

    print("  ✅ UI 方法存在性检查通过\n")
    return True


def test_version_data_format():
    """测试版本数据格式是否正确"""
    print("\n" + "=" * 60)
    print("[TEST 4] 版本数据格式验证")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmp:
        data_dir = Path(tmp)
        dm = DataManager(str(data_dir))

        # 创建记录
        rec = {
            "renter": {"name": "王五", "phone": "13700137000", "id_card": "110101198001011234", "address": "上海市浦东新区"},
            "quantity": 2,
            "lease_info": {
                "start_date": "2024-06-01",
                "end_date": "2025-06-01",
                "monthly_rent": 1000.0,
                "total_rent": 12000.0,
                "deposit": 2000.0,
            },
            "status": "在租",
            "paid_amount": 3000.0,
            "renew_history": [],
            "hardware": {"cpu": "i7-12700K", "ram": "32GB", "gpu": "RTX 3060"},
        }
        dm.add_record(rec)
        rid = rec["id"]

        # 获取版本
        versions = dm.get_record_versions(rid)
        assert len(versions) == 1, f"应有 1 个版本，实际: {len(versions)}"

        v = versions[0]
        # 检查必需字段
        required_fields = ["version_id", "record_id", "action", "data", "created_at", "note"]
        for field in required_fields:
            assert field in v, f"版本记录缺少字段: {field}"
        print(f"  ✅ 版本记录包含所有必需字段")

        # 检查数据快照格式
        data = v["data"]
        assert data["id"] == rid, f"数据快照 ID 不匹配: {data['id']} != {rid}"
        assert data["renter"]["name"] == "王五", "租赁人名称不匹配"
        assert data["lease_info"]["monthly_rent"] == 1000.0, "月租不匹配"
        assert data["paid_amount"] == 3000.0, "已付金额不匹配"
        print(f"  ✅ 数据快照内容验证通过")

        # 检查时间格式
        try:
            datetime.strptime(v["created_at"], "%Y-%m-%d %H:%M:%S")
            print(f"  ✅ 时间格式正确: {v['created_at']}")
        except ValueError as e:
            print(f"  ❌ 时间格式错误: {e}")
            return False

        dm.close()

    print("  ✅ 版本数据格式验证通过\n")
    return True


def main():
    """运行所有测试"""
    print("\n" + "=" * 70)
    print("🧪 操作记录功能测试套件")
    print("=" * 70)

    tests = [
        ("DataManager 版本历史记录", test_data_manager_version_history),
        ("记录回滚功能", test_rollback_functionality),
        ("UI 方法存在性", test_ui_methods_exist),
        ("版本数据格式", test_version_data_format),
    ]

    passed = 0
    failed = 0
    failed_tests = []

    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
                failed_tests.append(name)
        except Exception as e:
            failed += 1
            failed_tests.append(name)
            print(f"  ❌ 测试 {name} 抛出异常: {e}")
            import traceback
            traceback.print_exc()

    # 总结
    print("\n" + "=" * 70)
    print("📊 测试总结")
    print("=" * 70)
    total = passed + failed
    print(f"✅ 通过: {passed}/{total}")
    print(f"❌ 失败: {failed}/{total}")

    if failed > 0:
        print(f"\n失败的测试:")
        for name in failed_tests:
            print(f"  - {name}")
        print("\n⚠️  部分测试失败，请检查上述错误信息。")
        sys.exit(1)
    else:
        print(f"\n🎉 所有测试通过！操作记录功能正常工作。")
        sys.exit(0)


if __name__ == "__main__":
    main()
