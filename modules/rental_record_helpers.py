#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
租赁记录历史追踪辅助函数
支持硬件变更记录、租金变更记录的添加与查询
"""

from datetime import datetime


def append_hardware_change(record: dict, note: str, operator: str = "系统"):
    """
    添加硬件配置变更记录
    
    Args:
        record: 租赁记录字典
        note: 变更说明 (e.g., "笔记本替换为台式机"，"硬件升级")
        operator: 操作人名称，默认"系统"
    """
    if not isinstance(record, dict):
        return False
    
    record.setdefault("hardware_history", [])
    change_entry = {
        "change_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "note": note,
        "operator": operator
    }
    record["hardware_history"].append(change_entry)
    return True


def append_rent_change(
    record: dict,
    old_monthly_rent: float,
    new_monthly_rent: float,
    old_total_rent: float,
    new_total_rent: float,
    reason: str = "客户要求调整",
    operator: str = "系统"
) -> bool:
    """
    添加租金变更记录
    
    Args:
        record: 租赁记录字典
        old_monthly_rent: 原月租金
        new_monthly_rent: 新月租金
        old_total_rent: 原总租金
        new_total_rent: 新总租金
        reason: 变更原因 (e.g., "硬件升级", "价格调整", "续租费率变化")
        operator: 操作人名称，默认"系统"
    """
    if not isinstance(record, dict):
        return False
    
    record.setdefault("rent_change_history", [])
    change_entry = {
        "change_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "old_monthly_rent": f"{float(old_monthly_rent):.2f}",
        "new_monthly_rent": f"{float(new_monthly_rent):.2f}",
        "old_total_rent": f"{float(old_total_rent):.2f}",
        "new_total_rent": f"{float(new_total_rent):.2f}",
        "reason": reason,
        "operator": operator
    }
    record["rent_change_history"].append(change_entry)
    return True


def get_hardware_changes(record: dict) -> list:
    """获取硬件变更历史"""
    return record.get("hardware_history", []) if isinstance(record, dict) else []


def get_rent_changes(record: dict) -> list:
    """获取租金变更历史"""
    return record.get("rent_change_history", []) if isinstance(record, dict) else []
