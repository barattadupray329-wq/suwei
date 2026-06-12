#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬件品牌数据库
只提供纯品牌名称，不包含具体型号（型号由 hardware_models 管理）
"""

from typing import List, Dict

# 纯品牌名称列表（不含型号）
CPU_BRANDS = ["Intel", "AMD"]

MB_BRANDS = ["华硕", "技嘉", "微星", "华擎", "铭瑄", "七彩虹", "映泰"]

GPU_BRANDS = ["NVIDIA", "AMD", "Intel"]

RAM_BRANDS = ["金士顿", "芝奇", "海盗船", "威刚", "金百达", "宇瞻", "光威", "玖合"]

DISK_BRANDS = ["三星", "西数", "金士顿", "铠侠", "致态", "希捷", "长江存储"]

PSU_BRANDS = ["航嘉", "长城", "酷冷至尊", "海盗船", "振华", "安钛克", "海韵"]

CASE_BRANDS = ["先马", "酷冷至尊", "海盗船", "联力", "恩杰", "乔思伯", "追风者", "九州风神"]

COOLER_BRANDS = ["九州风神", "利民", "猫头鹰", "酷冷至尊", "海盗船", "瓦尔基里", "雅浚"]

MONITOR_BRANDS = ["戴尔", "AOC", "飞利浦", "三星", "LG", "华硕", "小米", "HKC"]

OS_OPTIONS = [
    "Windows 10 专业版", "Windows 10 家庭版", "Windows 10 企业版",
    "Windows 11 专业版", "Windows 11 家庭版", "Windows 11 企业版",
    "Windows Server 2019", "Windows Server 2022",
    "Ubuntu 22.04", "CentOS 7", "Debian 12",
]

# 分类到品牌列表的映射
BRAND_MAP = {
    "cpu": CPU_BRANDS,
    "mb": MB_BRANDS,
    "gpu": GPU_BRANDS,
    "ram": RAM_BRANDS,
    "disk": DISK_BRANDS,
    "psu": PSU_BRANDS,
    "case": CASE_BRANDS,
    "cooler": COOLER_BRANDS,
    "monitor": MONITOR_BRANDS,
    "os": OS_OPTIONS,
}

# 分类显示名映射
CATEGORY_LABELS = {
    "cpu":    ("🧠 CPU",        CPU_BRANDS),
    "mb":     ("🔧 主板",       MB_BRANDS),
    "gpu":    ("🎮 显卡",       GPU_BRANDS),
    "ram":    ("💾 内存",       RAM_BRANDS),
    "disk":   ("💿 硬盘",       DISK_BRANDS),
    "psu":    ("⚡ 电源",       PSU_BRANDS),
    "case":   ("🖥️ 机箱",       CASE_BRANDS),
    "cooler": ("❄️ 散热器",     COOLER_BRANDS),
    "monitor":("🖥️ 显示器",     MONITOR_BRANDS),
    "os":     ("🪟 操作系统",   OS_OPTIONS),
}


class HardwareBrandManager:
    """硬件品牌库管理器 — 封装 DataManager 的品牌操作。"""

    def __init__(self, data_manager):
        self.dm = data_manager

    def get_categories(self):
        """返回所有分类标识和显示名。"""
        return [(key, label, fallback)
                for key, (label, fallback) in self.CATEGORY_LABELS.items()]

    def get_brands(self, category: str) -> List[str]:
        """获取指定分类的品牌列表（优先数据库，回退静态常量）。"""
        db_list = self.dm.get_brands(category)
        if db_list:
            return db_list
        _, fallback = self.CATEGORY_LABELS.get(category, ("", []))
        return list(fallback)

    def add_brand(self, category: str, name: str) -> bool:
        return self.dm.add_brand(category, name)

    def delete_brand(self, category: str, name: str) -> bool:
        return self.dm.delete_brand(category, name)

    def import_brands(self, category: str, names: List[str]) -> int:
        return self.dm.import_brands(category, names)

    def get_all_brands_with_models(self, category: str) -> List[Dict]:
        """获取品牌及其关联的型号数量"""
        brands = self.get_brands(category)
        result = []
        for brand in brands:
            model_count = self.dm.conn.execute(
                "SELECT COUNT(*) as cnt FROM hardware_models WHERE category = ? AND brand = ? AND is_active = 1",
                (category, brand)
            ).fetchone()["cnt"]
            result.append({
                "brand": brand,
                "model_count": model_count,
                "category": category
            })
        return result
