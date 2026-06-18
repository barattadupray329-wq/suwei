#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
运行时设置（轻量配置）
当前用于保存可选的数据目录。
"""

import json
from pathlib import Path
from typing import Dict, Optional

CONFIG_FILE = Path(__file__).parent.parent / "runtime_config.json"


def _load_settings() -> Dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_settings(settings: Dict):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)


def get_data_dir_override() -> Optional[str]:
    settings = _load_settings()
    path = (settings.get("data_dir") or "").strip()
    return path or None


def set_data_dir_override(path: str):
    settings = _load_settings()
    settings["data_dir"] = str(Path(path).expanduser().resolve())
    _save_settings(settings)


def clear_data_dir_override():
    settings = _load_settings()
    settings.pop("data_dir", None)
    _save_settings(settings)
