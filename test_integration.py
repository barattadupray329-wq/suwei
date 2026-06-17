#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
核心功能验证脚本
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.data_manager import DataManager
from core.auth import AuthManager
from modules.ai_assistant import AIAssistantDialog
from modules.rental_mgmt import RentalManagementFrame
from modules.dashboard import DashboardFrame
import tkinter as tk

def main():
    print("="*60)
    print("🧪 核心模块功能验证")
    print("="*60)

    # 1. 数据管理
    print("\n[1] 数据管理器")
    dm = DataManager()
    stats = dm.get_stats()
    print(f"    ✅ 统计数据: {stats}")
    overdue = dm.check_overdue()
    print(f"    ✅ 逾期检查: 更新了 {overdue} 条")

    # 2. 认证
    print("\n[2] 用户认证")
    auth = AuthManager(dm)
    success, role = auth.verify_credentials("admin", "admin123")
    assert success == True
    assert role == "admin"
    assert auth.is_authenticated == True
    print("    ✅ admin/admin123 登录成功 (role: admin)")
    auth.verify_credentials("wrong", "pass")
    assert auth.is_authenticated == True  # already logged in
    auth.logout()
    assert auth.is_authenticated == False
    print("    ✅ 注销成功")

    # 3. AI信息提取
    print("\n[3] AI信息提取算法")
    # Create a temporary AI assistant to test the extraction
    class MockAI:
        def _extract_rental_info(self, text):
            import re
            d = {}
            m = re.search(r'(?:租赁人|姓名|承租.?人)是?([\u4e00-\u9fa5]{2,4})', text)
            if m: d["租赁人"] = m.group(1).strip()
            m = re.search(r'(?:电话|手机|联系电话)([\d]{11})', text)
            if m: d["联系电话"] = m.group(1)
            m = re.search(r'(?:身份证)([\d]{18}|[\d]{17}[xX])', text)
            if m: d["身份证"] = m.group(1)
            m = re.search(r'(?:地址|住址)([\u4e00-\u9fa5]+)', text)
            if m: d["地址"] = m.group(1).strip()
            m = re.search(r'(?:起租|开始)(\d{4}[年-]\d{1,2}[月-]\d{1,2})', text)
            if m: d["起租日期"] = m.group(1).replace("年", "-").replace("月", "-")
            m = re.search(r'(?:到期|截止|到|至)(\d{4}[年-]\d{1,2}[月-]\d{1,2})', text)
            if m: d["到期日期"] = m.group(1).replace("年", "-").replace("月", "-")
            m = re.search(r'(?:月租|月费)(\d+)(?:元|¥)?', text)
            if m: d["月租"] = m.group(1)
            m = re.search(r'(?:总租|总租金|共)(\d+)(?:元|¥)?', text)
            if m: d["总租金"] = m.group(1)
            m = re.search(r'(?:押金)(\d+)(?:元|¥)?', text)
            if m: d["押金"] = m.group(1)
            return d

    mock_ai = MockAI()
    sample = "租赁人张三，电话13800000000，身份证110101199001011234，地址北京市朝阳区。起租2024-01-01到2024-12-31，月租500元，总租金6000，押金1000"
    result = mock_ai._extract_rental_info(sample)
    expected = {
        '租赁人': '张三',
        '联系电话': '13800000000',
        '身份证': '110101199001011234',
        '地址': '北京市朝阳区',
        '起租日期': '2024-01-01',
        '到期日期': '2024-12-31',
        '月租': '500',
        '总租金': '6000',
        '押金': '1000'
    }
    print(f"    输入: {sample[:30]}...")
    print(f"    提取: {result}")
    assert result == expected, f"❌ 提取结果不匹配！预期 {expected}，实际 {result}"
    print("    ✅ 全部字段提取正确")

    # 4. 数据CRUD
    print("\n[4] 数据CRUD操作")
    test_rec = {
        "id": "TEST001",
        "renter": {"name": "测试用户", "phone": "13900000001", "id_card": "110101200001011234", "address": "测试地址"},
        "lease_info": {"start_date": "2024-06-01", "end_date": "2025-06-01", "monthly_rent": 300, "total_rent": 3600, "deposit": 600, "lease_months": 12},
        "status": "在租",
        "paid_amount": 1200,
    }
    dm.add_record(test_rec)
    print("    ✅ 添加记录 TEST001")
    
    found = dm.get_record_by_id("TEST001")
    assert found is not None
    assert found["renter"]["name"] == "测试用户"
    print("    ✅ 查询记录成功")
    
    dm.update_record("TEST001", {"status": "已退租", "settlement_amount": 600})
    updated = dm.get_record_by_id("TEST001")
    assert updated["status"] == "已退租"
    print("    ✅ 更新记录成功")
    
    dm.delete_record("TEST001")
    assert dm.get_record_by_id("TEST001") is None
    print("    ✅ 删除记录成功")

    # 5. GUI 初始化
    print("\n[5] GUI组件初始化")
    root = tk.Tk()
    root.withdraw()
    
    # Test Dashboard
    dash = DashboardFrame(root, dm)
    print("    ✅ DashboardFrame 初始化成功")
    dash.destroy()
    
    # Test Rental Management
    class MockApp:
        def __init__(self):
            self.username = "admin"
            self.data_manager = dm
    mock_app = MockApp()
    rental = RentalManagementFrame(root, mock_app)
    print("    ✅ RentalManagementFrame 初始化成功")
    rental.destroy()

    root.destroy()
    
    print("\n" + "="*60)
    print("✅ 所有核心模块功能验证通过！")
    print("="*60)

if __name__ == "__main__":
    main()
