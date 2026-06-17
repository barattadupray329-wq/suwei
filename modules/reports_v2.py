#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 3 Week 6: 报表与管理看板 - UI实现
模块: reports_v2.py
功能: 客户欠款明细表、设备换机频率统计、数据导出
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from core.data_manager import DataManager
from core.report_engine import ReportEngine
from theme.colors import DarkTheme


class ReportsV2Frame(ttk.Frame):
    """报表管理主框架
    
    包含:
    - 工具栏：报表选择、日期筛选、刷新、导出
    - 过滤面板：客户名、状态、日期范围
    - 报表区域：Treeview表格展示
    - 状态栏：记录统计信息
    """
    
    def __init__(self, parent, data_manager: DataManager, report_engine: ReportEngine):
        super().__init__(parent)
        self.dm = data_manager
        self.engine = report_engine
        self.current_report_type = "arrears"  # 默认显示欠款报表
        self.current_data = []
        
        # 配置样式
        self.configure(style="Main.TFrame")
        
        # 创建界面
        self._create_widgets()
        
    def _create_widgets(self):
        """创建主界面布局"""
        
        # ── 工具栏 (ToolBar) ──
        toolbar = tk.Frame(self, bg=DarkTheme.BG_SECONDARY, height=56)
        toolbar.pack(fill=tk.X, side=tk.TOP)
        toolbar.pack_propagate(False)
        
        # 工具栏内容
        self._create_toolbar(toolbar)
        
        # ── 过滤面板 (FilterPanel) ──
        filter_panel = tk.Frame(self, bg=DarkTheme.BG_CARD)
        filter_panel.pack(fill=tk.X, padx=12, pady=8)
        
        self._create_filter_panel(filter_panel)
        
        # ── 报表区域 (ReportArea) ──
        report_area = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        report_area.pack(fill=tk.BOTH, expand=True, padx=12, pady=8)
        
        self._create_report_area(report_area)
        
        # ── 状态栏 (StatusBar) ──
        status_bar = tk.Frame(self, bg=DarkTheme.BG_CARD, height=30)
        status_bar.pack(fill=tk.X, side=tk.BOTTOM)
        status_bar.pack_propagate(False)
        
        self.status_label = tk.Label(
            status_bar, 
            text="✓ 就绪",
            font=DarkTheme.FONT_SMALL,
            fg=DarkTheme.TEXT_MUTED,
            bg=DarkTheme.BG_CARD
        )
        self.status_label.pack(side=tk.LEFT, padx=16, pady=4)
    
    def _create_toolbar(self, parent):
        """创建工具栏"""
        # TODO: Day 1 实现
        # - 报表类型选择器 (Combobox)
        # - 日期范围选择 (Entry)
        # - 刷新按钮
        # - 导出按钮
        pass
    
    def _create_filter_panel(self, parent):
        """创建过滤面板"""
        # TODO: Day 1 实现
        # - 客户名称筛选 (Entry + 搜索)
        # - 日期范围 (From - To)
        # - 状态过滤 (Combobox)
        # - 应用/清除按钮
        pass
    
    def _create_report_area(self, parent):
        """创建报表显示区域"""
        # TODO: Day 1 实现
        # - Treeview 表格展示
        # - 分页器 (可选)
        # - 行统计 (显示记录数)
        pass
    
    def load_data(self, report_type: str = "arrears", **filters):
        """加载报表数据
        
        Args:
            report_type: 'arrears' 或 'exchange'
            **filters: 报表特定的过滤条件
        """
        # TODO: 从 ReportEngine 获取数据
        # TODO: 渲染到 Treeview
        pass
    
    def refresh(self):
        """刷新当前报表"""
        # TODO: 重新加载数据
        pass
    
    def export_csv(self):
        """导出当前报表为CSV"""
        # TODO: 调用 ReportEngine 的导出方法
        # TODO: 打开文件保存对话框
        pass


class ArrearsDetailReport:
    """客户欠款明细报表组件
    
    功能:
    - 按客户维度显示欠款信息
    - 支持按客户名称搜索
    - 支持按列排序
    - 双击查看收款历史
    - 导出为CSV
    """
    
    def __init__(self, frame: tk.Frame, engine: ReportEngine):
        self.frame = frame
        self.engine = engine
        self.treeview = None
        self.data = []
        
        # TODO: Day 1-2 实现
        # - 创建 Treeview (9列)
        # - 绑定排序
        # - 绑定双击事件
        # - 高亮逾期合同
        pass
    
    def load_data(self, customer_name: str = None):
        """加载欠款明细数据"""
        # TODO: 调用 engine.get_contract_arrears_detail(customer_name)
        # TODO: 保存到 self.data
        # TODO: 渲染到 Treeview
        pass
    
    def render_table(self, data: List[Dict]):
        """渲染数据到表格"""
        # TODO: 清空现有数据
        # TODO: 插入新数据行
        # TODO: 应用条件格式化（高亮逾期）
        pass
    
    def on_sort_column(self, column: str, reverse: bool = False):
        """按列排序"""
        # TODO: 实现排序逻辑
        # TODO: 更新表格显示
        pass
    
    def on_row_double_click(self, event):
        """双击查看合同收款历史"""
        # TODO: 获取选中行的 contract_id
        # TODO: 调用 engine.get_contract_payment_detail()
        # TODO: 弹出详情窗口
        pass
    
    def export_csv(self) -> str:
        """导出为CSV"""
        # TODO: 调用 engine.export_arrears_to_csv()
        # TODO: 返回 CSV 字符串
        pass


class ExchangeFrequencyReport:
    """设备换机频率统计报表组件
    
    功能:
    - 两种视图：汇总视图、明细视图
    - 汇总视图：按客户统计换机频率
    - 明细视图：换机记录明细
    - 支持多条件筛选（客户、原因、日期）
    - 视图切换
    - 导出为CSV
    """
    
    def __init__(self, frame: tk.Frame, engine: ReportEngine):
        self.frame = frame
        self.engine = engine
        self.view_type = "summary"  # 默认汇总视图
        self.treeview = None
        self.data = []
        
        # TODO: Day 2-3 实现
        # - 创建两种视图的 Treeview
        # - 视图切换逻辑
        # - 数据加载
        pass
    
    def switch_view(self, view_type: str):
        """切换视图类型
        
        Args:
            view_type: 'summary' 或 'detail'
        """
        # TODO: 清空当前视图
        # TODO: 创建新视图
        # TODO: 加载对应数据
        pass
    
    def load_summary(self, start_date: str = None, end_date: str = None):
        """加载汇总视图数据"""
        # TODO: 调用 engine.get_hardware_exchange_summary(start_date, end_date)
        # TODO: 渲染到 Treeview
        pass
    
    def load_detail(self, customer_name: str = None, reason: str = None,
                   start_date: str = None, end_date: str = None):
        """加载明细视图数据"""
        # TODO: 调用 engine.get_hardware_exchange_detail(...)
        # TODO: 渲染到 Treeview
        pass
    
    def render_table(self, data: List[Dict]):
        """渲染数据到表格"""
        # TODO: 清空现有数据
        # TODO: 插入新数据行
        pass
    
    def export_csv(self) -> str:
        """导出为CSV"""
        # TODO: 调用 engine.export_exchange_to_csv(...)
        # TODO: 返回 CSV 字符串
        pass


# ═══════════════════════════════════════════════════════════════
# 辅助类和函数
# ═══════════════════════════════════════════════════════════════

class ReportDialog(tk.Toplevel):
    """通用报表详情弹窗"""
    
    def __init__(self, parent, title: str, data: Dict):
        super().__init__(parent)
        self.title(title)
        self.geometry("600x400")
        # TODO: 显示详情内容
        pass


# ═══════════════════════════════════════════════════════════════
# 导出接口
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # 本地测试（开发用）
    from core.data_manager import DataManager
    from core.report_engine import ReportEngine
    
    root = tk.Tk()
    root.title("报表测试")
    root.geometry("1200x700")
    
    dm = DataManager()
    engine = ReportEngine(dm)
    
    frame = ReportsV2Frame(root, dm, engine)
    frame.pack(fill=tk.BOTH, expand=True)
    
    root.mainloop()
