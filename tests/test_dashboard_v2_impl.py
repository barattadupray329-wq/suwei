"""
Phase 3 Week 7 - Dashboard V2 Comprehensive Test Suite
管理看板UI完整测试套件 - 趋势显示和钻取导航

Test Classes:
    TestKpiCard: 单个KPI卡片功能测试
    TestDashboardV2Frame: 看板框架功能测试
    TestTrendCalculation: 趋势计算和显示测试
    TestDrillDown: 钻取导航测试
    TestDataLoading: 数据加载机制测试
    TestRefreshMechanism: 刷新机制测试
    TestPerformance: 性能测试
    TestIntegration: 集成测试

Coverage:
    - KPI卡片创建和UI更新
    - 趋势计算和百分比显示
    - 趋势颜色编码（深绿/浅绿/红/灰）
    - 钻取导航回调机制
    - 数据加载和缓存
    - 自动刷新定时器
    - 错误处理
    - 性能基准测试

Author: Oz
Date: 2026-06-17
Status: Week 7 Days 3-5 Implementation
"""

import unittest
import tkinter as tk
from unittest.mock import Mock, patch, MagicMock, call
from modules.dashboard_v2 import DashboardV2Frame, KpiCard
import time


class TestKpiCard(unittest.TestCase):
    """KPI卡片组件测试"""

    def setUp(self):
        """测试前准备"""
        self.root = tk.Tk()
        self.root.withdraw()
        self.card = KpiCard(self.root, "月度收入", "元")

    def tearDown(self):
        """测试后清理"""
        try:
            self.root.destroy()
        except:
            pass

    def test_card_creation(self):
        """测试：卡片创建"""
        self.assertIsNotNone(self.card)
        self.assertEqual(self.card.title, "月度收入")
        self.assertEqual(self.card.unit, "元")
        self.assertEqual(self.card.value, 0)
        self.assertFalse(self.card.is_loading)
        self.assertIsNone(self.card.error_message)
        self.assertEqual(self.card.max_history, 30)

    def test_set_value(self):
        """测试：设置数值"""
        self.card.set_value(50000, trend="up", subtitle="本月已收")
        self.assertEqual(self.card.value, 50000)
        self.assertEqual(self.card.trend, "up")
        self.assertFalse(self.card.is_loading)
        # 验证值已添加到历史
        self.assertIn(50000.0, self.card.value_history)

    def test_set_value_with_trend_info(self):
        """测试：设置数值和趋势信息"""
        trend_info = {
            "direction": "up",
            "percentage": 12.5,
            "magnitude": "significant"
        }
        self.card.set_value(50000, trend="up", trend_info=trend_info)
        self.assertEqual(self.card.trend_info, trend_info)

    def test_set_trend_up(self):
        """测试：上升趋势"""
        self.card.set_value(100)
        self.card.set_value(150, trend="up")
        self.assertEqual(self.card.trend, "up")

    def test_set_trend_down(self):
        """测试：下降趋势"""
        self.card.set_value(150)
        self.card.set_value(100, trend="down")
        self.assertEqual(self.card.trend, "down")

    def test_set_trend_flat(self):
        """测试：平稳趋势"""
        self.card.set_value(100)
        self.card.set_value(100, trend="flat")
        self.assertEqual(self.card.trend, "flat")

    def test_loading_state(self):
        """测试：加载状态"""
        self.card.set_loading(True)
        self.assertTrue(self.card.is_loading)
        self.card.set_loading(False)
        self.assertFalse(self.card.is_loading)

    def test_error_state(self):
        """测试：错误状态"""
        error_msg = "数据加载失败"
        self.card.set_error(error_msg)
        self.assertFalse(self.card.is_loading)
        self.assertEqual(self.card.error_message, error_msg)

    def test_value_history_tracking(self):
        """测试：值历史记录"""
        for i in range(1, 6):
            self.card.set_value(i * 100)
        self.assertEqual(len(self.card.value_history), 5)
        self.assertEqual(self.card.value_history, [100.0, 200.0, 300.0, 400.0, 500.0])

    def test_value_history_ring_buffer(self):
        """测试：值历史环形缓冲（最多30个）"""
        for i in range(1, 35):
            self.card.set_value(i * 100)
        # 应该只保留最后30个
        self.assertLessEqual(len(self.card.value_history), 30)
        self.assertEqual(self.card.value_history[-1], 3400.0)

    def test_format_value_integer(self):
        """测试：整数格式化"""
        formatted = self.card._format_value(1000)
        self.assertEqual(formatted, "1,000")

    def test_format_value_float_currency(self):
        """测试：浮点数（货币）格式化"""
        card = KpiCard(self.root, "收入", "元")
        formatted = card._format_value(1234.56)
        self.assertEqual(formatted, "1,235")

    def test_format_value_percentage(self):
        """测试：百分比格式化"""
        card = KpiCard(self.root, "收款率", "%")
        formatted = card._format_value(85.5)
        self.assertEqual(formatted, "85.5")

    def test_bind_click_callback(self):
        """测试：点击回调"""
        callback = Mock()
        self.card.bind_click(callback)
        self.assertEqual(self.card.on_click, callback)

    def test_get_trend_color_with_magnitude(self):
        """测试：趋势颜色（基于幅度）"""
        # 上升显著
        trend_info = {"magnitude": "significant", "percentage": 10.0}
        self.card.trend = "up"
        self.card.trend_info = trend_info
        color = self.card._get_trend_color()
        self.assertEqual(color, "#2e7d32")  # 深绿

        # 上升轻微
        trend_info = {"magnitude": "slight", "percentage": 2.0}
        self.card.trend_info = trend_info
        color = self.card._get_trend_color()
        self.assertEqual(color, "#4caf50")  # 浅绿

        # 下降显著
        self.card.trend = "down"
        trend_info = {"magnitude": "significant"}
        self.card.trend_info = trend_info
        color = self.card._get_trend_color()
        self.assertEqual(color, "#c62828")  # 深红


class TestDashboardV2Frame(unittest.TestCase):
    """Dashboard框架测试"""

    def setUp(self):
        """测试前准备"""
        self.root = tk.Tk()
        self.root.withdraw()
        self.mock_engine = Mock()
        self.dashboard = DashboardV2Frame(self.root, report_engine=self.mock_engine)

    def tearDown(self):
        """测试后清理"""
        try:
            self.root.destroy()
        except:
            pass

    def test_frame_creation(self):
        """测试：框架创建"""
        self.assertIsNotNone(self.dashboard)
        self.assertEqual(self.dashboard.report_engine, self.mock_engine)
        self.assertTrue(self.dashboard.auto_refresh)
        self.assertEqual(self.dashboard.refresh_interval, 30000)

    def test_kpi_cards_creation(self):
        """测试：KPI卡片创建"""
        self.assertEqual(len(self.dashboard.kpi_cards), 8)

    def test_kpi_cards_titles(self):
        """测试：KPI卡片标题"""
        expected_titles = [
            "月度收入", "年度收入", "活跃合同", "未收总额",
            "逾期合同", "收款率", "换机次数", "高风险客户"
        ]
        for title in expected_titles:
            self.assertIn(title, self.dashboard.kpi_cards)

    def test_kpi_key_map(self):
        """测试：KPI标题到关键字的映射"""
        self.assertEqual(self.dashboard.kpi_key_map["月度收入"], "monthly_revenue")
        self.assertEqual(self.dashboard.kpi_key_map["年度收入"], "annual_revenue")
        self.assertEqual(self.dashboard.kpi_key_map["活跃合同"], "active_contracts")


class TestTrendCalculation(unittest.TestCase):
    """趋势计算和显示测试"""

    def setUp(self):
        """测试前准备"""
        self.root = tk.Tk()
        self.root.withdraw()
        self.dashboard = DashboardV2Frame(self.root)

    def tearDown(self):
        """测试后清理"""
        try:
            self.root.destroy()
        except:
            pass

    def test_calculate_trend_up(self):
        """测试：计算上升趋势"""
        trend = self.dashboard._calculate_trend(150, 100)
        self.assertEqual(trend, "up")

    def test_calculate_trend_down(self):
        """测试：计算下降趋势"""
        trend = self.dashboard._calculate_trend(100, 150)
        self.assertEqual(trend, "down")

    def test_calculate_trend_flat(self):
        """测试：计算平稳趋势"""
        trend = self.dashboard._calculate_trend(100, 100)
        self.assertEqual(trend, "flat")

    def test_build_trend_info_up(self):
        """测试：构建上升趋势信息"""
        trend_info = self.dashboard._build_trend_info(125, 100)
        self.assertEqual(trend_info["direction"], "up")
        self.assertEqual(trend_info["percentage"], 25.0)
        self.assertEqual(trend_info["magnitude"], "significant")

    def test_build_trend_info_down(self):
        """测试：构建下降趋势信息"""
        trend_info = self.dashboard._build_trend_info(90, 100)
        self.assertEqual(trend_info["direction"], "down")
        self.assertEqual(trend_info["percentage"], -10.0)
        self.assertEqual(trend_info["magnitude"], "significant")

    def test_build_trend_info_slight_change(self):
        """测试：轻微变化"""
        trend_info = self.dashboard._build_trend_info(102, 100)
        self.assertEqual(trend_info["direction"], "up")
        self.assertEqual(trend_info["percentage"], 2.0)
        self.assertEqual(trend_info["magnitude"], "slight")

    def test_build_trend_info_no_change(self):
        """测试：无变化"""
        trend_info = self.dashboard._build_trend_info(100, 100)
        self.assertEqual(trend_info["direction"], "flat")
        self.assertEqual(trend_info["percentage"], 0)
        self.assertEqual(trend_info["magnitude"], "flat")

    def test_build_trend_info_zero_previous(self):
        """测试：前一个值为0的情况"""
        trend_info = self.dashboard._build_trend_info(100, 0)
        self.assertEqual(trend_info["direction"], "up")
        self.assertEqual(trend_info["percentage"], 100.0)
        self.assertEqual(trend_info["magnitude"], "significant")

    def test_build_trend_info_invalid_values(self):
        """测试：无效值处理"""
        trend_info = self.dashboard._build_trend_info("invalid", "data")
        self.assertEqual(trend_info["direction"], "flat")
        self.assertEqual(trend_info["percentage"], 0)


class TestDrillDown(unittest.TestCase):
    """钻取导航测试"""

    def setUp(self):
        """测试前准备"""
        self.root = tk.Tk()
        self.root.withdraw()
        self.dashboard = DashboardV2Frame(self.root)
        self.drill_down_callback = Mock()

    def tearDown(self):
        """测试后清理"""
        try:
            self.root.destroy()
        except:
            pass

    def test_set_drill_down_callback(self):
        """测试：设置钻取回调"""
        self.dashboard.set_drill_down_callback(self.drill_down_callback)
        self.assertEqual(self.dashboard.drill_down_callback, self.drill_down_callback)

    def test_kpi_click_with_callback(self):
        """测试：点击KPI卡片触发钻取"""
        self.dashboard.set_drill_down_callback(self.drill_down_callback)
        self.dashboard.data_cache = {"monthly_revenue": 50000}
        self.dashboard.previous_data = {"monthly_revenue": 40000}

        self.dashboard._on_kpi_click("月度收入")

        # 验证回调被调用
        self.drill_down_callback.assert_called_once()
        call_args = self.drill_down_callback.call_args
        self.assertEqual(call_args[0][0], "monthly_revenue")
        self.assertEqual(call_args[0][1]["kpi_title"], "月度收入")
        self.assertEqual(call_args[0][1]["current_value"], 50000)

    def test_kpi_click_without_callback(self):
        """测试：点击KPI卡片但无回调"""
        self.dashboard.data_cache = {"monthly_revenue": 50000}
        # 不设置回调
        self.dashboard._on_kpi_click("月度收入")
        # 应该不抛异常


class TestDataLoading(unittest.TestCase):
    """数据加载机制测试"""

    def setUp(self):
        """测试前准备"""
        self.root = tk.Tk()
        self.root.withdraw()
        self.mock_engine = Mock()
        self.dashboard = DashboardV2Frame(self.root, report_engine=self.mock_engine)

    def tearDown(self):
        """测试后清理"""
        try:
            self.root.destroy()
        except:
            pass

    def test_empty_metrics(self):
        """测试：空指标"""
        metrics = self.dashboard._empty_metrics()
        self.assertEqual(len(metrics), 8)
        self.assertTrue(all(v == 0 for v in metrics.values()))

    def test_normalize_metrics(self):
        """测试：指标归一化"""
        raw_metrics = {
            "monthly_revenue": 50000,
            "month_revenue": 40000,  # 应该被覆盖
            "annual_revenue": 600000,
        }
        normalized = self.dashboard._normalize_metrics(raw_metrics)
        self.assertEqual(normalized["monthly_revenue"], 50000)
        self.assertEqual(normalized["annual_revenue"], 600000)

    def test_collect_dashboard_metrics_no_engine(self):
        """测试：无engine时收集指标"""
        dashboard = DashboardV2Frame(self.root, report_engine=None)
        metrics = dashboard._collect_dashboard_metrics()
        self.assertEqual(len(metrics), 8)

    def test_collect_dashboard_metrics_with_method(self):
        """测试：使用engine的get_dashboard_metrics方法"""
        self.mock_engine.get_dashboard_metrics.return_value = {
            "monthly_revenue": 50000,
            "annual_revenue": 600000,
        }
        metrics = self.dashboard._collect_dashboard_metrics()
        self.mock_engine.get_dashboard_metrics.assert_called_once()

    def test_build_subtitles(self):
        """测试：构建卡片副标题"""
        metrics = {}
        subtitles = self.dashboard._build_subtitles(metrics)
        self.assertEqual(len(subtitles), 8)
        self.assertEqual(subtitles["monthly_revenue"], "本月已收款金额")
        self.assertEqual(subtitles["unpaid_amount"], "所有合同剩余未收")


class TestRefreshMechanism(unittest.TestCase):
    """刷新机制测试"""

    def setUp(self):
        """测试前准备"""
        self.root = tk.Tk()
        self.root.withdraw()
        self.mock_engine = Mock()
        self.dashboard = DashboardV2Frame(self.root, report_engine=self.mock_engine)

    def tearDown(self):
        """测试后清理"""
        try:
            self.dashboard.after_cancel(id(self.dashboard))
        except:
            pass
        try:
            self.root.destroy()
        except:
            pass

    def test_auto_refresh_enabled(self):
        """测试：自动刷新启用"""
        self.assertTrue(self.dashboard.auto_refresh)

    def test_auto_refresh_toggle(self):
        """测试：自动刷新切换"""
        self.dashboard.set_auto_refresh(False)
        self.assertFalse(self.dashboard.auto_refresh)
        self.dashboard.set_auto_refresh(True)
        self.assertTrue(self.dashboard.auto_refresh)

    def test_refresh_interval(self):
        """测试：刷新间隔"""
        self.assertEqual(self.dashboard.refresh_interval, 30000)  # 30秒

    def test_prevent_concurrent_loading(self):
        """测试：防止并发加载"""
        self.dashboard.is_loading = True
        self.mock_engine.reset_mock()
        self.dashboard.load_data()
        # 由于is_loading已为True，应该立即返回
        # （实际的async加载不会执行）


class TestPerformance(unittest.TestCase):
    """性能测试"""

    def setUp(self):
        """测试前准备"""
        self.root = tk.Tk()
        self.root.withdraw()

    def tearDown(self):
        """测试后清理"""
        try:
            self.root.destroy()
        except:
            pass

    def test_frame_creation_time(self):
        """测试：框架创建时间 <1秒"""
        start = time.time()
        dashboard = DashboardV2Frame(self.root)
        duration = time.time() - start
        self.assertLess(duration, 1.0, f"框架创建耗时 {duration:.2f}s，应 <1s")

    def test_kpi_card_creation_time(self):
        """测试：单个KPI卡片创建时间"""
        start = time.time()
        card = KpiCard(self.root, "测试", "单位")
        duration = time.time() - start
        self.assertLess(duration, 0.1, f"卡片创建耗时 {duration:.2f}s")

    def test_trend_calculation_performance(self):
        """测试：趋势计算性能（1000次<100ms）"""
        dashboard = DashboardV2Frame(self.root)
        start = time.time()
        for i in range(1000):
            dashboard._build_trend_info(i * 100 + i, i * 100)
        duration = (time.time() - start) * 1000  # 转换为毫秒
        self.assertLess(duration, 100, f"1000次趋势计算耗时 {duration:.1f}ms")


class TestIntegration(unittest.TestCase):
    """集成测试"""

    def setUp(self):
        """测试前准备"""
        self.root = tk.Tk()
        self.root.withdraw()
        self.mock_engine = Mock()
        self.dashboard = DashboardV2Frame(self.root, report_engine=self.mock_engine)

    def tearDown(self):
        """测试后清理"""
        try:
            self.root.destroy()
        except:
            pass

    def test_end_to_end_workflow(self):
        """测试：端到端工作流"""
        # 1. 创建Dashboard
        self.assertIsNotNone(self.dashboard)

        # 2. 设置钻取回调
        callback = Mock()
        self.dashboard.set_drill_down_callback(callback)

        # 3. 模拟数据加载
        test_metrics = {
            "monthly_revenue": 50000,
            "annual_revenue": 600000,
            "active_contracts": 25,
            "unpaid_amount": 15000,
            "overdue_contracts": 3,
            "payment_rate": 85.5,
            "monthly_exchanges": 12,
            "high_risk_customers": 2,
        }
        self.dashboard._apply_metrics(test_metrics)

        # 4. 验证KPI卡片已更新
        revenue_card = self.dashboard.kpi_cards["月度收入"]
        self.assertEqual(revenue_card.value, 50000)

        # 5. 验证趋势信息
        self.assertIsNotNone(revenue_card.trend_info)

    def test_kpi_drill_down_integration(self):
        """测试：KPI钻取集成"""
        callback = Mock()
        self.dashboard.set_drill_down_callback(callback)

        # 设置数据
        self.dashboard.data_cache = {
            "monthly_revenue": 50000,
            "annual_revenue": 600000,
        }
        self.dashboard.previous_data = {
            "monthly_revenue": 40000,
            "annual_revenue": 550000,
        }

        # 触发点击
        self.dashboard._on_kpi_click("月度收入")

        # 验证回调参数
        self.assertTrue(callback.called)
        kpi_key, drill_params = callback.call_args[0]
        self.assertEqual(kpi_key, "monthly_revenue")
        self.assertEqual(drill_params["kpi_title"], "月度收入")
        self.assertEqual(drill_params["current_value"], 50000)
        self.assertEqual(drill_params["previous_value"], 40000)


if __name__ == "__main__":
    unittest.main()
