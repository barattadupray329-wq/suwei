#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬件品牌型号数据库
提供常见电脑配件的品牌和型号数据，供下拉选择和自动补全
"""

CPU_BRANDS = [
    "Intel i3-12100F", "Intel i3-13100F", "Intel i5-12400F", "Intel i5-13400F",
    "Intel i5-13600KF", "Intel i5-14400F", "Intel i5-14600KF",
    "Intel i7-12700F", "Intel i7-13700F", "Intel i7-14700KF",
    "Intel i9-12900K", "Intel i9-13900K", "Intel i9-14900K",
    "AMD R5 5600", "AMD R5 5600X", "AMD R5 7500F", "AMD R5 7600X",
    "AMD R7 5700X", "AMD R7 5800X3D", "AMD R7 7700X", "AMD R7 7800X3D",
    "AMD R9 5900X", "AMD R9 7950X",
]

MB_BRANDS = [
    "技嘉 H610M", "技嘉 B760M", "技嘉 Z790",
    "华硕 H610M", "华硕 B760M", "华硕 Z790",
    "微星 H610M", "微星 B760M", "微星 Z790",
    "华擎 H610M", "华擎 B760M",
    "铭瑄 H610M", "铭瑄 B760M",
    "七彩虹 B760M",
]

GPU_BRANDS = [
    "NVIDIA GTX 1660S 6G", "NVIDIA RTX 2060 6G", "NVIDIA RTX 2060S 8G",
    "NVIDIA RTX 3060 12G", "NVIDIA RTX 3060Ti 8G", "NVIDIA RTX 3070 8G",
    "NVIDIA RTX 4060 8G", "NVIDIA RTX 4060 12G", "NVIDIA RTX 4060Ti 8G",
    "NVIDIA RTX 4070 12G", "NVIDIA RTX 4070S 12G", "NVIDIA RTX 4070Ti 12G",
    "NVIDIA RTX 4080 16G", "NVIDIA RTX 4080S 16G", "NVIDIA RTX 4090D 24G",
    "AMD RX 6600 8G", "AMD RX 6650XT 8G", "AMD RX 6750GRE 12G",
    "AMD RX 7600 8G", "AMD RX 7800XT 16G", "AMD RX 7900XT 20G",
]

RAM_BRANDS = [
    "DDR4 8G 3200", "DDR4 16G 3200", "DDR4 8G×2 3200", "DDR4 16G×2 3200",
    "DDR4 8G 3600", "DDR4 16G 3600", "DDR4 32G 3200",
    "DDR5 16G 5600", "DDR5 16G×2 5600", "DDR5 32G 6000", "DDR5 32G×2 6000",
]

DISK_BRANDS = [
    "金士顿 500G NVMe", "金士顿 1TB NVMe", "金士顿 2TB NVMe",
    "三星 500G NVMe", "三星 1TB NVMe", "三星 2TB NVMe",
    "西数 500G NVMe", "西数 1TB NVMe", "西数 2TB NVMe",
    "铠侠 500G NVMe", "铠侠 1TB NVMe",
    "致态 500G NVMe", "致态 1TB NVMe", "致态 2TB NVMe",
    "希捷 1TB HDD", "希捷 2TB HDD", "西数 1TB HDD", "西数 2TB HDD",
    "金士顿 240G SATA", "金士顿 480G SATA", "金士顿 960G SATA",
]

PSU_BRANDS = [
    "航嘉 400W", "航嘉 500W", "航嘉 600W", "航嘉 650W", "航嘉 700W", "航嘉 750W",
    "长城 400W", "长城 500W", "长城 600W", "长城 650W", "长城 700W", "长城 750W",
    "酷冷至尊 500W", "酷冷至尊 600W", "酷冷至尊 650W", "酷冷至尊 750W",
    "海盗船 550W", "海盗船 650W", "海盗船 750W", "海盗船 850W",
    "振华 550W", "振华 650W", "振华 750W",
    "安钛克 500W", "安钛克 650W", "安钛克 750W",
]

CASE_BRANDS = [
    "商途", "先马 平头哥", "先马 黑洞", "先马 坦克",
    "酷冷至尊 MB520", "酷冷至尊 Q300L",
    "海盗船 4000D", "追风者 P300A", "追风者 P400A",
    "九州风神 CK560", "联力 216", "联力 O11D",
    "恩杰 H510", "乔思伯 D31", "乔思伯 D41",
]

COOLER_BRANDS = [
    "原装风扇 2热管", "原装风扇 4热管", "6热管", "8热管",
    "九州风神 玄冰400", "九州风神 大霜塔", "九州风神 阿萨辛",
    "利民 AX120R", "利民 PA120", "利民 FC140",
    "猫头鹰 NH-U12S", "猫头鹰 NH-D15",
    "酷冷至尊 冰神B240", "酷冷至尊 冰神B360",
    "海盗船 H100i", "海盗船 H150i",
    "瓦尔基里 C240", "瓦尔基里 C360",
    "雅浚 B3", "雅浚 G5", "雅浚 G7",
]

OS_OPTIONS = [
    "Windows 10 专业版", "Windows 10 家庭版", "Windows 10 企业版",
    "Windows 11 专业版", "Windows 11 家庭版", "Windows 11 企业版",
    "Windows Server 2019", "Windows Server 2022",
    "Ubuntu 22.04", "CentOS 7", "Debian 12",
]

# 分组映射
BRAND_MAP = {
    "cpu": CPU_BRANDS,
    "mb": MB_BRANDS,
    "gpu": GPU_BRANDS,
    "ram": RAM_BRANDS,
    "disk": DISK_BRANDS,
    "psu": PSU_BRANDS,
    "case": CASE_BRANDS,
    "cooler": COOLER_BRANDS,
    "os": OS_OPTIONS,
}

# 配件价格参考 (元)
REFERENCE_PRICES = {
    "Intel i5-13400F": 895, "Intel i5-12400F": 680,
    "Intel i7-13700F": 1800, "Intel i9-13900K": 3200,
    "AMD R5 5600": 550, "AMD R5 7500F": 850,
    "技嘉 H610M": 285, "华硕 H610M": 320, "微星 B760M": 580,
    "NVIDIA RTX 4060 12G": 1850, "NVIDIA RTX 4070 12G": 3500,
    "DDR4 8G×2 3200": 560, "DDR5 16G×2 5600": 800,
    "金士顿 1TB NVMe": 650, "三星 1TB NVMe": 750,
    "航嘉 600W": 135, "长城 600W": 150,
}
