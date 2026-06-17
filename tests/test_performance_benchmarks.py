#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
性能基准测试 - Phase 4 Week 8 Day 2
测量仪表板加载、报表生成和缓存效果
"""

import unittest
import sys
import time
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.performance_profiler import PerformanceProfiler, PerformanceReport
from core.cache_manager import (
    CacheManager, KPICacheManager, ReportCacheManager, QueryCacheManager
)


class TestCachePerformance(unittest.TestCase):
    """测试缓存性能"""
    
    def setUp(self):
        self.cache = CacheManager(max_size=100)
        self.profiler = PerformanceProfiler()
    
    def test_cache_get_performance(self):
        """测试缓存获取性能"""
        # 预填充缓存
        for i in range(50):
            self.cache.put(f"key_{i}", f"value_{i}", ttl_seconds=3600)
        
        report = PerformanceReport(title="缓存获取性能")
        
        # 测量获取时间
        for i in range(50):
            with self.profiler.start_measurement(f"获取 key_{i}") as m:
                self.cache.get(f"key_{i}")
            report.add_metric(f"获取 key_{i}", m.duration_ms)
        
        # 验证平均时间 < 1ms
        summary = report.get_summary()
        self.assertLess(summary["avg_duration_ms"], 1.0,
                       f"缓存获取太慢: {summary['avg_duration_ms']:.2f}ms")
    
    def test_cache_hit_rate(self):
        """测试缓存命中率"""
        # 填充缓存
        for i in range(20):
            self.cache.put(f"key_{i}", f"value_{i}")
        
        # 执行100次查询
        for _ in range(100):
            self.cache.get("key_0")  # 这个键存在
        
        stats = self.cache.get_stats()
        hit_rate = stats["hit_rate_percent"]
        
        # 验证命中率 > 90%
        self.assertGreater(hit_rate, 90.0,
                          f"缓存命中率太低: {hit_rate:.2f}%")
    
    def test_cache_eviction(self):
        """测试缓存驱逐机制"""
        # 创建小缓存
        small_cache = CacheManager(max_size=10)
        
        # 添加超过容量的项
        for i in range(20):
            small_cache.put(f"key_{i}", f"value_{i}")
        
        # 验证缓存大小不超过max_size
        self.assertLessEqual(
            len(small_cache.cache),
            small_cache.max_size,
            "缓存大小超过限制"
        )
        
        # 验证发生了驱逐
        stats = small_cache.get_stats()
        self.assertGreater(stats["evictions"], 0,
                          "应该发生缓存驱逐")


class TestKPICachePerformance(unittest.TestCase):
    """测试KPI缓存性能"""
    
    def setUp(self):
        self.kpi_cache = KPICacheManager()
        self.profiler = PerformanceProfiler()
    
    def test_kpi_cache_operations(self):
        """测试KPI缓存操作"""
        report = PerformanceReport(title="KPI缓存操作")
        
        # 测试设置KPI
        with self.profiler.start_measurement("设置KPI") as m:
            self.kpi_cache.set_kpi("monthly_revenue", 50000.0)
        report.add_metric("设置KPI", m.duration_ms)
        
        # 测试获取KPI（缓存命中）
        with self.profiler.start_measurement("获取KPI-缓存命中") as m:
            value = self.kpi_cache.get_kpi("monthly_revenue")
        report.add_metric("获取KPI-缓存命中", m.duration_ms)
        
        self.assertEqual(value, 50000.0)
        
        # 测试获取KPI（缓存未命中）
        with self.profiler.start_measurement("获取KPI-缓存未命中") as m:
            value = self.kpi_cache.get_kpi("annual_revenue")
        report.add_metric("获取KPI-缓存未命中", m.duration_ms)
        
        self.assertIsNone(value)
        
        summary = report.get_summary()
        self.assertLess(summary["avg_duration_ms"], 1.0)
    
    def test_kpi_cache_invalidation(self):
        """测试KPI缓存失效"""
        self.kpi_cache.set_kpi("monthly_revenue", 50000.0)
        
        # 验证缓存有值
        self.assertIsNotNone(self.kpi_cache.get_kpi("monthly_revenue"))
        
        # 失效单个KPI
        self.kpi_cache.invalidate_kpi("monthly_revenue")
        
        # 验证已失效
        self.assertIsNone(self.kpi_cache.get_kpi("monthly_revenue"))


class TestReportCachePerformance(unittest.TestCase):
    """测试报表缓存性能"""
    
    def setUp(self):
        self.report_cache = ReportCacheManager()
        self.profiler = PerformanceProfiler()
    
    def test_report_cache_with_filters(self):
        """测试带筛选条件的报表缓存"""
        # 创建测试数据
        test_data = [
            {"id": i, "name": f"客户_{i}", "amount": 1000 * i}
            for i in range(100)
        ]
        
        filters = {"customer": "客户_1", "min_amount": 1000}
        
        # 设置报表数据
        with self.profiler.start_measurement("缓存报表数据") as m:
            self.report_cache.set_report_data("arrears", test_data, filters)
        
        # 获取报表数据
        with self.profiler.start_measurement("获取报表数据-命中") as m:
            cached_data = self.report_cache.get_report_data("arrears", filters)
        
        self.assertEqual(len(cached_data), 100)


class TestQueryCachePerformance(unittest.TestCase):
    """测试数据库查询缓存性能"""
    
    def setUp(self):
        self.query_cache = QueryCacheManager()
        self.profiler = PerformanceProfiler()
    
    def test_query_result_caching(self):
        """测试查询结果缓存"""
        query = "SELECT * FROM rental_contracts WHERE customer_id = ?"
        params = (123,)
        
        # 模拟查询结果
        query_result = [
            {"contract_id": f"C{i}", "customer_id": 123, "amount": 1000}
            for i in range(50)
        ]
        
        # 缓存查询结果
        with self.profiler.start_measurement("缓存查询结果") as m:
            self.query_cache.set_query_result(query, query_result, params)
        
        # 获取缓存的查询结果
        with self.profiler.start_measurement("获取缓存查询结果") as m:
            cached_result = self.query_cache.get_query_result(query, params)
        
        self.assertEqual(len(cached_result), 50)
        self.assertLess(m.duration_ms, 1.0, "查询缓存获取太慢")


class TestPerformanceMetrics(unittest.TestCase):
    """测试性能指标收集"""
    
    def setUp(self):
        self.profiler = PerformanceProfiler()
    
    def test_system_status(self):
        """测试系统状态收集"""
        status = self.profiler.get_system_status()
        
        self.assertIn("memory_usage_mb", status)
        self.assertIn("cpu_percent", status)
        self.assertIn("num_threads", status)
        
        # 验证值合理
        self.assertGreater(status["memory_usage_mb"], 0)
        self.assertGreaterEqual(status["cpu_percent"], 0)
    
    def test_performance_report(self):
        """测试性能报告生成"""
        report = PerformanceReport(title="测试报告")
        
        # 添加一些指标
        for i in range(10):
            report.add_metric(f"操作_{i}", 50 + i * 10)
        
        summary = report.get_summary()
        
        self.assertEqual(summary["metrics_count"], 10)
        self.assertLess(summary["min_duration_ms"], summary["max_duration_ms"])
        self.assertGreater(summary["avg_duration_ms"], 0)


class TestCacheStatsAccuracy(unittest.TestCase):
    """测试缓存统计精度"""
    
    def setUp(self):
        self.cache = CacheManager(max_size=50)
    
    def test_hit_miss_stats(self):
        """测试命中/未命中统计"""
        # 设置初始数据
        self.cache.put("key_1", "value_1")
        self.cache.put("key_2", "value_2")
        
        # 命中
        self.cache.get("key_1")
        self.cache.get("key_1")
        
        # 未命中
        self.cache.get("key_3")
        self.cache.get("key_4")
        
        stats = self.cache.get_stats()
        
        self.assertEqual(stats["hits"], 2)
        self.assertEqual(stats["misses"], 2)
        self.assertEqual(stats["total_queries"], 4)
        self.assertEqual(stats["hit_rate_percent"], 50.0)


class TestCacheExpiration(unittest.TestCase):
    """测试缓存过期机制"""
    
    def setUp(self):
        self.cache = CacheManager(max_size=50)
    
    def test_cache_expiration(self):
        """测试缓存过期"""
        # 设置很短的TTL
        self.cache.put("key_1", "value_1", ttl_seconds=0)
        
        # 稍微等待
        time.sleep(0.1)
        
        # 验证已过期
        result = self.cache.get("key_1")
        self.assertIsNone(result)
    
    def test_clear_expired_entries(self):
        """测试清理过期项"""
        # 添加快速过期的项
        for i in range(10):
            self.cache.put(f"expired_{i}", f"value_{i}", ttl_seconds=0)
        
        # 等待过期
        time.sleep(0.1)
        
        # 清理过期项
        cleared_count = self.cache.clear_expired()
        
        self.assertEqual(cleared_count, 10)


if __name__ == "__main__":
    unittest.main(verbosity=2)
