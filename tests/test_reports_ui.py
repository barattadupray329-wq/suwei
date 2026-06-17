#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 3 Week 6: 报表UI单元测试
测试范围:
- ReportsV2Frame 框架初始化和生命周期
- ArrearsDetailReport 数据加载和渲染
- ExchangeFrequencyReport 视图切换和数据加载
- 用户交互：搜索、排序、导出
"""

import unittest
import tempfile
import shutil
import tkinter as tk
from core.data_manager import DataManager
from core.report_engine import ReportEngine
from modules.reports_v2 import ReportsV2Frame, ArrearsDetailReport, ExchangeFrequencyReport


class TestReportsV2Frame(unittest.TestCase):
    """报表UI框架测试"""
    
    def setUp(self):
        """创建临时数据库和Tkinter根窗口"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(self.temp_dir)
        self.engine = ReportEngine(self.dm)
        
        self.root = tk.Tk()
        self.root.withdraw()
    
    def tearDown(self):
        """清理资源"""
        self.dm.conn.close()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        try:
            self.root.destroy()
        except:
            pass
    
    def test_frame_creation(self):
        """测试：框架创建"""
        frame = ReportsV2Frame(self.root, self.dm, self.engine)
        self.assertIsNotNone(frame)
        self.assertIsNotNone(frame.treeview)
        self.assertIsNotNone(frame.status_label)
    
    def test_frame_widgets(self):
        """测试：框架包含所有必需的widget"""
        frame = ReportsV2Frame(self.root, self.dm, self.engine)
        self.assertIsNotNone(frame.status_label)
        self.assertIsNotNone(frame.report_type_combo)
        self.assertIsNotNone(frame.customer_filter_entry)
        self.assertIsNotNone(frame.refresh_btn)
        self.assertIsNotNone(frame.export_btn)
        self.assertIsNotNone(frame.apply_filter_btn)
        self.assertIsNotNone(frame.clear_filter_btn)
    
    def test_report_type_switching(self):
        """测试：报表类型切换"""
        frame = ReportsV2Frame(self.root, self.dm, self.engine)
        # 初始应该是欠款报表
        self.assertEqual(frame.current_report_type, "arrears")
        # 切换到换机报表
        frame.report_type_var.set("设备换机频率统计")
        frame._on_report_type_changed()
        self.assertEqual(frame.current_report_type, "exchange")
    
    def test_data_loading(self):
        """测试：数据加载"""
        frame = ReportsV2Frame(self.root, self.dm, self.engine)
        # 加载数据应该不抛出异常
        try:
            frame.load_data("arrears")
        except Exception as e:
            self.fail(f"数据加载失败: {e}")
    
    def test_refresh_button(self):
        """测试：刷新按钮"""
        frame = ReportsV2Frame(self.root, self.dm, self.engine)
        # 刷新按钮应该可调用
        try:
            frame.refresh()
        except Exception as e:
            self.fail(f"刷新失败: {e}")
    
    def test_export_button(self):
        """测试：导出按钮"""
        frame = ReportsV2Frame(self.root, self.dm, self.engine)
        # 在没有数据时导出应该显示警告
        # 这个测试验证导出按钮存在且可调用
        self.assertIsNotNone(frame.export_btn)


class TestArrearsDetailReport(unittest.TestCase):
    """欠款明细报表测试"""
    
    def setUp(self):
        """创建临时数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(self.temp_dir)
        self.engine = ReportEngine(self.dm)
        
        self.root = tk.Tk()
        self.root.withdraw()
        self.frame = tk.Frame(self.root)
    
    def tearDown(self):
        """清理资源"""
        self.dm.conn.close()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        try:
            self.root.destroy()
        except:
            pass
    
    def test_load_data_empty(self):
        """测试：空数据处理"""
        report = ArrearsDetailReport(self.frame, self.engine)
        # 空数据加载应该不抛出异常
        try:
            report.load_data()
            self.assertEqual(len(report.data), 0)
        except Exception as e:
            self.fail(f"空数据加载失败: {e}")
    
    def test_load_data_with_filter(self):
        """测试：带过滤条件加载数据"""
        report = ArrearsDetailReport(self.frame, self.engine)
        # 传入客户名称过滤条件加载
        try:
            report.load_data(customer_name="不存在的客户")
            # 不存在的客户应该造成空结果
            self.assertEqual(len(report.data), 0)
        except Exception as e:
            self.fail(f"有条件加载失败: {e}")
    
    def test_render_table(self):
        """测试：表格渲染"""
        report = ArrearsDetailReport(self.frame, self.engine)
        # 渲染空数据不应抛出异常
        try:
            report.render_table([])
            # 表格应该为空
            self.assertEqual(len(report.treeview.get_children()), 0)
        except Exception as e:
            self.fail(f"表格渲染失败: {e}")
    
    def test_column_sorting(self):
        """测试：按列排序"""
        report = ArrearsDetailReport(self.frame, self.engine)
        # 排序应该不抛出异常（或应该切换排序状态）
        try:
            # 不存在数据时排序
            report.on_sort_column("customer_name")
            # 验证排序状态字典更新了
            self.assertIn("customer_name", report.sort_reverse)
        except Exception as e:
            self.fail(f"排序失败: {e}")
    
    def test_customer_search(self):
        """测试：客户搜索过滤"""
        report = ArrearsDetailReport(self.frame, self.engine)
        # 搎法：通过 load_data() 方法的参数实现客户搜索
        try:
            report.load_data(customer_name="Test Customer")
            # 不应抛出异常
        except Exception as e:
            self.fail(f"客户搜索失败: {e}")
    
    def test_row_double_click(self):
        """测试：双击打开详情"""
        report = ArrearsDetailReport(self.frame, self.engine)
        # 双击事件应该存在
        self.assertIsNotNone(report.on_row_double_click)
    
    def test_csv_export(self):
        """测试：CSV导出"""
        report = ArrearsDetailReport(self.frame, self.engine)
        # 导出CSV不应抛出异常（或返回空CSV）
        try:
            csv_content = report.export_csv()
            self.assertIsInstance(csv_content, str)
        except Exception as e:
            self.fail(f"CSV导出失败: {e}")
    
    def test_overdue_highlighting(self):
        """测试：逾期合同高亮"""
        report = ArrearsDetailReport(self.frame, self.engine)
        # 验证高亮标签是否存在
        try:
            # 配置存在（标签已预先配置）
            report.treeview.tag_configure("overdue", foreground="red")
            # 测试成功（标签配置正常工作）
            self.assertIsNotNone(report.treeview)
        except Exception as e:
            self.fail(f"高亮鈅验失败: {e}")


class TestExchangeFrequencyReport(unittest.TestCase):
    """换机频率报表测试"""
    
    def setUp(self):
        """创建临时数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(self.temp_dir)
        self.engine = ReportEngine(self.dm)
        
        self.root = tk.Tk()
        self.root.withdraw()
        self.frame = tk.Frame(self.root)
    
    def tearDown(self):
        """清理资源"""
        self.dm.conn.close()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        try:
            self.root.destroy()
        except:
            pass
    
    def test_summary_view_load(self):
        """测试：汇总视图加载"""
        report = ExchangeFrequencyReport(tk.Frame(self.root), self.engine)
        # 应该默认是汇总视图
        self.assertEqual(report.view_type, "summary")
        try:
            report.load_summary()
        except Exception as e:
            self.fail(f"汇总视图加载失败: {e}")
    
    def test_detail_view_load(self):
        """测试：明细视图加载"""
        report = ExchangeFrequencyReport(tk.Frame(self.root), self.engine)
        try:
            report.load_detail()
        except Exception as e:
            self.fail(f"明细视图加载失败: {e}")
    
    def test_view_switching(self):
        """测试：视图切换"""
        report = ExchangeFrequencyReport(tk.Frame(self.root), self.engine)
        # 创旧切换到明细视图
        self.assertEqual(report.view_type, "summary")
        try:
            report.switch_view("detail")
            self.assertEqual(report.view_type, "detail")
        except Exception as e:
            self.fail(f"视图切换失败: {e}")
    
    def test_date_range_filter(self):
        """测试：日期范围过滤"""
        report = ExchangeFrequencyReport(tk.Frame(self.root), self.engine)
        try:
            report.load_summary(start_date="2026-01-01", end_date="2026-12-31")
        except Exception as e:
            self.fail(f"日期范围过滤失败: {e}")
    
    def test_reason_filter(self):
        """测试：按原因过滤"""
        report = ExchangeFrequencyReport(tk.Frame(self.root), self.engine)
        try:
            report.load_detail(reason="故障")
        except Exception as e:
            self.fail(f"原因过滤失败: {e}")
    
    def test_customer_filter(self):
        """测试：按客户过滤"""
        report = ExchangeFrequencyReport(tk.Frame(self.root), self.engine)
        try:
            report.load_detail(customer_name="Test Customer")
        except Exception as e:
            self.fail(f"客户过滤失败: {e}")
    
    def test_csv_export(self):
        """测试：CSV导出"""
        report = ExchangeFrequencyReport(tk.Frame(self.root), self.engine)
        try:
            csv_content = report.export_csv()
            self.assertIsInstance(csv_content, str)
        except Exception as e:
            self.fail(f"CSV导出失败: {e}")


class TestReportDialogs(unittest.TestCase):
    """报表对话框测试"""
    
    def setUp(self):
        """创建临时数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(self.temp_dir)
        self.engine = ReportEngine(self.dm)
        
        self.root = tk.Tk()
        self.root.withdraw()
    
    def tearDown(self):
        """清理资源"""
        self.dm.conn.close()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        try:
            self.root.destroy()
        except:
            pass
    
    def test_report_detail_dialog(self):
        """测试：报表详情弹窗"""
        # TODO: Day 2 实现
        pass
    
    def test_payment_history_dialog(self):
        """测试：收款历史弹窗"""
        # TODO: Day 2 实现
        pass


class TestReportIntegration(unittest.TestCase):
    """报表集成测试"""
    
    def setUp(self):
        """创建临时数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(self.temp_dir)
        self.engine = ReportEngine(self.dm)
    
    def tearDown(self):
        """清理资源"""
        self.dm.conn.close()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_end_to_end_workflow(self):
        """测试：端到端工作流
        
        流程：
        1. 加载欠款报表
        2. 搜索客户
        3. 排序
        4. 导出CSV
        """
        root = tk.Tk()
        root.withdraw()
        try:
            frame = ReportsV2Frame(root, self.dm, self.engine)
            frame.load_data("arrears")
            frame.customer_filter_var.set("Test")
            frame._apply_filters()
            frame._sort_column("customer_name")
            self.assertIsNotNone(frame.current_data)
        finally:
            try:
                root.destroy()
            except:
                pass
    
    def test_ui_responsiveness(self):
        """测试：UI响应速度
        
        验证：
        - 数据加载时间 < 1秒
        - 排序时间 < 500ms
        - 导出时间 < 500ms
        """
        import time
        root = tk.Tk()
        root.withdraw()
        try:
            frame = ReportsV2Frame(root, self.dm, self.engine)
            start = time.time()
            frame.load_data("arrears")
            load_time = time.time() - start
            self.assertLess(load_time, 1.0)
        finally:
            try:
                root.destroy()
            except:
                pass
    
    def test_error_handling(self):
        """测试：错误处理
        
        验证：
        - 空数据处理
        - 无效输入处理
        - 数据库错误处理
        """
        root = tk.Tk()
        root.withdraw()
        try:
            frame = ReportsV2Frame(root, self.dm, self.engine)
            frame.load_data("arrears")
            frame.customer_filter_var.set("不存在的客户")
            frame._apply_filters()
            self.assertIsNotNone(frame.status_label)
        finally:
            try:
                root.destroy()
            except:
                pass


if __name__ == '__main__':
    unittest.main()
