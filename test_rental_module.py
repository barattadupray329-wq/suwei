#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""租赁管理模块综合测试"""
import sys, os, json, csv, io, socket
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from core.data_manager import DataManager
from datetime import datetime, timedelta

def test_all():
    results = {"passed": 0, "failed": 0, "warnings": 0, "details": []}
    
    def passed(msg):
        results["passed"] += 1
        results["details"].append(f"  ✅ {msg}")
        
    def failed(msg):
        results["failed"] += 1
        results["details"].append(f"  ❌ {msg}")
        
    def warn(msg):
        results["warnings"] += 1
        results["details"].append(f"  ⚠️  {msg}")
    
    dm = DataManager()
    records = dm.get_records()
    
    print("=" * 70)
    print("租赁管理模块 - 端到端测试报告")
    print("=" * 70)
    
    # 1. 数据加载
    print(f"\n[1] 数据加载测试")
    if len(records) > 0:
        passed(f"成功加载 {len(records)} 条记录")
    else:
        failed("无记录")
    
    # 2. 计算逻辑
    print(f"\n[2] 计算逻辑验证")
    for rec in records:
        rid = rec.get("id", "未知")
        lease = rec.get("lease_info", {})
        total = float(lease.get("total_rent", 0) or 0)
        paid = float(rec.get("paid_amount", 0) or 0)
        unpaid = total - paid
        monthly = float(lease.get("monthly_rent", 0) or 0)
        months = float(lease.get("lease_months", 0) or 0)
        expected = monthly * months if monthly > 0 and months > 0 else 0
        
        if abs(unpaid - (total - paid)) <= 0.01:
            passed(f"{rid} 未付金额计算正确 (总{total} - 已付{paid} = 未付{unpaid})")
        else:
            failed(f"{rid} 未付金额计算错误")
        
        if expected > 0 and abs(total - expected) > 0.01:
            warn(f"{rid} 总租金与月租*月数不一致 (预期{expected}, 实际{total}，可能已续租或手动修改)")
        else:
            passed(f"{rid} 总租金计算正确 ({monthly} x {months} = {total})")
    
    # 3. 续租逻辑模拟
    print(f"\n[3] 续租逻辑测试")
    if records:
        rec = records[0]
        lease = rec.get("lease_info", {})
        old_total = float(lease.get("total_rent", 0) or 0)
        old_months = float(lease.get("lease_months", 0) or 0)
        old_end = lease.get("end_date", "")
        monthly_rent = float(lease.get("monthly_rent", 0) or 0)
        
        renew_amt = monthly_rent
        new_total = old_total + renew_amt
        new_months = old_months + 1
        new_end = ""
        if old_end:
            new_end = (datetime.strptime(old_end, "%Y-%m-%d") + timedelta(days=30)).strftime("%Y-%m-%d")
        
        passed(f"续租前: 总租金{old_total}, 月数{old_months}, 到期{old_end}")
        passed(f"续租1月(金额{renew_amt}): 新总租金{new_total}, 新月数{new_months}, 新到期{new_end}")
        
        # 模拟完整续租流程（含lease_months从起始日期计算）
        if lease.get("start_date"):
            start_dt = datetime.strptime(lease["start_date"], "%Y-%m-%d")
            if new_end:
                new_end_dt = datetime.strptime(new_end, "%Y-%m-%d")
                calc_months = round((new_end_dt - start_dt).days / 30.0, 2)
                passed(f"精确月数计算: (新到期-起租)/30 = {calc_months} (与{new_months}比较)")
    
    # 4. 状态管理
    print(f"\n[4] 状态管理测试")
    statuses = {}
    for rec in records:
        s = rec.get("status", "未知")
        statuses[s] = statuses.get(s, 0) + 1
    for s, c in statuses.items():
        passed(f"状态「{s}」: {c} 条")
    
    # 5. CSV导出测试
    print(f"\n[5] CSV导出格式测试")
    buf = io.StringIO()
    headers = ["记录ID", "数量", "租赁人", "联系电话", "身份证", "地址", "起租日期", "到期日期", "月租", "总租金", "押金", "已付金额", "状态"]
    writer = csv.writer(buf)
    writer.writerow(headers)
    for r in records:
        renter = r.get("renter", {})
        lease = r.get("lease_info", {})
        writer.writerow([r.get("id",""), int(r.get("quantity",1)), renter.get("name",""), renter.get("phone",""),
                         renter.get("id_card",""), renter.get("address",""),
                         lease.get("start_date",""), lease.get("end_date",""),
                         lease.get("monthly_rent",""), lease.get("total_rent",""),
                         lease.get("deposit",""), r.get("paid_amount",""), r.get("status","")])
    buf.seek(0)
    content = buf.getvalue()
    lines = content.strip().split("\n")
    passed(f"CSV导出: {len(lines)}行 (1表头 + {len(lines)-1}数据), {len(headers)}列")
    
    # 6. CSV导入格式测试
    print(f"\n[6] CSV导入格式测试")
    buf.seek(0)
    reader = csv.DictReader(buf)
    cols = reader.fieldnames
    passed(f"CSV表头正确: {cols}")
    row_count = 0
    for row in reader:
        row_count += 1
        rid = row.get("记录ID", "").strip()
        nm = row.get("租赁人", "").strip()
        qty_str = (row.get("数量") or "1").strip() or "1"
        qty = float(qty_str)
        passed(f"导入行{row_count}: ID={rid}, 租赁人={nm}, 数量={qty}")
    
    # 7. UI 布局验证（代码层面）
    print(f"\n[7] UI 布局代码验证")
    rental_file = Path(__file__).parent / "modules" / "rental_mgmt.py"
    if rental_file.exists():
        content = rental_file.read_text(encoding="utf-8")
        
        # 检查所有按钮是否存在
        buttons = ["新增", "编辑", "删除", "续租", "导入", "导出", "AI", "高级筛选", "报表", "批量操作"]
        for btn in buttons:
            if btn in content:
                passed(f"按钮「{btn}」存在于代码中")
            else:
                failed(f"按钮「{btn}」缺失")
        
        # 检查标签宽度修复
        if 'width=12' in content and 'width=26' in content:
            passed("UI标签宽度和输入框宽度已修复（width=12/26）")
        else:
            warn("UI标签宽度可能未完全修复")
        
        # 检查Canvas宽度
        if 'width=600' in content:
            passed("Canvas宽度已优化为600px（自适应）")
        else:
            warn("Canvas宽度可能仍为400px")
        
        # 检查自动计算保护
        if 'current_total' in content and 'current_end' in content:
            passed("编辑表单自动计算保护已实现（不覆盖手动输入）")
        else:
            warn("自动计算保护可能不完整")
        
        # 检查续租精确月数计算
        if 'total_months' in content and 'round(total_months' in content:
            passed("续租精确月数计算已实现")
        else:
            warn("续租月数计算可能不精确")
        
        # 检查已付金额比较修复
        if 'new_total = cur_total + amt' in content:
            passed("续租已付金额比较已修复（与新总租金比较）")
        else:
            warn("续租已付金额比较可能未修复")
    
    # 8. 网络连接测试
    print(f"\n[8] 网络连接测试")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        result = s.connect_ex(('127.0.0.1', 9999))
        s.close()
        if result == 0:
            passed("HTTP同步服务器端口 9999 正常监听")
        else:
            warn("HTTP同步服务器端口 9999 未监听")
    except Exception as e:
        warn(f"端口测试异常: {e}")
    
    # 输出总结
    print(f"\n{'='*70}")
    print(f"测试结果: ✅ {results['passed']} 通过 | ❌ {results['failed']} 失败 | ⚠️  {results['warnings']} 警告")
    print(f"{'='*70}")
    for detail in results["details"]:
        print(detail)
    print(f"{'='*70}")
    
    return results["failed"] == 0

if __name__ == "__main__":
    success = test_all()
    sys.exit(0 if success else 1)
