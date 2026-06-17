"""
Phase 3 Week 7 - Dashboard UI Module
管理看板UI实现 - 8个KPI卡片展示

Classes:
    DashboardV2Frame: 主框架，包含工具栏、KPI卡片、刷新机制
    KpiCard: 单个KPI卡片组件，展示数值、趋势、单位
    
Features:
    - 8个核心KPI卡片：月度收入、年度收入、活跃合同、未收总额、逾期合同、收款率、换机次数、高风险客户
    - 自动刷新机制 (Timer)
    - 数据缓存策略
    - 异步数据加载
    - 错误处理和加载状态
    - DarkTheme样式集成
    
Author: Oz
Date: 2026-06-23
Status: Week 7 Development
"""

import tkinter as tk
from tkinter import ttk, messagebox
from typing import Dict, Optional, Any, Callable
from datetime import datetime
import threading


class KpiCard(tk.Frame):
    \"\"\"单个KPI卡片组件
    
    展示一个KPI的数值、趋势、单位。支持点击事件。
    \"\"\"
    
    def __init__(self, parent, title: str, unit: str = '', width: int = 200, height: int = 120):
        \"\"\"初始化KPI卡片
        
        Args:
            parent: 父容器
            title: KPI标题
            unit: 单位 (例如: '元', '%', '个')
            width: 卡片宽度 (px)
            height: 卡片高度 (px)
        \"\"\"
        super().__init__(parent)
        self.title = title
        self.unit = unit
        self.value = 0
        self.trend = None  # 'up', 'down', 'flat'
        self.on_click = None
        
        # TODO: Day 1 - 设计卡片UI
        # - Frame背景色、圆角
        # - Title标签
        # - Value标签（大号）
        # - Unit标签
        # - Trend箭头（↑ ↓ →）
        # - 绑定点击事件
        # - 样式美观、响应式
        
    def set_value(self, value: Any, trend: Optional[str] = None):
        \"\"\"更新KPI数值
        
        Args:
            value: KPI数值
            trend: 趋势 ('up', 'down', 'flat')
        \"\"\"
        # TODO: Day 2 - 实现数值更新
        self.value = value
        self.trend = trend
        self._update_display()
    
    def set_loading(self, is_loading: bool = True):
        \"\"\"设置加载状态\"\"\"
        # TODO: Day 2 - 实现加载状态显示
        pass
    
    def set_error(self, error_msg: str):
        \"\"\"设置错误状态\"\"\"
        # TODO: Day 2 - 实现错误显示
        pass
    
    def _update_display(self):
        \"\"\"更新显示\"\"\"
        # TODO: Day 1 - 实现显示更新逻辑
        pass
    
    def bind_click(self, callback: Callable):
        \"\"\"绑定点击事件\"\"\"
        self.on_click = callback


class DashboardV2Frame(tk.Frame):
    \"\"\"管理看板主框架
    
    包含8个KPI卡片、工具栏、刷新机制。
    整合ReportEngine数据，提供实时KPI展示。
    \"\"\"
    
    def __init__(self, parent, report_engine=None):
        \"\"\"初始化Dashboard框架
        
        Args:
            parent: 父容器
            report_engine: ReportEngine实例（来自core.report_engine）
        \"\"\"
        super().__init__(parent)
        self.report_engine = report_engine
        self.kpi_cards = {}
        self.refresh_interval = 30000  # 30秒 (ms)
        self.auto_refresh = True
        self.data_cache = {}
        self.is_loading = False
        
        # TODO: Day 1 - 创建主框架结构
        # - 创建工具栏
        # - 创建KPI卡片网格
        # - 创建状态栏
        # - 设置布局
        
        self._create_toolbar()
        self._create_kpi_grid()
        self._create_statusbar()
        self._setup_refresh_timer()
    
    def _create_toolbar(self):
        \"\"\"创建工具栏
        
        包含：刷新按钮、自动刷新开关、时间范围选择、导出按钮
        \"\"\"
        # TODO: Day 1 - 实现工具栏
        toolbar = ttk.Frame(self)
        toolbar.pack(fill='x', padx=5, pady=5)
        
        # TODO: 刷新按钮
        # TODO: 自动刷新开关
        # TODO: 时间范围选择
        # TODO: 导出按钮
    
    def _create_kpi_grid(self):
        \"\"\"创建KPI卡片网格
        
        布局: 2行4列或4行2列
        KPIs:
            1. 本月收入
            2. 年度收入
            3. 活跃合同数
            4. 未收总额
            5. 逾期合同数
            6. 收款率
            7. 本月换机次数
            8. 高风险客户数
        \"\"\"
        # TODO: Day 1 - 创建KPI卡片
        grid_frame = ttk.Frame(self)
        grid_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # 定义8个KPI
        kpis = [
            ('月度收入', '元'),
            ('年度收入', '元'),
            ('活跃合同', '个'),
            ('未收总额', '元'),
            ('逾期合同', '个'),
            ('收款率', '%'),
            ('换机次数', '次'),
            ('高风险客户', '个'),
        ]
        
        # TODO: 使用Grid布局创建卡片
        for i, (title, unit) in enumerate(kpis):
            card = KpiCard(grid_frame, title, unit)
            self.kpi_cards[title] = card
            # TODO: 计算行列位置并pack/grid
    
    def _create_statusbar(self):
        \"\"\"创建状态栏
        
        显示最后刷新时间、加载状态
        \"\"\"
        # TODO: Day 1 - 实现状态栏
        statusbar = ttk.Frame(self)
        statusbar.pack(fill='x', side='bottom', padx=5, pady=5)
        
        # TODO: 状态标签（刷新时间）
        # TODO: 加载指示符
    
    def _setup_refresh_timer(self):
        \"\"\"设置自动刷新定时器\"\"\"
        # TODO: Day 2 - 实现定时刷新
        # - 使用after()方法
        # - 支持启用/禁用
        # - 避免重复加载
        pass
    
    def load_data(self):
        \"\"\"加载所有KPI数据\"\"\"
        # TODO: Day 2 - 实现数据加载
        if self.is_loading:
            return
        
        self.is_loading = True
        # TODO: 显示加载状态
        
        # 使用线程避免UI阻塞
        threading.Thread(target=self._load_data_async, daemon=True).start()
    
    def _load_data_async(self):
        \"\"\"异步加载数据\"\"\"
        # TODO: Day 2 - 实现异步加载逻辑
        try:
            # TODO: 从ReportEngine获取数据
            # - self.report_engine.get_dashboard_metrics()
            # - 或调用各个KPI的获取方法
            
            # TODO: 更新缓存
            # TODO: 更新UI
            # TODO: 更新刷新时间
            
            self.is_loading = False
        except Exception as e:
            # TODO: 显示错误信息
            self.is_loading = False
            messagebox.showerror('数据加载失败', str(e))
    
    def refresh(self):
        \"\"\"手动刷新数据\"\"\"
        self.load_data()
    
    def set_auto_refresh(self, enabled: bool):
        \"\"\"启用/禁用自动刷新
        
        Args:
            enabled: True 启用，False 禁用
        \"\"\"
        # TODO: Day 2 - 实现自动刷新控制
        self.auto_refresh = enabled
    
    def _get_monthly_revenue(self) -> float:
        \"\"\"获取本月收入\"\"\"
        # TODO: Day 2 - 调用ReportEngine
        # return self.report_engine.get_monthly_revenue()
        pass
    
    def _get_annual_revenue(self) -> float:
        \"\"\"获取年度收入\"\"\"
        # TODO: Day 2
        pass
    
    def _get_active_contracts(self) -> int:
        \"\"\"获取活跃合同数\"\"\"
        # TODO: Day 2
        pass
    
    def _get_unpaid_amount(self) -> float:
        \"\"\"获取未收总额\"\"\"
        # TODO: Day 2
        pass
    
    def _get_overdue_contracts(self) -> int:
        \"\"\"获取逾期合同数\"\"\"
        # TODO: Day 2
        pass
    
    def _get_payment_rate(self) -> float:
        \"\"\"获取收款率 (%)\"\"\"
        # TODO: Day 2
        pass
    
    def _get_monthly_exchanges(self) -> int:
        \"\"\"获取本月换机次数\"\"\"
        # TODO: Day 2
        pass
    
    def _get_high_risk_customers(self) -> int:
        \"\"\"获取高风险客户数\"\"\"
        # TODO: Day 2
        pass
    
    def _format_currency(self, value: float, decimals: int = 0) -> str:
        \"\"\"格式化货币值
        
        Args:
            value: 数值
            decimals: 小数位数
            
        Returns:
            格式化后的字符串，包含千位分隔符
        \"\"\"
        # TODO: Day 2 - 实现格式化
        return f\"{value:,.{decimals}f}\"
    
    def _calculate_trend(self, current: float, previous: float) -> str:
        \"\"\"计算趋势\"\"\"
        # TODO: Day 3 - 实现趋势计算
        if current > previous:
            return 'up'
        elif current < previous:
            return 'down'
        else:
            return 'flat'


# TODO: Week 7 Day 1-2
# [ ] DashboardV2Frame 框架完成
# [ ] KpiCard 卡片实现
# [ ] 8个KPI卡片布局
# [ ] 数据加载和刷新机制
# [ ] 自动刷新定时器

# TODO: Week 7 Day 3
# [ ] 趋势计算和显示
# [ ] 钻取功能（链接到详细报表）
# [ ] 交互反馈

# TODO: Week 7 Day 4-5
# [ ] 测试套件创建
# [ ] 性能优化
# [ ] 文档编写
"