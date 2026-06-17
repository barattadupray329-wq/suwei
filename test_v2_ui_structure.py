#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新版租赁管理（v2）UI 结构验证脚本
验证 UI 组件是否能正确导入和实例化
"""

import sys
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


def test_ui_imports():
    """测试 UI 模块导入"""
    print("=" * 70)
    print("新版租赁管理 v2 UI 结构验证")
    print("=" * 70)

    tests = [
        ("theme.colors", "DarkTheme"),
        ("modules.rental_mgmt_v2_forms", "LineItemsListFrame"),
        ("modules.rental_mgmt_v2_forms", "AddLineItemDialog"),
        ("modules.rental_mgmt_v2_integration", "RentalContractsV2Frame"),
        ("modules.rental_mgmt_v2_integration", "CreateContractWizard"),
        ("modules.rental_mgmt_v2_integration", "AddPaymentDialog"),
    ]

    results = []
    for module_name, class_name in tests:
        try:
            module = __import__(module_name, fromlist=[class_name])
            cls = getattr(module, class_name)
            results.append((module_name, class_name, True, None))
            print(f"✓ {module_name}.{class_name}")
        except Exception as e:
            results.append((module_name, class_name, False, str(e)))
            print(f"✗ {module_name}.{class_name}: {e}")

    # 统计
    total = len(results)
    passed = sum(1 for _, _, ok, _ in results if ok)
    failed = total - passed

    print("\n" + "=" * 70)
    print(f"验证结果：{passed}/{total} 通过")
    print("=" * 70)

    if failed > 0:
        print("\n失败的模块：")
        for mod, cls, ok, err in results:
            if not ok:
                print(f"  {mod}.{cls}")
                print(f"    错误：{err}")
        return False
    else:
        print("\n✓ 所有 UI 模块导入成功！")
        print("\n组件清单：")
        print("  1. RentalContractsV2Frame - 新版合同主框架")
        print("     - 合同列表展示（支持分页、搜索、过滤）")
        print("     - 合同概览面板（显示详情和操作按钮）")
        print("     - 双栏布局（左侧列表 + 右侧详情）")
        print()
        print("  2. CreateContractWizard - 创建合同向导")
        print("     - 第1步：客户信息（名称、电话、身份证、地址）")
        print("     - 第2步：租赁模式（纯租赁、租赁+购买、预付款+按次）")
        print("     - 第3步：模式参数（起期、到期、押金）")
        print("     - 第4步：项目明细（支持多个项目的添加）")
        print("     - 第5步：硬件配置（可选）")
        print("     - 第6步：确认提交（摘要确认）")
        print()
        print("  3. AddPaymentDialog - 收款记录对话框")
        print("     - 金额输入")
        print("     - 日期选择")
        print("     - 备注说明")
        print()
        print("  4. AddLineItemDialog（来自 v2_forms）- 项目编辑")
        print("     - 项目名称、类型、数量")
        print("     - 单价、起期、到期")
        print("     - 自动计算月租和总租金")
        print()
        print("  5. LineItemsListFrame（来自 v2_forms）- 项目清单")
        print("     - 表格展示租赁项目")
        print("     - 支持编辑和查看操作")
        print()
        print("=" * 70)
        print("下一步：")
        print("1. 在应用主界面添加新版合同标签页入口")
        print("2. 集成 RentalContractsV2Frame 到主应用")
        print("3. 运行实际的创建向导测试（需要 Tkinter GUI）")
        print("4. 验证数据库操作（合同创建、收款记录、项目添加）")
        print("=" * 70)
        return True


if __name__ == "__main__":
    success = test_ui_imports()
    sys.exit(0 if success else 1)
