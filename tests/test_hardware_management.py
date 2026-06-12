#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬件管理模块测试
测试硬件设备配置的估值计算、成本累加和显示功能
"""

import unittest
import json
import tempfile
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.data_manager import DataManager
from modules.hardware_mgmt import format_hardware_display


class TestHardwareValuationCalculations(unittest.TestCase):
    """测试硬件估值计算逻辑"""

    def test_cost_accumulation_logic(self):
        """测试成本累加逻辑"""
        # 模拟多个硬件型号
        selected_models = {
            "cpu": {"reference_cost": 2899.0, "reference_rent": 180.0},
            "mb": {"reference_cost": 3299.0, "reference_rent": 200.0},
            "ram": {"reference_cost": 800.0, "reference_rent": 50.0},
        }
        
        # 验证总成本计算
        total_cost = sum(m.get('reference_cost', 0) for m in selected_models.values() if m)
        expected_total = 2899.0 + 3299.0 + 800.0
        self.assertAlmostEqual(total_cost, expected_total, places=2)
        
        # 验证总租金计算
        total_rent = sum(m.get('reference_rent', 0) for m in selected_models.values() if m)
        expected_rent = 180.0 + 200.0 + 50.0
        self.assertAlmostEqual(total_rent, expected_rent, places=2)

    def test_single_model_cost(self):
        """测试单个型号成本"""
        selected_models = {
            "cpu": {"reference_cost": 1500.0}
        }
        
        total_cost = sum(m.get('reference_cost', 0) for m in selected_models.values() if m)
        self.assertEqual(total_cost, 1500.0)

    def test_empty_models(self):
        """测试空型号列表"""
        selected_models = {}
        
        total_cost = sum(m.get('reference_cost', 0) for m in selected_models.values() if m)
        self.assertEqual(total_cost, 0)

    def test_none_cost_handling(self):
        """测试 None 成本处理"""
        selected_models = {
            "cpu": {"reference_cost": 1000},
            "mb": {"reference_cost": None},
            "ram": {"reference_cost": 500},
        }
        
        # Filter out None values before summing
        total_cost = sum(
            m.get('reference_cost', 0) 
            for m in selected_models.values() 
            if m and m.get('reference_cost') is not None
        )
        self.assertEqual(total_cost, 1500.0)


class TestFormatHardwareDisplay(unittest.TestCase):
    """测试硬件显示格式化函数"""

    def test_display_includes_estimated_value(self):
        """测试格式化输出包含估值"""
        hardware = {
            "items": [
                {
                    "device_type": "台式机",
                    "quantity": 1,
                    "cpu": "Intel i7",
                    "unit_cost": 5000,
                    "estimated_value": 4200,
                }
            ]
        }
        
        result = format_hardware_display(hardware)
        self.assertIn("估值:¥4200", result)

    def test_display_handles_empty_hardware(self):
        """测试空硬件情况"""
        self.assertEqual(format_hardware_display(None), "未添加硬件信息")
        self.assertEqual(format_hardware_display({}), "未添加硬件信息")

    def test_display_multiple_devices(self):
        """测试多设备显示"""
        hardware = {
            "items": [
                {
                    "device_type": "台式机",
                    "quantity": 2,
                    "cpu": "Intel i7",
                    "unit_cost": 5000,
                    "estimated_value": 4500,
                },
                {
                    "device_type": "显示器",
                    "quantity": 1,
                    "monitor_brand": "Dell",
                    "monitor_model": "U2723QE",
                    "estimated_value": 3000,
                }
            ]
        }
        
        result = format_hardware_display(hardware)
        self.assertIn("台式机", result)
        self.assertIn("显示器", result)
        self.assertIn("估值:¥4500", result)
        self.assertIn("估值:¥3000", result)

    def test_display_without_estimated_value(self):
        """测试无估值时的显示"""
        hardware = {
            "items": [
                {
                    "device_type": "台式机",
                    "quantity": 1,
                    "cpu": "Intel i7",
                    "unit_cost": 5000,
                }
            ]
        }
        
        result = format_hardware_display(hardware)
        self.assertNotIn("估值", result)
        self.assertIn("成本:¥5000", result)

    def test_display_cost_summary(self):
        """测试成本汇总显示"""
        hardware = {
            "items": [
                {
                    "device_type": "台式机",
                    "quantity": 1,
                    "unit_cost": 5000,
                },
                {
                    "device_type": "显示器",
                    "quantity": 1,
                    "unit_cost": 2000,
                }
            ]
        }
        
        result = format_hardware_display(hardware)
        # 应该显示每个设备的成本
        self.assertIn("成本:¥5000", result)
        self.assertIn("成本:¥2000", result)

    def test_display_quantity(self):
        """测试数量显示"""
        hardware = {
            "items": [
                {
                    "device_type": "台式机",
                    "quantity": 3,
                    "cpu": "Intel i5",
                }
            ]
        }
        
        result = format_hardware_display(hardware)
        self.assertIn("× 3", result)


class TestHardwareDataStructure(unittest.TestCase):
    """测试硬件数据结构"""

    def test_item_with_all_fields(self):
        """测试包含所有字段的项"""
        item = {
            "device_type": "台式机",
            "quantity": 1,
            "cpu": "Intel i7",
            "motherboard": "ASUS ROG",
            "ram": "32GB DDR5",
            "disk": "1TB SSD",
            "gpu": "RTX 4080",
            "unit_cost": 12000,
            "unit_rent": 800,
            "estimated_value": 10000,
            "accessories": "机械键盘、鼠标",
            "notes": "高性能工作站",
        }
        
        # 验证所有字段都能正确处理
        hardware = {"items": [item]}
        result = format_hardware_display(hardware)
        
        self.assertIn("台式机", result)
        self.assertIn("Intel i7", result)
        self.assertIn("¥12000", result)
        self.assertIn("¥10000", result)  # estimated_value
        self.assertIn("机械键盘、鼠标", result)

    def test_minimal_item(self):
        """测试最小化项"""
        item = {
            "device_type": "显示器",
            "quantity": 1,
        }
        
        hardware = {"items": [item]}
        result = format_hardware_display(hardware)
        
        self.assertIn("显示器", result)
        self.assertIn("× 1", result)

    def test_estimated_value_calculation(self):
        """测试估值计算"""
        items = [
            {"estimated_value": 1000, "quantity": 2},
            {"estimated_value": 500, "quantity": 3},
            {"estimated_value": None, "quantity": 1},
        ]
        
        # 计算总估值（忽略无估值的项）
        total_value = sum(
            float(i.get("quantity", 0) or 0) * float(i.get("estimated_value", 0) or 0)
            for i in items
            if i.get("estimated_value")
        )
        
        expected = 2 * 1000 + 3 * 500
        self.assertEqual(total_value, expected)


class TestHardwareFieldLabels(unittest.TestCase):
    """测试硬件字段标签映射"""

    def test_field_labels(self):
        """测试字段标签映射"""
        labels = {
            'cpu': 'CPU',
            'mb': '主板',
            'ram': '内存',
            'disk': '硬盘',
            'gpu': '显卡',
            'psu': '电源',
            'case': '机箱',
            'cooler': '风扇',
            'monitor': '显示器',
        }
        
        # 验证映射一致性
        for key, label in labels.items():
            self.assertIsNotNone(label)
            self.assertTrue(len(label) > 0)


if __name__ == '__main__':
    unittest.main()
