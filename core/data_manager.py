#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据持久化管理模块
SQLite 作为主存储，支持自动 Migration、JSON 首次导入、记录版本回溯。
"""

import base64
import hashlib
import json
import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("suwei_app")


class DataManager:
    """数据管理器：对外保持原有 JSON 字典 API，内部使用 SQLite。"""

    DB_VERSION = 6

    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.data_file = self.data_dir / "rental_data.json"
        self.db_file = self.data_dir / "rental_data.db"
        self.conn = sqlite3.connect(str(self.db_file))
        self.conn.row_factory = sqlite3.Row
        self._migrate()
        self._import_json_if_needed()
        self.data = self._load_data()
        self._init_brand_defaults()

    # ── Migration ──────────────────────────────────────────────────────

    def _migrate(self):
        """自动执行数据库迁移。"""
        current = self._get_schema_version()
        if current < 1:
            self._migration_001_initial_schema()
            self._set_schema_version(1)
        if current < 2:
            self._migration_002_brand_library()
            self._set_schema_version(2)
        if current < 3:
            self._migration_003_hardware_models()
            self._set_schema_version(3)
        if current < 4:
            self._migration_004_brand_library_refactor()
            self._set_schema_version(4)
        if current < 5:
            self._migration_005_sync_models()
            self._set_schema_version(5)
        if current < 6:
            self._migration_006_rental_v2_schema()
            self._set_schema_version(6)
        if self._get_schema_version() > self.DB_VERSION:
            raise RuntimeError("数据库版本高于当前程序支持版本，请升级程序后再运行")

    def _get_schema_version(self) -> int:
        row = self.conn.execute("PRAGMA user_version").fetchone()
        return int(row[0]) if row else 0

    def _set_schema_version(self, version: int):
        self.conn.execute(f"PRAGMA user_version = {int(version)}")
        self.conn.commit()

    def _migration_001_initial_schema(self):
        """Migration 001：初始表结构。"""
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS rental_records (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                status TEXT,
                renter_name TEXT,
                renter_phone TEXT,
                start_date TEXT,
                end_date TEXT,
                register_date TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_rental_records_status
                ON rental_records(status);
            CREATE INDEX IF NOT EXISTS idx_rental_records_renter_name
                ON rental_records(renter_name);
            CREATE INDEX IF NOT EXISTS idx_rental_records_end_date
                ON rental_records(end_date);

            CREATE TABLE IF NOT EXISTS record_versions (
                version_id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id TEXT NOT NULL,
                action TEXT NOT NULL,
                data TEXT,
                created_at TEXT NOT NULL,
                note TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_record_versions_record_id
                ON record_versions(record_id);
            """
        )
        self.conn.commit()

    def _migration_002_brand_library(self):
        """Migration 002：硬件品牌库表。"""
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS hardware_brands (
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                PRIMARY KEY (category, name)
            )
            """
        )
        self.conn.commit()

    def _migration_003_hardware_models(self):
        """Migration 003：硬件型号库表。"""
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS hardware_models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                brand TEXT NOT NULL,
                model_name TEXT NOT NULL,
                specs TEXT,
                reference_cost REAL,
                reference_rent REAL,
                release_year INTEGER,
                is_active INTEGER DEFAULT 1,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_hardware_models_category ON hardware_models(category);
            CREATE INDEX IF NOT EXISTS idx_hardware_models_brand ON hardware_models(brand);
            CREATE INDEX IF NOT EXISTS idx_hardware_models_name ON hardware_models(model_name);
            """
        )
        self.conn.commit()
        # 初始化硬件型号数据
        self._init_hardware_model_defaults()

    def _migration_004_brand_library_refactor(self):
        """Migration 004：重构品牌库，分离品牌和型号"""
        # 备份旧数据
        old_brands = self.conn.execute(
            "SELECT category, name FROM hardware_brands"
        ).fetchall()
        
        # 清空旧表
        self.conn.execute("DELETE FROM hardware_brands")
        
        # 导入新品牌数据
        from modules.hardware_brands import BRAND_MAP
        inserted = set()
        for category, brands in BRAND_MAP.items():
            for idx, brand in enumerate(brands):
                key = (category, brand)
                if key not in inserted:
                    try:
                        self.conn.execute(
                            "INSERT INTO hardware_brands(category, name, sort_order) VALUES(?, ?, ?)",
                            (category, brand, idx)
                        )
                        inserted.add(key)
                    except sqlite3.IntegrityError:
                        pass
        
        self.conn.commit()
        
        # 从旧数据中提取可能遗漏的品牌
        for row in old_brands:
            category, full_name = row["category"], row["name"]
            # 简单处理：如果旧名称包含型号，提取品牌部分
            brand_name = self._extract_brand_from_full_name(full_name)
            if brand_name:
                try:
                    self.conn.execute(
                        "INSERT INTO hardware_brands(category, name, sort_order) VALUES(?, ?, ?)",
                        (category, brand_name, 999)
                    )
                    inserted.add((category, brand_name))
                except sqlite3.IntegrityError:
                    pass
        
        self.conn.commit()

    def _migration_005_sync_models(self):
        """Migration 005：同步硬件型号库，补充常用二手/老平台型号"""
        from modules.hardware_models import HARDWARE_MODELS
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 获取数据库中已有型号的 (category, brand, model_name) 组合
        existing = set()
        rows = self.conn.execute(
            "SELECT category, brand, model_name FROM hardware_models"
        ).fetchall()
        for r in rows:
            existing.add((r["category"], r["brand"], r["model_name"]))
        
        added, updated = 0, 0
        for model in HARDWARE_MODELS:
            key = (model["category"], model["brand"], model["model_name"])
            if key not in existing:
                try:
                    self.conn.execute(
                        """INSERT INTO hardware_models(
                            category, brand, model_name, specs, reference_cost,
                            reference_rent, release_year, is_active, updated_at
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            model["category"],
                            model["brand"],
                            model["model_name"],
                            json.dumps(model.get("specs", {}), ensure_ascii=False),
                            model.get("reference_cost"),
                            model.get("reference_rent"),
                            model.get("release_year"),
                            1,
                            now,
                        ),
                    )
                    added += 1
                except sqlite3.IntegrityError:
                    pass
            else:
                # 更新已有型号的参考价格/月租
                try:
                    self.conn.execute(
                        """UPDATE hardware_models 
                           SET specs = ?, reference_cost = ?, reference_rent = ?, 
                               release_year = ?, is_active = 1, updated_at = ?
                           WHERE category = ? AND brand = ? AND model_name = ?""",
                        (
                            json.dumps(model.get("specs", {}), ensure_ascii=False),
                            model.get("reference_cost"),
                            model.get("reference_rent"),
                            model.get("release_year"),
                            now,
                            model["category"],
                            model["brand"],
                            model["model_name"],
                        ),
                    )
                    updated += 1
                except sqlite3.IntegrityError:
                    pass
        
        self.conn.commit()
        logger.info(f"[Migration 005] 型号同步完成：新增 {added} 条，更新 {updated} 条")

    def _migration_006_rental_v2_schema(self):
        """Migration 006：新版租赁合同、项目、变更历史和审计表。"""
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS rental_contracts (
                contract_id TEXT PRIMARY KEY,
                old_record_id TEXT,
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                customer_id_card TEXT,
                customer_address TEXT,
                contract_start_date TEXT NOT NULL,
                contract_end_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '在租',
                deposit REAL DEFAULT 0,
                total_rent REAL DEFAULT 0,
                paid_amount REAL DEFAULT 0,
                unpaid_amount REAL DEFAULT 0,
                created_by TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                notes TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_rental_contracts_customer_name
                ON rental_contracts(customer_name);
            CREATE INDEX IF NOT EXISTS idx_rental_contracts_customer_phone
                ON rental_contracts(customer_phone);
            CREATE INDEX IF NOT EXISTS idx_rental_contracts_status
                ON rental_contracts(status);
            CREATE INDEX IF NOT EXISTS idx_rental_contracts_end_date
                ON rental_contracts(contract_end_date);

            CREATE TABLE IF NOT EXISTS rental_line_items (
                item_id TEXT PRIMARY KEY,
                contract_id TEXT NOT NULL,
                item_name TEXT NOT NULL,
                item_type TEXT DEFAULT '电脑',
                item_order INTEGER DEFAULT 0,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_monthly_rent REAL NOT NULL DEFAULT 0,
                monthly_rent REAL NOT NULL DEFAULT 0,
                total_rent REAL NOT NULL DEFAULT 0,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                hardware_snapshot_json TEXT,
                current_hardware_json TEXT,
                status TEXT NOT NULL DEFAULT '在租',
                created_by TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (contract_id) REFERENCES rental_contracts(contract_id)
            );

            CREATE INDEX IF NOT EXISTS idx_rental_line_items_contract
                ON rental_line_items(contract_id);
            CREATE INDEX IF NOT EXISTS idx_rental_line_items_status
                ON rental_line_items(status);
            CREATE INDEX IF NOT EXISTS idx_rental_line_items_type
                ON rental_line_items(item_type);

            CREATE TABLE IF NOT EXISTS rental_hardware_change_logs (
                change_id TEXT PRIMARY KEY,
                contract_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                change_date TEXT NOT NULL,
                change_type TEXT NOT NULL,
                change_reason TEXT,
                old_hardware_json TEXT,
                new_hardware_json TEXT,
                cost_amount REAL DEFAULT 0,
                cost_type TEXT,
                responsible_person TEXT,
                operator_name TEXT,
                created_at TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (contract_id) REFERENCES rental_contracts(contract_id),
                FOREIGN KEY (item_id) REFERENCES rental_line_items(item_id)
            );

            CREATE INDEX IF NOT EXISTS idx_hardware_change_contract
                ON rental_hardware_change_logs(contract_id);
            CREATE INDEX IF NOT EXISTS idx_hardware_change_item
                ON rental_hardware_change_logs(item_id);
            CREATE INDEX IF NOT EXISTS idx_hardware_change_date
                ON rental_hardware_change_logs(change_date);
            CREATE INDEX IF NOT EXISTS idx_hardware_change_type
                ON rental_hardware_change_logs(change_type);

            CREATE TABLE IF NOT EXISTS rental_price_change_logs (
                price_change_id TEXT PRIMARY KEY,
                contract_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                change_date TEXT NOT NULL,
                effective_date TEXT NOT NULL,
                old_unit_monthly_rent REAL NOT NULL,
                new_unit_monthly_rent REAL NOT NULL,
                old_quantity INTEGER NOT NULL,
                new_quantity INTEGER NOT NULL,
                old_monthly_rent REAL NOT NULL,
                new_monthly_rent REAL NOT NULL,
                difference_amount REAL NOT NULL,
                change_reason TEXT,
                approval_status TEXT DEFAULT '无需审批',
                operator_name TEXT,
                created_at TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (contract_id) REFERENCES rental_contracts(contract_id),
                FOREIGN KEY (item_id) REFERENCES rental_line_items(item_id)
            );

            CREATE INDEX IF NOT EXISTS idx_price_change_contract
                ON rental_price_change_logs(contract_id);
            CREATE INDEX IF NOT EXISTS idx_price_change_item
                ON rental_price_change_logs(item_id);
            CREATE INDEX IF NOT EXISTS idx_price_change_date
                ON rental_price_change_logs(change_date);
            CREATE INDEX IF NOT EXISTS idx_price_change_effective_date
                ON rental_price_change_logs(effective_date);

            CREATE TABLE IF NOT EXISTS rental_payment_logs (
                payment_id TEXT PRIMARY KEY,
                contract_id TEXT NOT NULL,
                payment_date TEXT NOT NULL,
                amount REAL NOT NULL,
                payment_method TEXT,
                payment_account TEXT,
                receipt_no TEXT,
                operator_name TEXT,
                created_at TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (contract_id) REFERENCES rental_contracts(contract_id)
            );

            CREATE INDEX IF NOT EXISTS idx_payment_contract
                ON rental_payment_logs(contract_id);
            CREATE INDEX IF NOT EXISTS idx_payment_date
                ON rental_payment_logs(payment_date);
            CREATE INDEX IF NOT EXISTS idx_payment_receipt
                ON rental_payment_logs(receipt_no);

            CREATE TABLE IF NOT EXISTS rental_audit_logs (
                audit_id TEXT PRIMARY KEY,
                contract_id TEXT,
                item_id TEXT,
                action_type TEXT NOT NULL,
                action_title TEXT,
                before_json TEXT,
                after_json TEXT,
                operator_name TEXT,
                created_at TEXT NOT NULL,
                notes TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_audit_contract
                ON rental_audit_logs(contract_id);
            CREATE INDEX IF NOT EXISTS idx_audit_item
                ON rental_audit_logs(item_id);
            CREATE INDEX IF NOT EXISTS idx_audit_action
                ON rental_audit_logs(action_type);
            CREATE INDEX IF NOT EXISTS idx_audit_date
                ON rental_audit_logs(created_at);
            """
        )
        self._migrate_legacy_rental_records_to_v2()
        self.conn.commit()
        logger.info("[Migration 006] 新版租赁管理表结构初始化完成")

    def _migrate_legacy_rental_records_to_v2(self):
        """将旧 rental_records JSON 数据迁移为新版合同和默认租赁项目。"""
        rows = self.conn.execute("SELECT id, data FROM rental_records").fetchall()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        migrated = 0
        for row in rows:
            old_id = row["id"]
            exists = self.conn.execute(
                "SELECT 1 FROM rental_contracts WHERE old_record_id = ? OR contract_id = ?",
                (old_id, old_id),
            ).fetchone()
            if exists:
                continue
            try:
                rec = json.loads(row["data"] or "{}")
            except Exception:
                rec = {}
            renter = rec.get("renter", {}) or {}
            lease = rec.get("lease_info", {}) or {}
            contract_id = old_id
            start_date = lease.get("start_date") or rec.get("start_date") or datetime.now().strftime("%Y-%m-%d")
            end_date = lease.get("end_date") or rec.get("end_date") or start_date
            total_rent = self._safe_float(lease.get("total_rent", 0))
            paid_amount = self._safe_float(rec.get("paid_amount", 0))
            deposit = self._safe_float(lease.get("deposit", 0))
            status = rec.get("status") or "在租"
            unpaid_amount = max(0, total_rent - paid_amount)
            self.conn.execute(
                """INSERT OR IGNORE INTO rental_contracts(
                    contract_id, old_record_id, customer_name, customer_phone,
                    customer_id_card, customer_address, contract_start_date,
                    contract_end_date, status, deposit, total_rent, paid_amount,
                    unpaid_amount, created_by, created_at, updated_at, notes
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    contract_id,
                    old_id,
                    renter.get("name", "未填写"),
                    renter.get("phone", ""),
                    renter.get("id_card", ""),
                    renter.get("address", ""),
                    start_date,
                    end_date,
                    status,
                    deposit,
                    total_rent,
                    paid_amount,
                    unpaid_amount,
                    "migration",
                    now,
                    now,
                    "由旧 rental_records 自动迁移",
                ),
            )
            quantity = max(1, int(self._safe_float(rec.get("quantity", 1)) or 1))
            monthly_rent = self._safe_float(lease.get("monthly_rent", 0))
            unit_monthly_rent = monthly_rent / quantity if quantity else monthly_rent
            hardware = rec.get("hardware", {}) or {}
            hardware_json = json.dumps(hardware, ensure_ascii=False)
            item_id = f"{contract_id}-ITEM-001"
            self.conn.execute(
                """INSERT OR IGNORE INTO rental_line_items(
                    item_id, contract_id, item_name, item_type, item_order,
                    quantity, unit_monthly_rent, monthly_rent, total_rent,
                    start_date, end_date, hardware_snapshot_json,
                    current_hardware_json, status, created_by, created_at,
                    updated_at, notes
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    item_id,
                    contract_id,
                    "默认租赁项目",
                    "电脑",
                    1,
                    quantity,
                    unit_monthly_rent,
                    monthly_rent,
                    total_rent,
                    start_date,
                    end_date,
                    hardware_json,
                    hardware_json,
                    status,
                    "migration",
                    now,
                    now,
                    "由旧 rental_records 自动生成的默认项目",
                ),
            )
            if paid_amount > 0:
                self.conn.execute(
                    """INSERT OR IGNORE INTO rental_payment_logs(
                        payment_id, contract_id, payment_date, amount,
                        payment_method, payment_account, receipt_no,
                        operator_name, created_at, notes
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        f"{contract_id}-PAY-001",
                        contract_id,
                        now[:10],
                        paid_amount,
                        "旧数据迁移",
                        "",
                        "",
                        "migration",
                        now,
                        "旧记录 paid_amount 自动迁移",
                    ),
                )
            self._insert_rental_audit_log(
                contract_id=contract_id,
                item_id=item_id,
                action_type="import_data",
                action_title="旧租赁记录迁移",
                before_data=rec,
                after_data={"contract_id": contract_id, "item_id": item_id},
                operator_name="migration",
                notes="Migration 006 自动迁移",
                commit=False,
            )
            migrated += 1
        logger.info(f"[Migration 006] 旧租赁记录迁移完成：{migrated} 条")

    def _extract_brand_from_full_name(self, full_name: str) -> str:
        """从完整名称中提取品牌"""
        # 常见品牌关键词
        brand_keywords = [
            "Intel", "AMD", "NVIDIA", "华硕", "技嘉", "微星", "华擎", 
            "铭瑄", "七彩虹", "映泰", "金士顿", "芝奇", "海盗船", "威刚",
            "金百达", "宇瞻", "光威", "玖合", "三星", "西数", "铠侠",
            "致态", "希捷", "长江存储", "航嘉", "长城", "酷冷至尊",
            "振华", "安钛克", "海韵", "先马", "联力", "恩杰", "乔思伯",
            "追风者", "九州风神", "利民", "猫头鹰", "瓦尔基里", "雅浚",
            "戴尔", "AOC", "飞利浦", "LG", "小米", "HKC", "商途"
        ]
        
        for keyword in brand_keywords:
            if full_name.startswith(keyword):
                return keyword
        
        # 尝试按空格分割取第一部分
        parts = full_name.split()
        if len(parts) > 0:
            return parts[0]
        
        return full_name
    # ── 硬件品牌库 ───────────────────────────────────────────────────

    def _init_brand_defaults(self, force=False):
        """首次初始化品牌库默认数据。"""
        row = self.conn.execute("SELECT COUNT(*) AS total FROM hardware_brands").fetchone()
        if row and row["total"] > 0 and not force:
            return
        from modules.hardware_brands import BRAND_MAP
        for category, items in BRAND_MAP.items():
            for idx, name in enumerate(items):
                try:
                    self.conn.execute(
                        "INSERT INTO hardware_brands(category, name, sort_order) VALUES(?, ?, ?)",
                        (category, name, idx),
                    )
                except sqlite3.IntegrityError:
                    pass
        self.conn.commit()

    def get_brands(self, category: str) -> List[str]:
        """获取指定分类的品牌列表。"""
        rows = self.conn.execute(
            "SELECT name FROM hardware_brands WHERE category = ? ORDER BY sort_order, name",
            (category,),
        ).fetchall()
        return [r["name"] for r in rows]

    def get_all_brands(self) -> Dict[str, List[str]]:
        """获取所有分类品牌。"""
        rows = self.conn.execute(
            "SELECT category, name FROM hardware_brands ORDER BY category, sort_order, name"
        ).fetchall()
        result: Dict[str, List[str]] = {}
        for r in rows:
            result.setdefault(r["category"], []).append(r["name"])
        return result

    def add_brand(self, category: str, name: str) -> bool:
        """添加品牌条目。"""
        try:
            row = self.conn.execute(
                "SELECT MAX(sort_order) AS mx FROM hardware_brands WHERE category = ?",
                (category,),
            ).fetchone()
            next_order = (row["mx"] or 0) + 1 if row else 0
            self.conn.execute(
                "INSERT INTO hardware_brands(category, name, sort_order) VALUES(?, ?, ?)",
                (category, name, next_order),
            )
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def delete_brand(self, category: str, name: str) -> bool:
        """删除品牌条目。"""
        self.conn.execute(
            "DELETE FROM hardware_brands WHERE category = ? AND name = ?",
            (category, name),
        )
        self.conn.commit()
        return self.conn.total_changes > 0

    def import_brands(self, category: str, names: List[str]) -> int:
        """批量导入品牌，返回新增数量。"""
        existing = set(self.get_brands(category))
        added = 0
        row = self.conn.execute(
            "SELECT MAX(sort_order) AS mx FROM hardware_brands WHERE category = ?",
            (category,),
        ).fetchone()
        next_order = (row["mx"] or 0) + 1 if row else 0
        for name in names:
            name = name.strip()
            if not name or name in existing:
                continue
            try:
                self.conn.execute(
                    "INSERT INTO hardware_brands(category, name, sort_order) VALUES(?, ?, ?)",
                    (category, name, next_order),
                )
                next_order += 1
                existing.add(name)
                added += 1
            except sqlite3.IntegrityError:
                pass
        self.conn.commit()
        return added

    # ── 硬件型号库 ───────────────────────────────────────────────────

    def _init_hardware_model_defaults(self):
        """初始化硬件型号默认数据。"""
        row = self.conn.execute("SELECT COUNT(*) AS total FROM hardware_models").fetchone()
        if row and row["total"] > 0:
            return
        # 从硬件品牌模块导入默认数据
        from modules.hardware_models import HARDWARE_MODELS
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for model in HARDWARE_MODELS:
            try:
                self.conn.execute(
                    """INSERT INTO hardware_models(
                        category, brand, model_name, specs, reference_cost,
                        reference_rent, release_year, is_active, updated_at
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        model["category"],
                        model["brand"],
                        model["model_name"],
                        json.dumps(model.get("specs", {}), ensure_ascii=False),
                        model.get("reference_cost"),
                        model.get("reference_rent"),
                        model.get("release_year"),
                        1,
                        now,
                    ),
                )
            except sqlite3.IntegrityError:
                pass
        self.conn.commit()

    def search_models(self, query: str, category: str = None, limit: int = 20) -> List[Dict]:
        """搜索硬件型号，支持模糊匹配。"""
        if category:
            rows = self.conn.execute(
                """SELECT id, category, brand, model_name, specs, reference_cost,
                          reference_rent, release_year
                   FROM hardware_models
                   WHERE is_active = 1
                     AND category = ?
                     AND (brand LIKE ? OR model_name LIKE ?)
                   ORDER BY release_year DESC, brand
                   LIMIT ?""",
                (category, f"%{query}%", f"%{query}%", limit),
            ).fetchall()
        else:
            rows = self.conn.execute(
                """SELECT id, category, brand, model_name, specs, reference_cost,
                          reference_rent, release_year
                   FROM hardware_models
                   WHERE is_active = 1
                     AND (brand LIKE ? OR model_name LIKE ?)
                   ORDER BY release_year DESC, brand
                   LIMIT ?""",
                (f"%{query}%", f"%{query}%", limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_models_by_category(self, category: str) -> List[Dict]:
        """获取指定分类的所有型号。"""
        rows = self.conn.execute(
            """SELECT id, category, brand, model_name, specs, reference_cost,
                      reference_rent, release_year
               FROM hardware_models
               WHERE category = ? AND is_active = 1
               ORDER BY brand, model_name""",
            (category,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_model_by_id(self, model_id: int) -> Optional[Dict]:
        """根据 ID 获取硬件型号。"""
        row = self.conn.execute(
            """SELECT id, category, brand, model_name, specs, reference_cost,
                      reference_rent, release_year
               FROM hardware_models
               WHERE id = ?""",
            (model_id,),
        ).fetchone()
        if row:
            result = dict(row)
            if result.get("specs"):
                try:
                    result["specs"] = json.loads(result["specs"])
                except json.JSONDecodeError:
                    pass
            return result
        return None

    # ── 兼容数据结构 ─────────────────────────────────────────────────

    def _load_data(self) -> Dict:
        """从 SQLite 加载为旧版兼容结构。"""
        settings = {}
        rows = self.conn.execute("SELECT key, value FROM settings").fetchall()
        for row in rows:
            settings[row["key"]] = self._decode_setting(row["value"])

        if not settings:
            settings = self._get_default_data()["settings"]
            for key, value in settings.items():
                self._set_setting(key, value)
            self.conn.commit()

        records = []
        rows = self.conn.execute(
            "SELECT data FROM rental_records ORDER BY register_date DESC, id DESC"
        ).fetchall()
        for row in rows:
            try:
                records.append(json.loads(row["data"]))
            except (TypeError, json.JSONDecodeError):
                pass
        return {"rental_records": records, "settings": settings}

    def _load_json_data(self) -> Optional[Dict]:
        """读取旧 JSON 数据。"""
        if not self.data_file.exists():
            return None
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None

    def _import_json_if_needed(self):
        """SQLite 为空时，从旧 JSON 自动导入。"""
        row = self.conn.execute("SELECT COUNT(*) AS total FROM rental_records").fetchone()
        if row and row["total"] > 0:
            return

        data = self._load_json_data() or self._get_default_data()
        for key, value in data.get("settings", {}).items():
            self._set_setting(key, value)
        for record in data.get("rental_records", []):
            self._upsert_record(record, action="import", note="Imported from rental_data.json")
        self.conn.commit()

    def _get_default_data(self) -> Dict:
        """获取默认数据结构。"""
        salt_b64, hash_b64 = self._build_password_hash("admin123")
        return {
            "rental_records": [],
            "settings": {
                "default_admin": "admin",
                "password_salt": salt_b64,
                "password_hash": hash_b64,
                "failed_login_count": 0,
                "locked_until": None,
                "last_backup": None,
            },
        }

    # ── 密码/设置 ─────────────────────────────────────────────────────

    def _build_password_hash(self, password: str):
        """生成密码盐值和哈希（Base64）。"""
        salt = os.urandom(16)
        pwd_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            120000,
        )
        return (
            base64.b64encode(salt).decode("utf-8"),
            base64.b64encode(pwd_hash).decode("utf-8"),
        )

    def verify_password(self, password: str) -> bool:
        """验证密码哈希。"""
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
                120000,
            )
            return actual_hash == expected_hash
        except Exception:
            return False

    def _encode_setting(self, value: Any) -> str:
        return json.dumps(value, ensure_ascii=False)

    def _decode_setting(self, value: str) -> Any:
        try:
            return json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return value

    def _set_setting(self, key: str, value: Any):
        self.conn.execute(
            """
            INSERT INTO settings(key, value) VALUES(?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, self._encode_setting(value)),
        )

    # ── 记录写入与历史版本 ───────────────────────────────────────────

    def _record_columns(self, record: Dict) -> Dict:
        renter = record.get("renter", {})
        lease = record.get("lease_info", {})
        return {
            "status": record.get("status", ""),
            "renter_name": renter.get("name", ""),
            "renter_phone": renter.get("phone", ""),
            "start_date": lease.get("start_date", ""),
            "end_date": lease.get("end_date", ""),
            "register_date": record.get("register_date", ""),
        }

    def _snapshot_version(self, record_id: str, action: str, data: Optional[Dict], note: str = ""):
        self.conn.execute(
            """
            INSERT INTO record_versions(record_id, action, data, created_at, note)
            VALUES(?, ?, ?, ?, ?)
            """,
            (
                record_id,
                action,
                json.dumps(data, ensure_ascii=False) if data is not None else None,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                note,
            ),
        )

    def _upsert_record(self, record: Dict, action: str = "update", note: str = ""):
        if not record.get("id"):
            record["id"] = self._generate_id()
        cols = self._record_columns(record)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            """
            INSERT INTO rental_records(
                id, data, status, renter_name, renter_phone,
                start_date, end_date, register_date, updated_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                status = excluded.status,
                renter_name = excluded.renter_name,
                renter_phone = excluded.renter_phone,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                register_date = excluded.register_date,
                updated_at = excluded.updated_at
            """,
            (
                record["id"],
                json.dumps(record, ensure_ascii=False),
                cols["status"],
                cols["renter_name"],
                cols["renter_phone"],
                cols["start_date"],
                cols["end_date"],
                cols["register_date"],
                now,
            ),
        )
        self._snapshot_version(record["id"], action, record, note)

    def save(self):
        """保存当前内存数据到 SQLite，并同步 JSON 快照。"""
        try:
            for key, value in self.data.get("settings", {}).items():
                self._set_setting(key, value)
            for record in self.data.get("rental_records", []):
                self._upsert_record(record, action="save", note="Saved from memory")
            self.conn.commit()
            self._export_json_snapshot()
            return True
        except (IOError, sqlite3.Error) as e:
            logger.error(f"保存数据失败: {e}")
            return False

    def add_record(self, record: Dict) -> bool:
        """添加租赁记录。"""
        if not record.get("id"):
            record["id"] = self._generate_id()
        record["register_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        record.setdefault("status", "在租")
        record.setdefault("paid_amount", 0)
        record.setdefault("renew_history", [])
        record.setdefault("hardware", {})
        self.data["rental_records"].append(record)
        try:
            self._upsert_record(record, action="create", note="Created record")
            self.conn.commit()
            self._export_json_snapshot()
            return True
        except sqlite3.Error as e:
            logger.error(f"添加记录失败: {e}")
            return False

    def update_record(self, record_id: str, updates: Dict) -> bool:
        """更新租赁记录。"""
        for record in self.data["rental_records"]:
            if record.get("id") == record_id:
                self._snapshot_version(record_id, "before_update", record, "Snapshot before update")
                record.update(updates)
                try:
                    self._upsert_record(record, action="update", note="Updated record")
                    self.conn.commit()
                    self._export_json_snapshot()
                    return True
                except sqlite3.Error as e:
                    logger.error(f"更新记录失败: {e}")
                    return False
        return False

    def delete_record(self, record_id: str) -> bool:
        """删除租赁记录。"""
        original_count = len(self.data["rental_records"])
        old_record = self.get_record_by_id(record_id)
        self.data["rental_records"] = [
            r for r in self.data["rental_records"] if r.get("id") != record_id
        ]
        if len(self.data["rental_records"]) < original_count:
            try:
                self._snapshot_version(record_id, "delete", old_record, "Deleted record")
                self.conn.execute("DELETE FROM rental_records WHERE id = ?", (record_id,))
                self.conn.commit()
                self._export_json_snapshot()
                return True
            except sqlite3.Error as e:
                logger.error(f"删除记录失败: {e}")
                return False
        return False

    def get_records(self) -> List[Dict]:
        """获取所有租赁记录。"""
        self.data = self._load_data()
        return self.data["rental_records"]

    def get_record_by_id(self, record_id: str) -> Optional[Dict]:
        """根据 ID 获取单条记录。"""
        row = self.conn.execute(
            "SELECT data FROM rental_records WHERE id = ?",
            (record_id,),
        ).fetchone()
        if not row:
            return None
        try:
            return json.loads(row["data"])
        except (TypeError, json.JSONDecodeError):
            return None

    def check_overdue(self) -> int:
        """检查并更新逾期记录。"""
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
                            self._snapshot_version(
                                record.get("id", ""),
                                "before_overdue_check",
                                record,
                                "Snapshot before overdue status change",
                            )
                            record["status"] = "已逾期"
                            self._upsert_record(record, action="overdue_check", note="Automatic overdue status check")
                            updated += 1
                    except (ValueError, TypeError):
                        pass
        if updated > 0:
            self.conn.commit()
            self._export_json_snapshot()
        return updated
    def calculate_unpaid_amount(self, record: Dict) -> float:
        """计算未付金额：总租金 - 已付金额。"""
        lease = record.get("lease_info", {})
        try:
            total = float(lease.get("total_rent", 0) or 0)
        except (ValueError, TypeError):
            total = 0.0
        try:
            paid = float(record.get("paid_amount", 0) or 0)
        except (ValueError, TypeError):
            paid = 0.0
        return max(total - paid, 0.0)

    def calculate_overdue_days(self, record: Dict) -> int:
        """计算逾期天数。已退租/已丢失/已买断记录不再累计逾期。"""
        from datetime import date

        if record.get("status") in ("已退租", "已丢失", "已买断"):
            return 0
        end_date_str = record.get("lease_info", {}).get("end_date", "")
        if not end_date_str:
            return 0
        try:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return 0
        return max((date.today() - end_date).days, 0)

    def summarize_hardware(self, record: Dict) -> str:
        """生成硬件配置摘要，支持多设备清单格式。"""
        hardware = record.get("hardware", {}) or {}
        if not hardware:
            return "未填写"
        items = hardware.get("items") if isinstance(hardware, dict) else None
        if not items:
            # 兼容旧格式
            parts = []
            pc_type = hardware.get("pc_type", hardware.get("device_type", ""))
            for key, label in [
                ("cpu", "CPU"), ("motherboard", "主板"), ("ram", "内存"),
                ("disk", "硬盘"), ("gpu", "显卡"), ("monitor", "显示器"),
                ("laptop", "笔记本"),
            ]:
                if hardware.get(key):
                    parts.append(f"{label}:{hardware[key]}")
            if pc_type and not parts:
                return f"{pc_type}（无配置详情）"
            return " / ".join(parts) if parts else (pc_type or "未填写")
        
        # 新多设备格式
        lines = []
        for item in items:
            qty = item.get("quantity", 1)
            dev_type = item.get("device_type", "设备")
            rent = item.get("unit_rent", "")
            parts = []
            for key, label in [
                ("model", "型号"), ("cpu", "CPU"), ("ram", "内存"),
                ("disk", "硬盘"), ("gpu", "显卡"),
                ("case", "机箱"), ("psu", "电源"), ("fan", "风扇"),
                ("monitor", "显示器"), ("laptop", "笔记本"),
            ]:
                if item.get(key):
                    parts.append(f"{label}:{item[key]}")
            cost = item.get("unit_cost", "")
            rent_text = f"，月租¥{rent}" if rent else ""
            cost_text = f"，成本¥{cost}" if cost else ""
            detail = " / ".join(parts) if parts else "未填配置"
            lines.append(f"{dev_type}×{qty:g}{cost_text}{rent_text}: {detail}")
        return "；\n".join(lines) if lines else "未填写"

    def refresh_record_business_fields(self, record: Dict) -> Dict:
        """刷新记录中的业务衍生字段。"""
        record["unpaid_amount"] = self.calculate_unpaid_amount(record)
        record["overdue_days"] = self.calculate_overdue_days(record)
        record["hardware_summary"] = self.summarize_hardware(record)
        if record["overdue_days"] > 0 and record.get("status") == "在租":
            record["status"] = "已逾期"
        return record

    def append_payment_history(
        self,
        record: Dict,
        amount: float,
        operator: str = "系统",
        method: str = "",
        note: str = "",
    ) -> None:
        """追加付款流水。amount 为本次新增付款金额。"""
        if amount <= 0:
            return
        record.setdefault("payment_history", []).append({
            "payment_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "amount": float(amount),
            "method": method,
            "operator": operator or "系统",
            "note": note,
        })

    def append_hardware_history(
        self,
        record: Dict,
        old_hardware: Dict,
        new_hardware: Dict,
        operator: str = "系统",
        note: str = "",
    ) -> bool:
        """硬件配置有变化时追加变更历史。"""
        old_hardware = old_hardware or {}
        new_hardware = new_hardware or {}
        if old_hardware == new_hardware:
            return False
        record.setdefault("hardware_history", []).append({
            "change_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "operator": operator or "系统",
            "old_hardware": old_hardware,
            "new_hardware": new_hardware,
            "note": note,
        })
        return True

    def _generate_id(self) -> str:
        """生成唯一 ID。"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")[:17]
        return f"R{timestamp}"

    def get_stats(self) -> Dict:
        """获取统计信息。"""
        records = self.get_records()
        return {
            "total": len(records),
            "active": sum(1 for r in records if r.get("status") == "在租"),
            "expired": sum(1 for r in records if r.get("status") == "已逾期"),
            "returned": sum(1 for r in records if r.get("status") == "已退租"),
            "lost": sum(1 for r in records if r.get("status") == "已丢失"),
            "bought": sum(1 for r in records if r.get("status") == "已买断"),
        }

    def backup_data(self) -> Optional[str]:
        """备份数据为 JSON 文件。"""
        try:
            backup_file = self.data_dir / f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(backup_file, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            self.data["settings"]["last_backup"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.save()
            return str(backup_file)
        except IOError as e:
            logger.error(f"备份数据失败: {e}")
            return None

    def get_record_versions(self, record_id: str) -> List[Dict]:
        """获取记录历史版本，最新版本在前。"""
        rows = self.conn.execute(
            """
            SELECT version_id, record_id, action, data, created_at, note
            FROM record_versions
            WHERE record_id = ?
            ORDER BY version_id DESC
            """,
            (record_id,),
        ).fetchall()
        versions = []
        for row in rows:
            item = dict(row)
            item["data"] = json.loads(item["data"]) if item.get("data") else None
            versions.append(item)
        return versions

    def rollback_record(self, record_id: str, version_id: int) -> bool:
        """将记录回溯到指定历史版本。"""
        row = self.conn.execute(
            "SELECT data FROM record_versions WHERE record_id = ? AND version_id = ?",
            (record_id, version_id),
        ).fetchone()
        if not row or not row["data"]:
            return False
        try:
            record = json.loads(row["data"])
            self._snapshot_version(
                record_id,
                "before_rollback",
                self.get_record_by_id(record_id),
                f"Before rollback to version {version_id}",
            )
            self._upsert_record(record, action="rollback", note=f"Rolled back to version {version_id}")
            replaced = False
            for idx, current in enumerate(self.data["rental_records"]):
                if current.get("id") == record_id:
                    self.data["rental_records"][idx] = record
                    replaced = True
                    break
            if not replaced:
                self.data["rental_records"].append(record)
            self.conn.commit()
            self._export_json_snapshot()
            return True
        except (json.JSONDecodeError, sqlite3.Error) as e:
            logger.error(f"版本回溯失败: {e}")
            return False

    def _export_json_snapshot(self):
        """同步导出 JSON 快照，兼容旧工具和人工查看。"""
        self.data = self._load_data()
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    # ── 新版租赁合同接口 ───────────────────────────────────────────

    def _safe_float(self, value):
        """安全转换为浮点数。"""
        if value is None or value == "":
            return 0.0
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0

    def _insert_rental_audit_log(self, contract_id: str, item_id: str = None,
                                  action_type: str = "", action_title: str = "",
                                  before_data: dict = None, after_data: dict = None,
                                  operator_name: str = "系统", notes: str = "",
                                  commit: bool = True):
        """写入租赁审计日志。"""
        audit_id = self._generate_id() + "-AUDIT"
        self.conn.execute(
            """INSERT INTO rental_audit_logs(
                audit_id, contract_id, item_id, action_type, action_title,
                before_json, after_json, operator_name, created_at, notes
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                audit_id,
                contract_id,
                item_id,
                action_type,
                action_title,
                json.dumps(before_data, ensure_ascii=False) if before_data else None,
                json.dumps(after_data, ensure_ascii=False) if after_data else None,
                operator_name,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                notes,
            ),
        )
        if commit:
            self.conn.commit()

    def get_contracts(self, status: str = None, customer_name: str = None) -> List[Dict]:
        """获取租赁合同列表，支持按状态和客户名称筛选。"""
        query = "SELECT * FROM rental_contracts WHERE 1=1"
        params = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if customer_name:
            query += " AND customer_name LIKE ?"
            params.append(f"%{customer_name}%")
        query += " ORDER BY created_at DESC"
        rows = self.conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def get_contract(self, contract_id: str) -> Optional[Dict]:
        """获取单条合同详情。"""
        row = self.conn.execute(
            "SELECT * FROM rental_contracts WHERE contract_id = ?",
            (contract_id,),
        ).fetchone()
        if not row:
            return None
        contract = dict(row)
        # 加载关联的项目
        items = self.conn.execute(
            "SELECT * FROM rental_line_items WHERE contract_id = ? ORDER BY item_order",
            (contract_id,),
        ).fetchall()
        contract["line_items"] = [dict(i) for i in items]
        return contract

    def create_contract(self, customer_name: str, customer_phone: str,
                       start_date: str, end_date: str,
                       customer_id_card: str = "", customer_address: str = "",
                       deposit: float = 0, notes: str = "",
                       operator_name: str = "系统") -> str:
        """创建新租赁合同，返回 contract_id。"""
        contract_id = self._generate_id()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            """INSERT INTO rental_contracts(
                contract_id, customer_name, customer_phone, customer_id_card,
                customer_address, contract_start_date, contract_end_date,
                status, deposit, total_rent, paid_amount, unpaid_amount,
                created_by, created_at, updated_at, notes
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                contract_id, customer_name, customer_phone, customer_id_card,
                customer_address, start_date, end_date,
                "在租", deposit, 0, 0, 0,
                operator_name, now, now, notes,
            ),
        )
        self._insert_rental_audit_log(
            contract_id=contract_id,
            action_type="create_contract",
            action_title="创建租赁合同",
            after_data={"contract_id": contract_id, "customer_name": customer_name},
            operator_name=operator_name,
            commit=False,
        )
        self.conn.commit()
        return contract_id

    def update_contract_summary(self, contract_id: str) -> bool:
        """根据 line_items 重新计算合同总租金和已付金额，更新合同主表。"""
        items = self.conn.execute(
            "SELECT total_rent FROM rental_line_items WHERE contract_id = ?",
            (contract_id,),
        ).fetchall()
        total_rent = sum(self._safe_float(i["total_rent"]) for i in items)
        payments = self.conn.execute(
            "SELECT SUM(amount) AS total FROM rental_payment_logs WHERE contract_id = ?",
            (contract_id,),
        ).fetchone()
        paid_amount = self._safe_float(payments["total"] if payments else 0)
        unpaid_amount = max(0, total_rent - paid_amount)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            """UPDATE rental_contracts
               SET total_rent = ?, paid_amount = ?, unpaid_amount = ?, updated_at = ?
               WHERE contract_id = ?""",
            (total_rent, paid_amount, unpaid_amount, now, contract_id),
        )
        self.conn.commit()
        return True

    def add_line_item(self, contract_id: str, item_name: str, item_type: str,
                      quantity: int, unit_monthly_rent: float,
                      start_date: str, end_date: str,
                      hardware_json: str = None,
                      notes: str = "", operator_name: str = "系统") -> str:
        """添加租赁项目。"""
        item_id = f"{contract_id}-ITEM-{self._generate_id()[-4:]}"
        monthly_rent = quantity * unit_monthly_rent
        # 计算月数
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
            months = (end - start).days / 30.0
        except ValueError:
            months = 1
        total_rent = monthly_rent * months
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            """INSERT INTO rental_line_items(
                item_id, contract_id, item_name, item_type, item_order,
                quantity, unit_monthly_rent, monthly_rent, total_rent,
                start_date, end_date, hardware_snapshot_json,
                current_hardware_json, status, created_by, created_at,
                updated_at, notes
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item_id, contract_id, item_name, item_type, 1,
                quantity, unit_monthly_rent, monthly_rent, total_rent,
                start_date, end_date, hardware_json or "{}",
                hardware_json or "{}", "在租", operator_name, now,
                now, notes,
            ),
        )
        self._insert_rental_audit_log(
            contract_id=contract_id,
            item_id=item_id,
            action_type="add_line_item",
            action_title=f"添加租赁项目: {item_name}",
            after_data={"item_id": item_id, "item_name": item_name},
            operator_name=operator_name,
            commit=False,
        )
        self.conn.commit()
        self.update_contract_summary(contract_id)
        return item_id

    def add_payment(self, contract_id: str, amount: float, payment_date: str,
                   payment_method: str = "", receipt_no: str = "",
                   notes: str = "", operator_name: str = "系统") -> str:
        """添加收款记录。"""
        payment_id = f"{contract_id}-PAY-{self._generate_id()[-4:]}"
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            """INSERT INTO rental_payment_logs(
                payment_id, contract_id, payment_date, amount, payment_method,
                receipt_no, operator_name, created_at, notes
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (payment_id, contract_id, payment_date, amount, payment_method,
             receipt_no, operator_name, now, notes),
        )
        self._insert_rental_audit_log(
            contract_id=contract_id,
            action_type="payment_add",
            action_title=f"添加收款: ¥{amount:.2f}",
            after_data={"payment_id": payment_id, "amount": amount},
            operator_name=operator_name,
            commit=False,
        )
        self.conn.commit()
        self.update_contract_summary(contract_id)
        return payment_id

    def close(self):
        """关闭数据库连接。"""
        self.conn.close()
