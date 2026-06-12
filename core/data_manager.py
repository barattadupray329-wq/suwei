#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据持久化管理模块
使用JSON文件作为数据存储，替代原有数据库方案
"""

import json
import os
import hashlib
import base64
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional


class DataManager:
    """数据管理器"""

    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.data_file = self.data_dir / "rental_data.json"
        self.data = self._load_data()

    def _load_data(self) -> Dict:
        """加载数据文件"""
        if self.data_file.exists():
            try:
                with open(self.data_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return self._get_default_data()
        return self._get_default_data()

    def _get_default_data(self) -> Dict:
        """获取默认数据结构"""
        salt_b64, hash_b64 = self._build_password_hash("admin123")
        return {
            "rental_records": [],
            "settings": {
                "default_admin": "admin",
                "password_salt": salt_b64,
                "password_hash": hash_b64,
                "failed_login_count": 0,
                "locked_until": None,
                "last_backup": None
            }
        }

    def _build_password_hash(self, password: str):
        """生成密码盐值和哈希（Base64）"""
        salt = os.urandom(16)
        pwd_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            120000
        )
        return (
            base64.b64encode(salt).decode("utf-8"),
            base64.b64encode(pwd_hash).decode("utf-8")
        )

    def verify_password(self, password: str) -> bool:
        """验证密码哈希"""
        settings = self.data.setdefault("settings", {})
        salt_b64 = settings.get("password_salt")
        hash_b64 = settings.get("password_hash")

        if not salt_b64 or not hash_b64:
            legacy_password = settings.get("default_password", "admin123")
            if password != legacy_password:
                return False
            salt_b64, hash_b64 = self._build_password_hash(legacy_password)
            settings["password_salt"] = salt_b64
            settings["password_hash"] = hash_b64
            settings.pop("default_password", None)
            self.save()
            return True

        try:
            salt = base64.b64decode(salt_b64.encode("utf-8"))
            expected_hash = base64.b64decode(hash_b64.encode("utf-8"))
            actual_hash = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt,
                120000
            )
            return actual_hash == expected_hash
        except Exception:
            return False

    def save(self):
        """保存数据到文件"""
        try:
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            return True
        except IOError as e:
            print(f"保存数据失败: {e}")
            return False

    def add_record(self, record: Dict) -> bool:
        """添加租赁记录"""
        if not record.get("id"):
            record["id"] = self._generate_id()
        record["register_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        record.setdefault("status", "在租")
        record.setdefault("paid_amount", 0)
        record.setdefault("renew_history", [])
        record.setdefault("hardware", {})
        self.data["rental_records"].append(record)
        return self.save()

    def update_record(self, record_id: str, updates: Dict) -> bool:
        """更新租赁记录"""
        for record in self.data["rental_records"]:
            if record.get("id") == record_id:
                record.update(updates)
                return self.save()
        return False

    def delete_record(self, record_id: str) -> bool:
        """删除租赁记录"""
        original_count = len(self.data["rental_records"])
        self.data["rental_records"] = [
            r for r in self.data["rental_records"] if r.get("id") != record_id
        ]
        if len(self.data["rental_records"]) < original_count:
            return self.save()
        return False

    def get_records(self) -> List[Dict]:
        """获取所有租赁记录"""
        return self.data["rental_records"]

    def get_record_by_id(self, record_id: str) -> Optional[Dict]:
        """根据ID获取单条记录"""
        for record in self.data["rental_records"]:
            if record.get("id") == record_id:
                return record
        return None

    def check_overdue(self) -> int:
        """检查并更新逾期记录"""
        from datetime import date
        today = date.today()
        updated = 0
        for record in self.data["rental_records"]:
            if record.get("status") == "在租":
                end_date_str = record.get("lease_info", {}).get("end_date", "")
                if end_date_str:
                    try:
                        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                        if end_date < today:
                            record["status"] = "已逾期"
                            updated += 1
                    except (ValueError, TypeError):
                        pass
        if updated > 0:
            self.save()
        return updated

    def _generate_id(self) -> str:
        """生成唯一ID"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"R{timestamp}"

    def get_stats(self) -> Dict:
        """获取统计信息"""
        records = self.data["rental_records"]
        return {
            "total": len(records),
            "active": sum(1 for r in records if r.get("status") == "在租"),
            "expired": sum(1 for r in records if r.get("status") == "已逾期"),
            "returned": sum(1 for r in records if r.get("status") == "已退租"),
            "lost": sum(1 for r in records if r.get("status") == "已丢失"),
            "bought": sum(1 for r in records if r.get("status") == "已买断"),
        }

    def backup_data(self) -> Optional[str]:
        """备份数据"""
        try:
            backup_file = self.data_dir / f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(backup_file, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            self.data["settings"]["last_backup"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.save()
            return str(backup_file)
        except IOError as e:
            print(f"备份数据失败: {e}")
            return None
