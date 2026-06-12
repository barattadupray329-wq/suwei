#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬件型号数据库
提供完整的硬件型号、规格、参考价格数据，用于自动补全和动态定价
"""

from typing import List, Dict

# 硬件型号数据（约100款，覆盖2013年至今主流及二手常用硬件）
HARDWARE_MODELS: List[Dict] = [
    # ── Intel CPU（2013年至今）────────────────────────────────────────
    # 第4代 Haswell / 6代 Skylake / 7代 Kaby Lake / 8代 Coffee Lake
    {"category": "cpu", "brand": "Intel", "model_name": "i3-12100F", "specs": {"cores": 4, "threads": 8, "socket": "LGA1700", "tdp": 58}, "reference_cost": 450, "reference_rent": 18, "release_year": 2022},
    {"category": "cpu", "brand": "Intel", "model_name": "i5-12400F", "specs": {"cores": 6, "threads": 12, "socket": "LGA1700", "tdp": 65}, "reference_cost": 680, "reference_rent": 27, "release_year": 2022},
    {"category": "cpu", "brand": "Intel", "model_name": "i5-13400F", "specs": {"cores": 10, "threads": 16, "socket": "LGA1700", "tdp": 65}, "reference_cost": 895, "reference_rent": 36, "release_year": 2023},
    {"category": "cpu", "brand": "Intel", "model_name": "i5-14400F", "specs": {"cores": 10, "threads": 16, "socket": "LGA1700", "tdp": 65}, "reference_cost": 980, "reference_rent": 39, "release_year": 2024},
    {"category": "cpu", "brand": "Intel", "model_name": "i7-12700F", "specs": {"cores": 12, "threads": 20, "socket": "LGA1700", "tdp": 65}, "reference_cost": 1500, "reference_rent": 60, "release_year": 2022},
    {"category": "cpu", "brand": "Intel", "model_name": "i7-13700F", "specs": {"cores": 16, "threads": 24, "socket": "LGA1700", "tdp": 65}, "reference_cost": 1800, "reference_rent": 72, "release_year": 2023},
    {"category": "cpu", "brand": "Intel", "model_name": "i9-13900K", "specs": {"cores": 24, "threads": 32, "socket": "LGA1700", "tdp": 125}, "reference_cost": 3200, "reference_rent": 128, "release_year": 2023},
    
    # ── AMD CPU（2017年至今）────────────────────────────────────────
    {"category": "cpu", "brand": "AMD", "model_name": "R5 5600", "specs": {"cores": 6, "threads": 12, "socket": "AM4", "tdp": 65}, "reference_cost": 550, "reference_rent": 22, "release_year": 2022},
    {"category": "cpu", "brand": "AMD", "model_name": "R5 5600X", "specs": {"cores": 6, "threads": 12, "socket": "AM4", "tdp": 65}, "reference_cost": 650, "reference_rent": 26, "release_year": 2020},
    {"category": "cpu", "brand": "AMD", "model_name": "R7 5700X", "specs": {"cores": 8, "threads": 16, "socket": "AM4", "tdp": 65}, "reference_cost": 800, "reference_rent": 32, "release_year": 2022},
    {"category": "cpu", "brand": "AMD", "model_name": "R7 7700X", "specs": {"cores": 8, "threads": 16, "socket": "AM5", "tdp": 105}, "reference_cost": 1900, "reference_rent": 76, "release_year": 2022},
    {"category": "cpu", "brand": "AMD", "model_name": "R9 7950X", "specs": {"cores": 16, "threads": 32, "socket": "AM5", "tdp": 170}, "reference_cost": 4200, "reference_rent": 168, "release_year": 2022},

    # ── 主板 ─────────────────────────────────────────────────────
    {"category": "mb", "brand": "华硕", "model_name": "H610M-A", "specs": {"socket": "LGA1700", "chipset": "H610"}, "reference_cost": 420, "reference_rent": 17, "release_year": 2022},
    {"category": "mb", "brand": "技嘉", "model_name": "B760M GAMING X", "specs": {"socket": "LGA1700", "chipset": "B760"}, "reference_cost": 780, "reference_rent": 31, "release_year": 2023},
    {"category": "mb", "brand": "微星", "model_name": "B760M BOMBER WIFI", "specs": {"socket": "LGA1700", "chipset": "B760"}, "reference_cost": 680, "reference_rent": 27, "release_year": 2023},
    {"category": "mb", "brand": "华硕", "model_name": "B650M-AYW WIFI", "specs": {"socket": "AM5", "chipset": "B650"}, "reference_cost": 850, "reference_rent": 34, "release_year": 2022},
    {"category": "mb", "brand": "技嘉", "model_name": "B650M AORUS ELITE", "specs": {"socket": "AM5", "chipset": "B650"}, "reference_cost": 900, "reference_rent": 36, "release_year": 2022},
    {"category": "mb", "brand": "华擎", "model_name": "B550M Pro RS", "specs": {"socket": "AM4", "chipset": "B550"}, "reference_cost": 600, "reference_rent": 24, "release_year": 2020},

    # ── 内存 ─────────────────────────────────────────────────────
    {"category": "ram", "brand": "金士顿", "model_name": "8GB DDR4 3200", "specs": {"capacity": "8GB", "type": "DDR4", "speed": "3200MHz"}, "reference_cost": 140, "reference_rent": 6, "release_year": 2019},
    {"category": "ram", "brand": "金士顿", "model_name": "16GB DDR4 3200", "specs": {"capacity": "16GB", "type": "DDR4", "speed": "3200MHz"}, "reference_cost": 250, "reference_rent": 10, "release_year": 2019},
    {"category": "ram", "brand": "海盗船", "model_name": "16GB DDR4 3600 Vengeance", "specs": {"capacity": "16GB", "type": "DDR4", "speed": "3600MHz"}, "reference_cost": 320, "reference_rent": 13, "release_year": 2020},
    {"category": "ram", "brand": "金士顿", "model_name": "16GB DDR5 5600", "specs": {"capacity": "16GB", "type": "DDR5", "speed": "5600MHz"}, "reference_cost": 420, "reference_rent": 17, "release_year": 2022},
    {"category": "ram", "brand": "海盗船", "model_name": "32GB DDR5 5600 Vengeance", "specs": {"capacity": "32GB", "type": "DDR5", "speed": "5600MHz"}, "reference_cost": 800, "reference_rent": 32, "release_year": 2022},
    {"category": "ram", "brand": "芝奇", "model_name": "32GB DDR5 6000 Trident Z5", "specs": {"capacity": "32GB", "type": "DDR5", "speed": "6000MHz"}, "reference_cost": 950, "reference_rent": 38, "release_year": 2022},

    # ── 硬盘 ─────────────────────────────────────────────────────
    {"category": "disk", "brand": "金士顿", "model_name": "1TB NVMe NV2", "specs": {"interface": "PCIe 4.0", "form_factor": "M.2", "capacity": "1TB"}, "reference_cost": 280, "reference_rent": 11, "release_year": 2022},
    {"category": "disk", "brand": "三星", "model_name": "1TB NVMe 980 PRO", "specs": {"interface": "PCIe 4.0", "form_factor": "M.2", "capacity": "1TB"}, "reference_cost": 550, "reference_rent": 22, "release_year": 2023},
    {"category": "disk", "brand": "西数", "model_name": "2TB NVMe Black SN850X", "specs": {"interface": "PCIe 4.0", "form_factor": "M.2", "capacity": "2TB"}, "reference_cost": 900, "reference_rent": 36, "release_year": 2022},
    {"category": "disk", "brand": "致态", "model_name": "2TB NVMe TiPlus7100", "specs": {"interface": "PCIe 4.0", "form_factor": "M.2", "capacity": "2TB"}, "reference_cost": 850, "reference_rent": 34, "release_year": 2023},
    {"category": "disk", "brand": "西数", "model_name": "2TB HDD Blue", "specs": {"interface": "SATA", "form_factor": "3.5 inch", "capacity": "2TB", "rpm": 7200}, "reference_cost": 220, "reference_rent": 9, "release_year": 2013},

    # ── 显卡 ─────────────────────────────────────────────────────
    {"category": "gpu", "brand": "NVIDIA", "model_name": "RTX 4060 8G", "specs": {"memory": "8GB GDDR6", "interface": "PCIe 4.0"}, "reference_cost": 1600, "reference_rent": 64, "release_year": 2023},
    {"category": "gpu", "brand": "NVIDIA", "model_name": "RTX 4070 12G", "specs": {"memory": "12GB GDDR6X", "interface": "PCIe 4.0"}, "reference_cost": 3500, "reference_rent": 140, "release_year": 2023},
    {"category": "gpu", "brand": "NVIDIA", "model_name": "RTX 4080 16G", "specs": {"memory": "16GB GDDR6X", "interface": "PCIe 4.0"}, "reference_cost": 8000, "reference_rent": 320, "release_year": 2022},
    {"category": "gpu", "brand": "AMD", "model_name": "RX 7800 XT 16G", "specs": {"memory": "16GB GDDR6", "interface": "PCIe 4.0"}, "reference_cost": 3500, "reference_rent": 140, "release_year": 2023},
    {"category": "gpu", "brand": "NVIDIA", "model_name": "RTX 3070 8G", "specs": {"memory": "8GB GDDR6", "interface": "PCIe 4.0"}, "reference_cost": 1800, "reference_rent": 72, "release_year": 2020},

    # ── 电源 ─────────────────────────────────────────────────────
    {"category": "psu", "brand": "航嘉", "model_name": "600W", "specs": {"wattage": 600, "certification": "80 PLUS"}, "reference_cost": 250, "reference_rent": 10, "release_year": 2013},
    {"category": "psu", "brand": "长城", "model_name": "650W", "specs": {"wattage": 650, "certification": "80 PLUS Bronze"}, "reference_cost": 320, "reference_rent": 13, "release_year": 2015},
    {"category": "psu", "brand": "海盗船", "model_name": "750W RM750", "specs": {"wattage": 750, "certification": "80 PLUS Gold"}, "reference_cost": 580, "reference_rent": 23, "release_year": 2021},
    {"category": "psu", "brand": "振华", "model_name": "650W Leadex Gold", "specs": {"wattage": 650, "certification": "80 PLUS Gold"}, "reference_cost": 450, "reference_rent": 18, "release_year": 2019},
    {"category": "psu", "brand": "酷冷至尊", "model_name": "750W V2 Gold", "specs": {"wattage": 750, "certification": "80 PLUS Gold"}, "reference_cost": 520, "reference_rent": 21, "release_year": 2021},

    # ── 机箱 ─────────────────────────────────────────────────────
    {"category": "case", "brand": "先马", "model_name": "坦克 300", "specs": {"form_factor": "ATX"}, "reference_cost": 250, "reference_rent": 10, "release_year": 2020},
    {"category": "case", "brand": "酷冷至尊", "model_name": "Q300L", "specs": {"form_factor": "ATX/mATX"}, "reference_cost": 280, "reference_rent": 11, "release_year": 2019},
    {"category": "case", "brand": "海盗船", "model_name": "4000D Airflow", "specs": {"form_factor": "ATX"}, "reference_cost": 450, "reference_rent": 18, "release_year": 2020},
    {"category": "case", "brand": "追风者", "model_name": "P400A", "specs": {"form_factor": "ATX"}, "reference_cost": 380, "reference_rent": 15, "release_year": 2019},
    {"category": "case", "brand": "联力", "model_name": "LANCOOL 216", "specs": {"form_factor": "ATX"}, "reference_cost": 450, "reference_rent": 18, "release_year": 2022},

    # ── 散热器 ───────────────────────────────────────────────────
    {"category": "cooler", "brand": "九州风神", "model_name": "玄冰400", "specs": {"type": "风冷", "tdp": 150}, "reference_cost": 90, "reference_rent": 4, "release_year": 2018},
    {"category": "cooler", "brand": "利民", "model_name": "PA120 SE", "specs": {"type": "风冷", "tdp": 220}, "reference_cost": 180, "reference_rent": 7, "release_year": 2021},
    {"category": "cooler", "brand": "酷冷至尊", "model_name": "冰神 B360", "specs": {"type": "水冷", "tdp": 300}, "reference_cost": 380, "reference_rent": 15, "release_year": 2018},
    {"category": "cooler", "brand": "海盗船", "model_name": "H150i", "specs": {"type": "水冷", "tdp": 300}, "reference_cost": 800, "reference_rent": 32, "release_year": 2021},
{"category": "cooler", "brand": "瓦尔基里", "model_name": "C360", "specs": {"type": "水冷", "tdp": 300}, "reference_cost": 500, "reference_rent": 20, "release_year": 2022},

    # ── 常用二手/老平台扩展（2016-2021 主流二手租赁常用）────────────────
    # Intel 6-10代 CPU
    {"category": "cpu", "brand": "Intel", "model_name": "i3-6100", "specs": {"cores": 2, "threads": 4, "socket": "LGA1151", "tdp": 51}, "reference_cost": 180, "reference_rent": 8, "release_year": 2015},
    {"category": "cpu", "brand": "Intel", "model_name": "i5-6500", "specs": {"cores": 4, "threads": 4, "socket": "LGA1151", "tdp": 65}, "reference_cost": 280, "reference_rent": 12, "release_year": 2015},
    {"category": "cpu", "brand": "Intel", "model_name": "i5-7500", "specs": {"cores": 4, "threads": 4, "socket": "LGA1151", "tdp": 65}, "reference_cost": 320, "reference_rent": 14, "release_year": 2017},
    {"category": "cpu", "brand": "Intel", "model_name": "i5-8400", "specs": {"cores": 6, "threads": 6, "socket": "LGA1151", "tdp": 65}, "reference_cost": 450, "reference_rent": 19, "release_year": 2017},
    {"category": "cpu", "brand": "Intel", "model_name": "i5-9400F", "specs": {"cores": 6, "threads": 6, "socket": "LGA1151", "tdp": 65}, "reference_cost": 520, "reference_rent": 22, "release_year": 2019},
    {"category": "cpu", "brand": "Intel", "model_name": "i5-10400F", "specs": {"cores": 6, "threads": 12, "socket": "LGA1200", "tdp": 65}, "reference_cost": 620, "reference_rent": 26, "release_year": 2020},
    # AMD Ryzen 2000/3000 系列
    {"category": "cpu", "brand": "AMD", "model_name": "R3 2200G", "specs": {"cores": 4, "threads": 4, "socket": "AM4", "tdp": 65}, "reference_cost": 280, "reference_rent": 12, "release_year": 2018},
    {"category": "cpu", "brand": "AMD", "model_name": "R5 2600", "specs": {"cores": 6, "threads": 12, "socket": "AM4", "tdp": 65}, "reference_cost": 420, "reference_rent": 18, "release_year": 2017},
    {"category": "cpu", "brand": "AMD", "model_name": "R5 3600", "specs": {"cores": 6, "threads": 12, "socket": "AM4", "tdp": 65}, "reference_cost": 580, "reference_rent": 24, "release_year": 2019},
    {"category": "cpu", "brand": "AMD", "model_name": "R7 3700X", "specs": {"cores": 8, "threads": 16, "socket": "AM4", "tdp": 65}, "reference_cost": 950, "reference_rent": 38, "release_year": 2019},
    # 老显卡（GTX 10/16 系列）
    {"category": "gpu", "brand": "NVIDIA", "model_name": "GTX 1050 Ti 4G", "specs": {"memory": "4GB GDDR5", "interface": "PCIe 3.0"}, "reference_cost": 450, "reference_rent": 19, "release_year": 2016},
    {"category": "gpu", "brand": "NVIDIA", "model_name": "GTX 1060 6G", "specs": {"memory": "6GB GDDR5", "interface": "PCIe 3.0"}, "reference_cost": 650, "reference_rent": 27, "release_year": 2016},
    {"category": "gpu", "brand": "NVIDIA", "model_name": "GTX 1660 6G", "specs": {"memory": "6GB GDDR6", "interface": "PCIe 3.0"}, "reference_cost": 950, "reference_rent": 38, "release_year": 2019},
    {"category": "gpu", "brand": "NVIDIA", "model_name": "GTX 1660 Ti", "specs": {"memory": "6GB GDDR6", "interface": "PCIe 3.0"}, "reference_cost": 1100, "reference_rent": 44, "release_year": 2019},
    # 更多 DDR4 内存
    {"category": "ram", "brand": "金士顿", "model_name": "8GB DDR4 2666", "specs": {"capacity": "8GB", "type": "DDR4", "speed": "2666MHz"}, "reference_cost": 110, "reference_rent": 5, "release_year": 2017},
    {"category": "ram", "brand": "威刚", "model_name": "16GB DDR4 3200", "specs": {"capacity": "16GB", "type": "DDR4", "speed": "3200MHz"}, "reference_cost": 210, "reference_rent": 9, "release_year": 2019},
    # SATA SSD / 老 HDD
    {"category": "disk", "brand": "金士顿", "model_name": "480GB SSD A400", "specs": {"interface": "SATA", "form_factor": "2.5 inch", "capacity": "480GB"}, "reference_cost": 160, "reference_rent": 7, "release_year": 2017},
    {"category": "disk", "brand": "西数", "model_name": "1TB HDD Blue", "specs": {"interface": "SATA", "form_factor": "3.5 inch", "capacity": "1TB", "rpm": 7200}, "reference_cost": 180, "reference_rent": 8, "release_year": 2016},
    # 老主板
    {"category": "mb", "brand": "华硕", "model_name": "B360M PRO-VDH", "specs": {"socket": "LGA1151", "chipset": "B360"}, "reference_cost": 380, "reference_rent": 16, "release_year": 2018},
    {"category": "mb", "brand": "技嘉", "model_name": "B450M DS3H", "specs": {"socket": "AM4", "chipset": "B450"}, "reference_cost": 420, "reference_rent": 18, "release_year": 2018},
    # 老电源/机箱/散热
    {"category": "psu", "brand": "航嘉", "model_name": "500W 冷静王", "specs": {"wattage": 500, "certification": "80 PLUS"}, "reference_cost": 160, "reference_rent": 7, "release_year": 2015},
    {"category": "case", "brand": "先马", "model_name": "黑洞", "specs": {"form_factor": "ATX"}, "reference_cost": 180, "reference_rent": 8, "release_year": 2016},
    {"category": "cooler", "brand": "九州风神", "model_name": "玄冰 400", "specs": {"type": "风冷", "tdp": 150}, "reference_cost": 85, "reference_rent": 4, "release_year": 2017},
    # 显示器（monitor 分类）
    {"category": "monitor", "brand": "AOC", "model_name": "24B1XH", "specs": {"size": "23.6 inch", "resolution": "1920x1080", "panel": "IPS"}, "reference_cost": 420, "reference_rent": 18, "release_year": 2018},
    {"category": "monitor", "brand": "戴尔", "model_name": "P2419H", "specs": {"size": "23.8 inch", "resolution": "1920x1080", "panel": "IPS"}, "reference_cost": 580, "reference_rent": 24, "release_year": 2019},
]
