#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SQLite Migration / 版本回溯功能测试。"""

import json
import tempfile
from pathlib import Path

from core.data_manager import DataManager


def build_record(name="SQL测试用户", paid_amount=0):
    return {
        "renter": {
            "name": name,
            "phone": "13800009999",
            "id_card": "",
            "address": "测试地址",
        },
        "lease_info": {
            "start_date": "2026-06-01",
            "end_date": "2026-07-01",
            "monthly_rent": 100.0,
            "total_rent": 100.0,
            "deposit": 0.0,
            "lease_months": 1.0,
        },
        "status": "在租",
        "paid_amount": paid_amount,
        "renew_history": [],
        "hardware": {"cpu": "i5"},
    }


def main():
    print("=" * 60)
    print("SQL MIGRATION / ROLLBACK TEST")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmp:
        data_dir = Path(tmp)
        json_file = data_dir / "rental_data.json"
        legacy = {
            "rental_records": [build_record("旧JSON用户", 20)],
            "settings": {"default_admin": "admin", "last_backup": None},
        }
        legacy["rental_records"][0]["id"] = "RLEGACY001"
        legacy["rental_records"][0]["register_date"] = "2026-06-01 10:00:00"
        json_file.write_text(json.dumps(legacy, ensure_ascii=False, indent=2), encoding="utf-8")

        dm = DataManager(str(data_dir))

        version = dm._get_schema_version()
        assert version == DataManager.DB_VERSION, f"Expected DB version {DataManager.DB_VERSION}, got {version}"
        print(f"[PASS] Migration version: {version}")

        records = dm.get_records()
        assert len(records) == 1 and records[0]["id"] == "RLEGACY001", "Legacy JSON import failed"
        print("[PASS] Legacy JSON imported into SQLite")

        rec = build_record("版本回溯用户", 0)
        assert dm.add_record(rec), "Create failed"
        rid = rec["id"]
        print(f"[PASS] Created record: {rid}")

        assert dm.update_record(rid, {"paid_amount": 88.0}), "Update failed"
        updated = dm.get_record_by_id(rid)
        assert updated["paid_amount"] == 88.0, "Updated value not persisted"
        print("[PASS] Update persisted")

        versions = dm.get_record_versions(rid)
        assert len(versions) >= 2, "Record history missing"
        original = next(v for v in versions if v["data"] and v["data"].get("paid_amount") == 0)
        print(f"[PASS] Version history captured ({len(versions)} versions)")

        assert dm.rollback_record(rid, original["version_id"]), "Rollback failed"
        rolled_back = dm.get_record_by_id(rid)
        assert rolled_back["paid_amount"] == 0, "Rollback value mismatch"
        print("[PASS] Rollback restored historical version")

        assert (data_dir / "rental_data.db").exists(), "SQLite database not created"
        assert json_file.exists(), "JSON compatibility snapshot missing"
        print("[PASS] SQLite DB and JSON snapshot exist")

        dm.close()

    print("=" * 60)
    print("STATUS: ALL PASS")
    print("=" * 60)


if __name__ == "__main__":
    main()
