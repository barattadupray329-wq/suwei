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

    DB_VERSION = 9

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
        self._backfill_payment_sources()
        self._init_brand_defaults()

    # ── Migration ──────────────────────────────────────────────────────

    def _migrate(self):
        """自动执行数据库迁移。"""
        current = self._get_schema_version()
        if current < 1:
            self._migration_001_initial_schema()
            self._set_schema_version(1)
        if current < 2:
            self._migration_002_hardware_models()
            self._set_schema_version(2)
        if current < 3:
            self._migration_003_sync_models()
            self._set_schema_version(3)
        if current < 6:
            self._migration_006_legacy_reserved()
            self._set_schema_version(6)
        if current < 7:
            self._migration_007_remove_rental_v2_schema()
            self._set_schema_version(7)
        if current < 8:
            self._migration_008_add_model_inventory()
            self._set_schema_version(8)
        if current < 9:
            self._migration_009_add_rental_config_history()
            self._set_schema_version(9)
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

    def _migration_002_hardware_models(self):
        """Migration 002：硬件型号库表。"""
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

    def _migration_003_sync_models(self):
        """Migration 003：同步硬件型号库，补充常用二手/老平台型号"""
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

    def _migration_006_legacy_reserved(self):
        """Migration 006：历史版本占位（保留版本序号，不再创建 v2 合同表）。"""
        logger.info("[Migration 006] legacy reserved (no-op)")

    def _migration_007_remove_rental_v2_schema(self):
        """Migration 007：清理并移除 v2 合同相关表结构。"""
        self.conn.executescript(
            """
            DROP TABLE IF EXISTS rental_audit_logs;
            DROP TABLE IF EXISTS rental_payment_logs;
            DROP TABLE IF EXISTS rental_price_change_logs;
            DROP TABLE IF EXISTS rental_hardware_change_logs;
            DROP TABLE IF EXISTS rental_line_items;
            DROP TABLE IF EXISTS rental_contracts;
            """
        )
        self.conn.commit()
        logger.info("[Migration 007] 已移除 v2 合同相关表结构")

    def _migration_008_add_model_inventory(self):
        """Migration 008：给硬件型号增加库存字段。"""
        cols = {row["name"] for row in self.conn.execute("PRAGMA table_info(hardware_models)").fetchall()}
        if "stock_total" not in cols:
            self.conn.execute("ALTER TABLE hardware_models ADD COLUMN stock_total INTEGER DEFAULT 0")
        if "stock_rented" not in cols:
            self.conn.execute("ALTER TABLE hardware_models ADD COLUMN stock_rented INTEGER DEFAULT 0")
        self.conn.commit()

    def _migration_009_add_rental_config_history(self):
        """Migration 009：增加租赁原始/当前配置快照与变更历史表。"""
        cols = {row["name"] for row in self.conn.execute("PRAGMA table_info(rental_records)").fetchall()}
        for col in ["original_config_snapshot", "current_config_snapshot", "config_updated_at"]:
            if col not in cols:
                self.conn.execute(f"ALTER TABLE rental_records ADD COLUMN {col} TEXT")
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rental_config_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rental_id TEXT NOT NULL,
                change_time TEXT NOT NULL,
                change_type TEXT NOT NULL,
                old_part_name TEXT,
                old_part_model TEXT,
                old_part_sn TEXT,
                new_part_name TEXT,
                new_part_model TEXT,
                new_part_sn TEXT,
                quantity REAL DEFAULT 1,
                operator TEXT,
                reason TEXT,
                fee REAL DEFAULT 0,
                remark TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_rental_config_changes_rental_id ON rental_config_changes(rental_id)")
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS inventory_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_id INTEGER,
                trans_type TEXT NOT NULL,
                quantity REAL NOT NULL,
                related_rental_id TEXT,
                operator TEXT,
                note TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_model_id ON inventory_transactions(model_id)")
        self.conn.commit()

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
    # ── 硬件型号库 ───────────────────────────────────────────────────

    def _init_brand_defaults(self):
        """初始化品牌/型号相关默认数据。"""
        self._init_hardware_model_defaults()

    def _init_hardware_model_defaults(self):
        """初始化硬件型号默认数据。"""
        row = self.conn.execute("SELECT COUNT(*) AS total FROM hardware_models").fetchone()
        if row and row["total"] > 0:
            return
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
        """搜索硬件型号，支持品牌、型号名和规格模糊匹配。"""
        q = f"%{(query or '').strip()}%"
        if category:
            rows = self.conn.execute(
                """SELECT id, category, brand, model_name, specs, reference_cost,
                          reference_rent, release_year
                   FROM hardware_models
                   WHERE is_active = 1
                     AND category = ?
                     AND (
                         brand LIKE ?
                         OR model_name LIKE ?
                         OR COALESCE(specs, '') LIKE ?
                     )
                   ORDER BY release_year DESC, brand, model_name
                   LIMIT ?""",
                (category, q, q, q, limit),
            ).fetchall()
        else:
            rows = self.conn.execute(
                """SELECT id, category, brand, model_name, specs, reference_cost,
                          reference_rent, release_year
                   FROM hardware_models
                   WHERE is_active = 1
                     AND (
                         brand LIKE ?
                         OR model_name LIKE ?
                         OR COALESCE(specs, '') LIKE ?
                     )
                   ORDER BY release_year DESC, brand, model_name
                   LIMIT ?""",
                (q, q, q, limit),
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

    def get_models_by_brand(self, category: str, brand: str) -> List[Dict]:
        """获取指定分类下某品牌的所有型号。"""
        rows = self.conn.execute(
            """SELECT id, category, brand, model_name, specs, reference_cost,
                      reference_rent, release_year
               FROM hardware_models
               WHERE category = ? AND brand = ? AND is_active = 1
               ORDER BY model_name""",
            (category, brand),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_model_by_id(self, model_id: int) -> Optional[Dict]:
        """根据 ID 获取硬件型号。"""
        row = self.conn.execute(
            """SELECT id, category, brand, model_name, specs, reference_cost,
                      reference_rent, release_year, stock_total, stock_rented
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

    def add_model(self, category: str, brand: str, model_name: str, specs=None,
                  reference_cost=None, reference_rent=None, release_year=None) -> bool:
        """新增硬件型号。"""
        model_name = (model_name or "").strip()
        brand = (brand or "").strip()
        if not category or not brand or not model_name:
            return False
        try:
            self.conn.execute(
                """INSERT INTO hardware_models(
                    category, brand, model_name, specs, reference_cost,
                    reference_rent, release_year, is_active, updated_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?, 1, ?)""",
                (
                    category,
                    brand,
                    model_name,
                    json.dumps(specs or {}, ensure_ascii=False),
                    reference_cost,
                    reference_rent,
                    release_year,
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def update_model(self, model_id: int, *, brand=None, model_name=None, specs=None,
                     reference_cost=None, reference_rent=None, release_year=None,
                     stock_total=None, stock_rented=None, is_active=None) -> bool:
        """更新硬件型号。"""
        fields = []
        values = []
        if brand is not None:
            fields.append("brand = ?")
            values.append(brand)
        if model_name is not None:
            fields.append("model_name = ?")
            values.append(model_name)
        if specs is not None:
            fields.append("specs = ?")
            values.append(json.dumps(specs, ensure_ascii=False))
        if reference_cost is not None:
            fields.append("reference_cost = ?")
            values.append(reference_cost)
        if reference_rent is not None:
            fields.append("reference_rent = ?")
            values.append(reference_rent)
        if release_year is not None:
            fields.append("release_year = ?")
            values.append(release_year)
        if stock_total is not None:
            fields.append("stock_total = ?")
            values.append(stock_total)
        if stock_rented is not None:
            fields.append("stock_rented = ?")
            values.append(stock_rented)
        if is_active is not None:
            fields.append("is_active = ?")
            values.append(1 if is_active else 0)
        if not fields:
            return False
        fields.append("updated_at = ?")
        values.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        values.append(model_id)
        self.conn.execute(f"UPDATE hardware_models SET {', '.join(fields)} WHERE id = ?", values)
        self.conn.commit()
        return True

    def delete_model(self, model_id: int) -> bool:
        """删除硬件型号（软删）。"""
        self.conn.execute(
            "UPDATE hardware_models SET is_active = 0, updated_at = ? WHERE id = ?",
            (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), model_id),
        )
        self.conn.commit()
        return self.conn.total_changes > 0

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

    def _derive_payment_source(self, record: Dict, item: Dict) -> str:
        lease = record.get("lease_info", {}) or {}
        hardware = record.get("hardware", {}) or {}
        renter = record.get("renter", {}) or {}

        source_type = str(item.get("source_type", "")).strip()
        source_name = str(item.get("source_name", "")).strip()
        source = str(item.get("source", "")).strip()
        method = str(item.get("method", "")).strip()
        note = str(item.get("note", "")).strip()

        if source:
            return source

        parts = []
        if source_type:
            parts.append(source_type)
        if source_name:
            parts.append(source_name)
        if not parts and method:
            parts.append(method)

        if not parts:
            if note:
                lowered = note.lower()
                if any(k in note for k in ("押金", "保证金")):
                    parts.append("押金")
                elif any(k in note for k in ("续租", "续约")):
                    parts.append("续租费")
                elif any(k in note for k in ("买断",)):
                    parts.append("买断费")
                elif any(k in note for k in ("租金", "房租", "月租")):
                    parts.append("租金收入")
                elif "补录" in note:
                    parts.append("历史补录")
                elif lowered:
                    parts.append(note)

        if not parts:
            lease_type = str(lease.get("lease_type", "")).strip()
            if lease_type:
                lease_map = {
                    "租金": "租金收入",
                    "押金": "押金",
                    "续租": "续租费",
                    "买断": "买断费",
                }
                parts.append(lease_map.get(lease_type, lease_type))

        if hardware.get("category") or hardware.get("brand") or hardware.get("model_name"):
            hw = " / ".join([str(hardware.get(k)) for k in ("category", "brand", "model_name") if hardware.get(k)])
            if hw:
                parts.append(hw)
        if renter.get("name"):
            parts.append(f"租户:{renter.get('name')}")

        return " / ".join([p for p in parts if p]) or "未记录"

    def _backfill_payment_sources(self) -> None:
        changed = False
        for record in self.data.get("rental_records", []):
            history = record.setdefault("payment_history", []) or []
            if not history:
                try:
                    paid_amount = float(record.get("paid_amount", 0) or 0)
                except (TypeError, ValueError):
                    paid_amount = 0.0
                if paid_amount > 0:
                    history.append({
                        "payment_date": record.get("updated_at") or record.get("register_date") or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "amount": paid_amount,
                        "method": record.get("payment_method", ""),
                        "operator": record.get("operator", "系统"),
                        "note": "历史数据补录",
                        "source_type": "历史补录",
                        "source_name": self._derive_payment_source(record, {
                            "method": record.get("payment_method", ""),
                            "note": "历史数据补录",
                        }),
                        "source": self._derive_payment_source(record, {
                            "method": record.get("payment_method", ""),
                            "note": "历史数据补录",
                        }),
                    })
                    changed = True
            for item in history:
                if not item.get("source_type"):
                    note = str(item.get("note", "")).strip()
                    if "历史" in note or "补录" in note:
                        item["source_type"] = "历史补录"
                    elif any(k in note for k in ("押金", "保证金")):
                        item["source_type"] = "押金"
                    elif any(k in note for k in ("续租", "续约")):
                        item["source_type"] = "续租费"
                    elif any(k in note for k in ("买断",)):
                        item["source_type"] = "买断费"
                    else:
                        item["source_type"] = "租金收入"
                    changed = True
                if not item.get("source_name"):
                    item["source_name"] = self._derive_payment_source(record, item)
                    changed = True
                if not item.get("source"):
                    item["source"] = self._derive_payment_source(record, item)
                    changed = True
            for item in history:
                if not item.get("source"):
                    item["source"] = self._derive_payment_source(record, item)
                    changed = True
        if changed:
            try:
                self.save()
            except Exception:
                pass

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
        self._ensure_config_snapshots(record)
        cols = self._record_columns(record)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conn.execute(
            """
            INSERT INTO rental_records(
                id, data, status, renter_name, renter_phone,
                start_date, end_date, register_date, updated_at,
                original_config_snapshot, current_config_snapshot, config_updated_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                status = excluded.status,
                renter_name = excluded.renter_name,
                renter_phone = excluded.renter_phone,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                register_date = excluded.register_date,
                updated_at = excluded.updated_at,
                original_config_snapshot = excluded.original_config_snapshot,
                current_config_snapshot = excluded.current_config_snapshot,
                config_updated_at = excluded.config_updated_at
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
                json.dumps(record.get("original_config_snapshot", {}), ensure_ascii=False),
                json.dumps(record.get("current_config_snapshot", {}), ensure_ascii=False),
                record.get("config_updated_at", now),
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

    def create_rental_record(self, record: Dict) -> Dict:
        """规范化租赁记录结构。"""
        rec = dict(record or {})
        rec.setdefault("id", self._generate_id())
        rec.setdefault("register_date", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        rec.setdefault("status", "在租")
        rec.setdefault("paid_amount", 0)
        rec.setdefault("renew_history", [])
        rec.setdefault("payment_history", [])
        rec.setdefault("hardware_history", [])
        rec.setdefault("hardware", {})
        rec.setdefault("lease_info", {})
        rec.setdefault("renter", {})
        self._ensure_config_snapshots(rec)
        return self.refresh_record_business_fields(rec)

    def add_record(self, record: Dict) -> bool:
        """添加租赁记录。"""
        record = self.create_rental_record(record)
        self.data["rental_records"].append(record)
        try:
            self._ensure_config_snapshots(record)
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
        source = self._derive_payment_source(record, {
            "method": method,
            "note": note,
        })
        record.setdefault("payment_history", []).append({
            "payment_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "amount": float(amount),
            "method": method,
            "operator": operator or "系统",
            "note": note,
            "source": source,
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
        self._sync_config_snapshot_from_hardware(record, old_hardware, new_hardware, operator=operator, note=note)
        return True

    def _normalize_hardware_snapshot(self, hardware: Any) -> Dict:
        if not hardware:
            return {}
        if isinstance(hardware, dict):
            return json.loads(json.dumps(hardware, ensure_ascii=False))
        return {"value": hardware}

    def _ensure_config_snapshots(self, record: Dict) -> None:
        hardware = self._normalize_hardware_snapshot(record.get("hardware", {}))
        record.setdefault("original_config_snapshot", self._normalize_hardware_snapshot(record.get("original_config_snapshot") or hardware))
        record.setdefault("current_config_snapshot", self._normalize_hardware_snapshot(record.get("current_config_snapshot") or hardware))
        record.setdefault("config_updated_at", record.get("register_date") or datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    def _sync_config_snapshot_from_hardware(self, record: Dict, old_hardware: Dict, new_hardware: Dict, operator: str = "系统", note: str = "") -> None:
        record["current_config_snapshot"] = self._normalize_hardware_snapshot(new_hardware)
        if not record.get("original_config_snapshot"):
            record["original_config_snapshot"] = self._normalize_hardware_snapshot(old_hardware)
        record["config_updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.append_config_change(
            record.get("id", ""),
            change_type="硬件变更",
            old_part_name="硬件配置",
            new_part_name="硬件配置",
            operator=operator,
            reason=note,
            remark=note,
        )

    def append_config_change(self, rental_id: str, change_type: str, old_part_name: str = "", new_part_name: str = "", old_part_model: str = "", new_part_model: str = "", old_part_sn: str = "", new_part_sn: str = "", quantity: float = 1, operator: str = "系统", reason: str = "", fee: float = 0, remark: str = "") -> bool:
        if not rental_id or not change_type:
            return False
        self.conn.execute(
            """
            INSERT INTO rental_config_changes(
                rental_id, change_time, change_type, old_part_name, old_part_model, old_part_sn,
                new_part_name, new_part_model, new_part_sn, quantity, operator, reason, fee, remark, created_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (rental_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), change_type, old_part_name, old_part_model, old_part_sn, new_part_name, new_part_model, new_part_sn, quantity, operator, reason, fee, remark, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        )
        self.conn.commit()
        return True

    def add_inventory_transaction(self, model_id: int, trans_type: str, quantity: float, related_rental_id: str = "", operator: str = "系统", note: str = "") -> bool:
        if not model_id or not trans_type or quantity == 0:
            return False
        self.conn.execute(
            """
            INSERT INTO inventory_transactions(model_id, trans_type, quantity, related_rental_id, operator, note, created_at)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (model_id, trans_type, quantity, related_rental_id, operator, note, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        )
        self.conn.commit()
        return True

    def get_inventory_transactions(self, model_id: int = None, related_rental_id: str = "") -> List[Dict]:
        sql = "SELECT * FROM inventory_transactions WHERE 1=1"
        params = []
        if model_id is not None:
            sql += " AND model_id = ?"
            params.append(model_id)
        if related_rental_id:
            sql += " AND related_rental_id = ?"
            params.append(related_rental_id)
        sql += " ORDER BY id DESC"
        rows = self.conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    def get_config_changes(self, rental_id: str) -> List[Dict]:
        rows = self.conn.execute("SELECT * FROM rental_config_changes WHERE rental_id = ? ORDER BY id DESC", (rental_id,)).fetchall()
        return [dict(r) for r in rows]

    def _generate_id(self) -> str:
        """生成唯一 ID。"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")[:17]
        return f"R{timestamp}"

    def generate_unique_id(self) -> str:
        """公开方法：生成唯一 ID（供外部模块调用）。"""
        return self._generate_id()

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


    def close(self):
        """关闭数据库连接。"""
        self.conn.close()
