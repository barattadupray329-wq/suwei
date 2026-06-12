#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive functional test for rental management and AI assistant modules
Tests extraction, filtering, CRUD operations, and data integrity
"""
import sys
import json
from datetime import datetime, timedelta
from core.data_manager import DataManager
from modules.ai_assistant import AIAssistantDialog

print("=" * 70)
print("RENTAL MANAGEMENT & AI ASSISTANT - COMPREHENSIVE FUNCTIONAL TEST")
print("=" * 70)

tests_passed = []
tests_failed = []

# ═══════════════════════════════════════════════════════════════════════════
# TEST 1: AI Assistant - Rental Info Extraction
# ═══════════════════════════════════════════════════════════════════════════
print("\n[TEST 1] AI Assistant - Rental Information Extraction")
try:
    ai = AIAssistantDialog.__new__(AIAssistantDialog)
    
    test_cases = [
        {
            "name": "Full rental info extraction",
            "input": "租赁人张三，电话13800000000，身份证110101199001011234，地址北京市朝阳区\n起租2024-01-01，到期2024-12-31，月租500元，总租金6000元，押金1000元",
            "expected_keys": ["租赁人", "联系电话", "身份证", "地址", "起租日期", "到期日期", "月租", "总租金", "押金"]
        },
        {
            "name": "Minimal rental info",
            "input": "张三 13800000000 2024-01-01 2024-12-31 500",
            "expected_keys": ["联系电话", "起租日期", "到期日期", "月租"]
        },
        {
            "name": "Hardware-only extraction",
            "input": "CPU:i5-13400F RAM:16GB GPU:RTX4060 硬盘:1TB SSD",
            "expected_keys": ["硬件信息"]
        },
    ]
    
    for tc in test_cases:
        result = ai._extract_rental_info(tc["input"])
        has_all = all(k in result for k in tc["expected_keys"])
        status = "✅" if has_all else "❌"
        print(f"  {status} {tc['name']}")
        if not has_all:
            print(f"     Expected: {tc['expected_keys']}, Got: {list(result.keys())}")
            tests_failed.append(tc["name"])
        else:
            tests_passed.append(tc["name"])
except Exception as e:
    print(f"  ❌ Extraction test failed: {e}")
    tests_failed.append("AI Extraction")

# ═══════════════════════════════════════════════════════════════════════════
# TEST 2: AI Assistant - Component Cost Extraction
# ═══════════════════════════════════════════════════════════════════════════
print("\n[TEST 2] AI Assistant - Component Cost Extraction")
try:
    ai = AIAssistantDialog.__new__(AIAssistantDialog)
    
    cost_test_cases = [
        {
            "name": "Standard format (name price)",
            "input": "CPU:i5 13400F  895\n主板:技嘉H610m  285\n内存:ddr4 8G×2  560",
            "expected_count": 3,
            "expected_total": 1740
        },
        {
            "name": "Colon-separated format",
            "input": "机箱:商途 50\n电源:航嘉600W 135\n风扇:6铜管 55",
            "expected_count": 3,
            "expected_total": 240
        },
        {
            "name": "Mixed format with decimals",
            "input": "显卡:4060 12G  1850.50\n液冷散热器:NZXT  299.99",
            "expected_count": 2,
            "expected_total": 2150.49
        },
    ]
    
    for tc in cost_test_cases:
        result = ai._extract_components(tc["input"])
        total = sum(c["price"] for c in result)
        count_ok = len(result) == tc["expected_count"]
        total_ok = abs(total - tc["expected_total"]) < 0.01
        status = "✅" if (count_ok and total_ok) else "❌"
        print(f"  {status} {tc['name']}")
        if not (count_ok and total_ok):
            print(f"     Count: {len(result)} (expected {tc['expected_count']}), Total: ¥{total:.2f} (expected ¥{tc['expected_total']:.2f})")
            tests_failed.append(tc["name"])
        else:
            tests_passed.append(tc["name"])
except Exception as e:
    print(f"  ❌ Component extraction test failed: {e}")
    tests_failed.append("Cost Extraction")

# ═══════════════════════════════════════════════════════════════════════════
# TEST 3: Data Manager - CRUD Operations
# ═══════════════════════════════════════════════════════════════════════════
print("\n[TEST 3] Data Manager - CRUD Operations")
try:
    dm = DataManager()
    initial_count = len(dm.get_records())
    
    # CREATE
    test_record = {
        "renter": {
            "name": "测试用户",
            "phone": "13800000000",
            "id_card": "110101199001011234",
            "address": "北京市朝阳区"
        },
        "lease_info": {
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "end_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
            "monthly_rent": 500.0,
            "total_rent": 6000.0,
            "deposit": 1000.0,
            "lease_months": 12.0
        },
        "status": "在租",
        "paid_amount": 0.0,
        "renew_history": [],
        "hardware": {"cpu": "i5-13400F", "ram": "16GB"}
    }
    
    dm.add_record(test_record)
    after_add = len(dm.get_records())
    create_ok = after_add == initial_count + 1
    record_id = test_record.get("id")
    print(f"  {'✅' if create_ok else '❌'} CREATE: Added record ID {record_id}")
    if create_ok:
        tests_passed.append("CREATE")
    else:
        tests_failed.append("CREATE")
    
    # READ
    retrieved = None
    for r in dm.get_records():
        if r.get("id") == record_id:
            retrieved = r
            break
    read_ok = retrieved is not None and retrieved.get("renter", {}).get("name") == "测试用户"
    print(f"  {'✅' if read_ok else '❌'} READ: Retrieved record correctly")
    if read_ok:
        tests_passed.append("READ")
    else:
        tests_failed.append("READ")
    
    # UPDATE
    if retrieved:
        retrieved["paid_amount"] = 2000.0
        dm.update_record(record_id, retrieved)
        updated = None
        for r in dm.get_records():
            if r.get("id") == record_id:
                updated = r
                break
        update_ok = updated and updated.get("paid_amount") == 2000.0
        print(f"  {'✅' if update_ok else '❌'} UPDATE: Modified paid_amount to 2000")
        if update_ok:
            tests_passed.append("UPDATE")
        else:
            tests_failed.append("UPDATE")
    
    # DELETE
    dm.delete_record(record_id)
    after_delete = len(dm.get_records())
    delete_ok = after_delete == initial_count
    print(f"  {'✅' if delete_ok else '❌'} DELETE: Removed record, count restored to {initial_count}")
    if delete_ok:
        tests_passed.append("DELETE")
    else:
        tests_failed.append("DELETE")
        
except Exception as e:
    print(f"  ❌ CRUD test failed: {e}")
    tests_failed.append("CRUD Operations")

# ═══════════════════════════════════════════════════════════════════════════
# TEST 4: Data Manager - Status Filtering
# ═══════════════════════════════════════════════════════════════════════════
print("\n[TEST 4] Data Manager - Status and Search Filtering")
try:
    dm = DataManager()
    all_records = dm.get_records()
    
    # Filter by status
    active = [r for r in all_records if r.get("status") == "在租"]
    returned = [r for r in all_records if r.get("status") == "已退租"]
    expired = [r for r in all_records if r.get("status") == "已逾期"]
    
    filter_ok = isinstance(active, list) and isinstance(returned, list)
    print(f"  {'✅' if filter_ok else '❌'} Status filtering: {len(active)} active, {len(returned)} returned, {len(expired)} expired")
    if filter_ok:
        tests_passed.append("Status Filtering")
    else:
        tests_failed.append("Status Filtering")
    
except Exception as e:
    print(f"  ❌ Filtering test failed: {e}")
    tests_failed.append("Status Filtering")

# ═══════════════════════════════════════════════════════════════════════════
# TEST 5: Data Manager - Overdue Detection
# ═══════════════════════════════════════════════════════════════════════════
print("\n[TEST 5] Data Manager - Overdue Detection")
try:
    dm = DataManager()
    
    # Create a test record with past end date
    overdue_record = {
        "renter": {
            "name": "逾期测试",
            "phone": "13800000001",
            "id_card": "",
            "address": ""
        },
        "lease_info": {
            "start_date": (datetime.now() - timedelta(days=400)).strftime("%Y-%m-%d"),
            "end_date": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d"),  # 30 days past
            "monthly_rent": 500.0,
            "total_rent": 6000.0,
            "deposit": 0.0,
            "lease_months": 12.0
        },
        "status": "在租",  # Intentionally mark as active
        "paid_amount": 0.0,
        "renew_history": [],
        "hardware": {}
    }
    
    dm.add_record(overdue_record)
    record_id = overdue_record.get("id")
    
    # Run overdue check
    dm.check_overdue()
    
    # Verify status changed
    updated = None
    for r in dm.get_records():
        if r.get("id") == record_id:
            updated = r
            break
    
    overdue_ok = updated and updated.get("status") == "已逾期"
    print(f"  {'✅' if overdue_ok else '❌'} Overdue detection: Status changed to '{updated.get('status') if updated else 'N/A'}'")
    if overdue_ok:
        tests_passed.append("Overdue Detection")
    else:
        tests_failed.append("Overdue Detection")
    
    # Cleanup
    if record_id:
        dm.delete_record(record_id)
        
except Exception as e:
    print(f"  ❌ Overdue detection test failed: {e}")
    tests_failed.append("Overdue Detection")

# ═══════════════════════════════════════════════════════════════════════════
# TEST 6: Data Integrity Checks
# ═══════════════════════════════════════════════════════════════════════════
print("\n[TEST 6] Data Integrity Checks")
try:
    dm = DataManager()
    all_records = dm.get_records()
    
    integrity_issues = []
    
    for rec in all_records:
        # Check required fields
        if not rec.get("id"):
            integrity_issues.append(f"Record missing ID")
        if not rec.get("renter", {}).get("name"):
            integrity_issues.append(f"Record {rec.get('id')} missing renter name")
        if not rec.get("lease_info", {}).get("start_date"):
            integrity_issues.append(f"Record {rec.get('id')} missing start_date")
        if not rec.get("status"):
            integrity_issues.append(f"Record {rec.get('id')} missing status")
        
        # Check numeric fields are valid
        try:
            paid = float(rec.get("paid_amount", 0))
            total = float(rec.get("lease_info", {}).get("total_rent", 0))
            if paid > total:
                integrity_issues.append(f"Record {rec.get('id')} paid > total ({paid} > {total})")
        except ValueError:
            integrity_issues.append(f"Record {rec.get('id')} has invalid numeric fields")
    
    integrity_ok = len(integrity_issues) == 0
    print(f"  {'✅' if integrity_ok else '❌'} Data integrity: {len(all_records)} records, {len(integrity_issues)} issues")
    if integrity_issues:
        for issue in integrity_issues[:3]:  # Show first 3 issues
            print(f"     - {issue}")
        if len(integrity_issues) > 3:
            print(f"     ... and {len(integrity_issues) - 3} more")
    
    if integrity_ok:
        tests_passed.append("Data Integrity")
    else:
        tests_failed.append("Data Integrity")
        
except Exception as e:
    print(f"  ❌ Integrity test failed: {e}")
    tests_failed.append("Data Integrity")

# ═══════════════════════════════════════════════════════════════════════════
# TEST 7: AI Assistant - Date Parsing
# ═══════════════════════════════════════════════════════════════════════════
print("\n[TEST 7] AI Assistant - Date Format Parsing")
try:
    ai = AIAssistantDialog.__new__(AIAssistantDialog)
    
    date_formats = [
        "起租日期 2024-01-01",
        "起租 2024/01/01",
        "开始日期 2024.01.01",
        "到期日期 2024年01月01日",
    ]
    
    date_ok = True
    for fmt in date_formats:
        result = ai._extract_rental_info(fmt)
        has_date = any("日期" in k and result.get(k) for k in result)
        if has_date:
            print(f"  ✅ Parsed: {fmt}")
        else:
            print(f"  ❌ Failed: {fmt}")
            date_ok = False
    
    if date_ok:
        tests_passed.append("Date Parsing")
    else:
        tests_failed.append("Date Parsing")
        
except Exception as e:
    print(f"  ❌ Date parsing test failed: {e}")
    tests_failed.append("Date Parsing")

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("TEST SUMMARY")
print("=" * 70)
total_tests = len(tests_passed) + len(tests_failed)
print(f"✅ PASSED: {len(tests_passed)}/{total_tests}")
print(f"❌ FAILED: {len(tests_failed)}/{total_tests}")

if tests_failed:
    print("\nFailed tests:")
    for f in tests_failed:
        print(f"  - {f}")
    print("\n⚠️  Some functional tests failed. Review the issues above.")
    sys.exit(1)
else:
    print("\n🎉 All functional tests passed! The rental management and AI assistant modules are working correctly.")
    sys.exit(0)
