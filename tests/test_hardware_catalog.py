#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬件目录数据库与自动补全功能测试
测试 DataManager 的 hardware_models 表操作和搜索功能
"""

import unittest
import json
import tempfile
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.data_manager import DataManager
from modules.hardware_models import HARDWARE_MODELS


class TestHardwareCatalogDatabase(unittest.TestCase):
    """测试硬件目录数据库的创建和迁移"""

    def setUp(self):
        """每个测试前创建临时数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(data_dir=self.temp_dir)

    def tearDown(self):
        """每个测试后清理临时数据库"""
        self.dm.close()
        # 清理临时文件
        for f in os.listdir(self.temp_dir):
            os.remove(os.path.join(self.temp_dir, f))
        os.rmdir(self.temp_dir)

    def test_migration_creates_hardware_models_table(self):
        """测试迁移正确创建 hardware_models 表"""
        # 检查表是否存在
        cursor = self.dm.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='hardware_models'"
        )
        self.assertIsNotNone(cursor.fetchone(), "hardware_models 表应该被创建")

    def test_hardware_models_table_schema(self):
        """测试 hardware_models 表的列结构"""
        cursor = self.dm.conn.execute("PRAGMA table_info(hardware_models)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}

        expected_columns = {
            'id': 'INTEGER',
            'category': 'TEXT',
            'brand': 'TEXT',
            'model_name': 'TEXT',
            'specs': 'TEXT',
            'reference_cost': 'REAL',
            'reference_rent': 'REAL',
            'release_year': 'INTEGER',
            'is_active': 'INTEGER',
            'updated_at': 'TEXT',
        }

        for col_name, col_type in expected_columns.items():
            self.assertIn(col_name, columns, f"列 {col_name} 应该存在")
            self.assertEqual(
                columns[col_name], col_type,
                f"列 {col_name} 的类型应该是 {col_type}"
            )

    def test_indexes_are_created(self):
        """测试索引被正确创建"""
        cursor = self.dm.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='hardware_models'"
        )
        indexes = [row[0] for row in cursor.fetchall()]

        expected_indexes = [
            'idx_hardware_models_category',
            'idx_hardware_models_brand',
            'idx_hardware_models_name',
        ]

        for idx in expected_indexes:
            self.assertIn(idx, indexes, f"索引 {idx} 应该被创建")

    def test_db_version_is_updated(self):
        """测试数据库版本号正确更新到 4"""
        self.assertEqual(self.dm.DB_VERSION, 4, "数据库版本应该为 4")
        version = self.dm._get_schema_version()
        self.assertEqual(version, 4, "数据库 schema 版本应该为 4")


class TestHardwareDataInitialization(unittest.TestCase):
    """测试硬件型号数据初始化"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(data_dir=self.temp_dir)

    def tearDown(self):
        self.dm.close()
        for f in os.listdir(self.temp_dir):
            os.remove(os.path.join(self.temp_dir, f))
        os.rmdir(self.temp_dir)

    def test_hardware_models_are_populated(self):
        """测试硬件型号数据被正确填充"""
        count = self.dm.conn.execute(
            "SELECT COUNT(*) as total FROM hardware_models"
        ).fetchone()["total"]

        self.assertGreater(count, 0, "hardware_models 表应该有数据")
        self.assertEqual(
            count, len(HARDWARE_MODELS),
            f"应该有 {len(HARDWARE_MODELS)} 条硬件型号数据"
        )

    def test_cpu_models_exist(self):
        """测试 CPU 型号数据存在"""
        cpu_count = self.dm.conn.execute(
            "SELECT COUNT(*) as total FROM hardware_models WHERE category='cpu'"
        ).fetchone()["total"]
        self.assertGreater(cpu_count, 0, "应该有 CPU 型号数据")

    def test_gpu_models_exist(self):
        """测试 GPU 型号数据存在"""
        gpu_count = self.dm.conn.execute(
            "SELECT COUNT(*) as total FROM hardware_models WHERE category='gpu'"
        ).fetchone()["total"]
        self.assertGreater(gpu_count, 0, "应该有 GPU 型号数据")

    def test_mb_models_exist(self):
        """测试主板型号数据存在"""
        mb_count = self.dm.conn.execute(
            "SELECT COUNT(*) as total FROM hardware_models WHERE category='mb'"
        ).fetchone()["total"]
        self.assertGreater(mb_count, 0, "应该有主板型号数据")

    def test_model_has_reference_cost(self):
        """测试型号有参考价格"""
        row = self.dm.conn.execute(
            "SELECT reference_cost FROM hardware_models WHERE reference_cost IS NOT NULL LIMIT 1"
        ).fetchone()
        self.assertIsNotNone(row, "应该有型号包含参考价格")
        self.assertGreater(row["reference_cost"], 0, "参考价格应该大于 0")

    def test_model_has_reference_rent(self):
        """测试型号有参考租金"""
        row = self.dm.conn.execute(
            "SELECT reference_rent FROM hardware_models WHERE reference_rent IS NOT NULL LIMIT 1"
        ).fetchone()
        self.assertIsNotNone(row, "应该有型号包含参考租金")
        self.assertGreater(row["reference_rent"], 0, "参考租金应该大于 0")

    def test_model_has_release_year(self):
        """测试型号有发布年份"""
        row = self.dm.conn.execute(
            "SELECT release_year FROM hardware_models WHERE release_year IS NOT NULL LIMIT 1"
        ).fetchone()
        self.assertIsNotNone(row, "应该有型号包含发布年份")
        self.assertGreaterEqual(row["release_year"], 2013, "发布年份应该 >= 2013")

    def test_specs_are_stored_as_json(self):
        """测试规格数据以 JSON 格式存储"""
        row = self.dm.conn.execute(
            "SELECT specs FROM hardware_models WHERE specs IS NOT NULL LIMIT 1"
        ).fetchone()
        if row and row["specs"]:
            # 应该可以解析为 JSON
            specs = json.loads(row["specs"])
            self.assertIsInstance(specs, dict, "规格应该是字典格式")

    def test_brands_are_refactored(self):
        """测试品牌库已重构为纯品牌名称"""
        brands = self.dm.get_brands("cpu")
        # 应该只有 Intel 和 AMD，不包含型号
        self.assertIn("Intel", brands)
        self.assertIn("AMD", brands)
        # 不应该包含型号信息
        for brand in brands:
            self.assertNotIn(" ", brand, f"品牌名称不应包含空格：{brand}")


class TestHardwareModelSearch(unittest.TestCase):
    """测试硬件型号搜索功能"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(data_dir=self.temp_dir)

    def tearDown(self):
        self.dm.close()
        for f in os.listdir(self.temp_dir):
            os.remove(os.path.join(self.temp_dir, f))
        os.rmdir(self.temp_dir)

    def test_search_by_brand(self):
        """测试按品牌搜索"""
        results = self.dm.search_models("Intel", category="cpu")
        self.assertGreater(len(results), 0, "应该找到 Intel CPU")
        for r in results:
            self.assertEqual(r["brand"], "Intel")

    def test_search_by_model_name(self):
        """测试按型号名称搜索"""
        results = self.dm.search_models("i5")
        self.assertGreater(len(results), 0, "应该找到 i5 型号")
        # 结果中应该包含 i5 相关型号
        found_i5 = any("i5" in r["model_name"] for r in results)
        self.assertTrue(found_i5, "结果应该包含 i5 型号")

    def test_search_by_category(self):
        """测试按分类搜索"""
        results = self.dm.search_models("", category="gpu")
        self.assertGreater(len(results), 0, "应该找到 GPU 型号")
        for r in results:
            self.assertEqual(r["category"], "gpu")

    def test_search_limit(self):
        """测试搜索结果限制"""
        results = self.dm.search_models("", limit=5)
        self.assertLessEqual(len(results), 5, "结果数量不应超过限制")

    def test_search_fuzzy_match(self):
        """测试模糊匹配"""
        results = self.dm.search_models("RTX")
        self.assertGreater(len(results), 0, "模糊搜索 RTX 应该找到结果")

    def test_search_returns_required_fields(self):
        """测试搜索返回所需字段"""
        results = self.dm.search_models("Intel", limit=1)
        if results:
            result = results[0]
            required_fields = ['id', 'category', 'brand', 'model_name', 'specs',
                             'reference_cost', 'reference_rent', 'release_year']
            for field in required_fields:
                self.assertIn(field, result, f"结果应该包含字段 {field}")

    def test_search_no_results(self):
        """测试无结果搜索"""
        results = self.dm.search_models("不存在的型号XYZ")
        self.assertEqual(len(results), 0, "不存在的型号应该返回空列表")

    def test_search_case_insensitive(self):
        """测试搜索不区分大小写"""
        results_intel = self.dm.search_models("Intel")
        results_intel_lower = self.dm.search_models("intel")
        # 应该返回相同数量的结果（LIKE 不区分大小写）
        self.assertEqual(len(results_intel), len(results_intel_lower))


class TestHardwareModelQueries(unittest.TestCase):
    """测试硬件型号查询功能"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(data_dir=self.temp_dir)

    def tearDown(self):
        self.dm.close()
        for f in os.listdir(self.temp_dir):
            os.remove(os.path.join(self.temp_dir, f))
        os.rmdir(self.temp_dir)

    def test_get_models_by_category(self):
        """测试按分类获取所有型号"""
        models = self.dm.get_models_by_category("cpu")
        self.assertGreater(len(models), 0, "CPU 分类应该有型号")
        for m in models:
            self.assertEqual(m["category"], "cpu")

    def test_get_model_by_id(self):
        """测试按 ID 获取型号"""
        # 先获取一个有效的 ID
        row = self.dm.conn.execute(
            "SELECT id FROM hardware_models LIMIT 1"
        ).fetchone()
        if row:
            model = self.dm.get_model_by_id(row["id"])
            self.assertIsNotNone(model, "应该能找到型号")
            self.assertEqual(model["id"], row["id"])

    def test_get_model_by_invalid_id(self):
        """测试获取不存在的型号"""
        model = self.dm.get_model_by_id(999999)
        self.assertIsNone(model, "不存在的 ID 应该返回 None")

    def test_specs_are_parsed_to_dict(self):
        """测试规格 JSON 被正确解析"""
        row = self.dm.conn.execute(
            "SELECT id FROM hardware_models WHERE specs IS NOT NULL LIMIT 1"
        ).fetchone()
        if row:
            model = self.dm.get_model_by_id(row["id"])
            if model and model.get("specs"):
                self.assertIsInstance(model["specs"], dict, "specs 应该是 dict 类型")


class TestHardwareModelData(unittest.TestCase):
    """测试硬件型号数据结构和完整性"""

    def test_hardware_models_structure(self):
        """测试 HARDWARE_MODELS 数据结构正确"""
        for model in HARDWARE_MODELS:
            self.assertIn("category", model, "每个型号应该有 category")
            self.assertIn("brand", model, "每个型号应该有 brand")
            self.assertIn("model_name", model, "每个型号应该有 model_name")
            self.assertIn("reference_cost", model, "每个型号应该有 reference_cost")
            self.assertIn("reference_rent", model, "每个型号应该有 reference_rent")
            self.assertIn("release_year", model, "每个型号应该有 release_year")

    def test_categories_are_valid(self):
        """测试所有分类都是有效的"""
        valid_categories = {"cpu", "mb", "gpu", "ram", "disk", "psu", "case", "cooler", "monitor"}
        for model in HARDWARE_MODELS:
            self.assertIn(
                model["category"], valid_categories,
                f"分类 {model['category']} 不在有效分类列表中"
            )

    def test_reference_cost_is_positive(self):
        """测试参考价格为正数"""
        for model in HARDWARE_MODELS:
            if model.get("reference_cost"):
                self.assertGreater(
                    model["reference_cost"], 0,
                    f"型号 {model['model_name']} 的参考价格应该大于 0"
                )

    def test_reference_rent_is_positive(self):
        """测试参考租金为正数"""
        for model in HARDWARE_MODELS:
            if model.get("reference_rent"):
                self.assertGreater(
                    model["reference_rent"], 0,
                    f"型号 {model['model_name']} 的参考租金应该大于 0"
                )

    def test_release_year_is_valid(self):
        """测试发布年份有效"""
        for model in HARDWARE_MODELS:
            if model.get("release_year"):
                self.assertGreaterEqual(
                    model["release_year"], 2013,
                    f"型号 {model['model_name']} 的发布年份应该 >= 2013"
                )
                self.assertLessEqual(
                    model["release_year"], 2026,
                    f"型号 {model['model_name']} 的发布年份应该 <= 2026"
                )


if __name__ == '__main__':
    unittest.main()
