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
        tk.Label(
            parent,
            text="报表类型:",
            font=DarkTheme.FONT_NORMAL,
            fg=DarkTheme.TEXT_PRIMARY,
            bg=DarkTheme.BG_SECONDARY
        ).pack(side=tk.LEFT, padx=(16, 8), pady=12)
        
        self.report_type_var = tk.StringVar(value="欠款明细报表")
        self.report_type_combo = ttk.Combobox(
            parent,
            textvariable=self.report_type_var,
            values=["欠款明细报表", "设备换机频率统计"],
            state="readonly",
            width=18
        )
        self.report_type_combo.pack(side=tk.LEFT, padx=8, pady=12)
        self.report_type_combo.bind("<<ComboboxSelected>>", self._on_report_type_changed)
        
        ttk.Separator(parent, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=12, pady=8)
        
        tk.Label(
            parent,
            text="日期:",
            font=DarkTheme.FONT_NORMAL,
            fg=DarkTheme.TEXT_PRIMARY,
            bg=DarkTheme.BG_SECONDARY
        ).pack(side=tk.LEFT, padx=(0, 8), pady=12)
        
        self.start_date_var = tk.StringVar()
        self.start_date_entry = tk.Entry(
            parent,
            textvariable=self.start_date_var,
            font=DarkTheme.FONT_NORMAL,
            width=12,
            bg=DarkTheme.BG_INPUT,
            fg=DarkTheme.TEXT_PRIMARY,
            relief=tk.FLAT
        )
        self.start_date_entry.pack(side=tk.LEFT, padx=4, pady=12)
        
        tk.Label(
            parent,
            text="至",
            font=DarkTheme.FONT_NORMAL,
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_SECONDARY
        ).pack(side=tk.LEFT, padx=4, pady=12)
        
        self.end_date_var = tk.StringVar()
        self.end_date_entry = tk.Entry(
            parent,
            textvariable=self.end_date_var,
            font=DarkTheme.FONT_NORMAL,
            width=12,
            bg=DarkTheme.BG_INPUT,
            fg=DarkTheme.TEXT_PRIMARY,
            relief=tk.FLAT
        )
        self.end_date_entry.pack(side=tk.LEFT, padx=4, pady=12)
        
        ttk.Separator(parent, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=12, pady=8)
        
        self.refresh_btn = tk.Button(
            parent,
            text="刷新",
            font=DarkTheme.FONT_BUTTON,
            fg="white",
            bg=DarkTheme.ACCENT_PRIMARY,
            activebackground=DarkTheme.darken(DarkTheme.ACCENT_PRIMARY),
            activeforeground="white",
            relief=tk.FLAT,
            bd=0,
            padx=16,
            pady=8,
            command=self.refresh
        )
        self.refresh_btn.pack(side=tk.LEFT, padx=6, pady=10)
        
        self.export_btn = tk.Button(
            parent,
            text="导出CSV",
            font=DarkTheme.FONT_BUTTON,
            fg=DarkTheme.TEXT_PRIMARY,
            bg=DarkTheme.BG_CARD,
            activebackground=DarkTheme.BG_HOVER,
            activeforeground=DarkTheme.TEXT_PRIMARY,
            relief=tk.FLAT,
            bd=0,
            padx=16,
            pady=8,
            command=self.export_csv
        )
        self.export_btn.pack(side=tk.LEFT, padx=6, pady=10)
        DarkTheme.bind_hover(self.export_btn, DarkTheme.BG_CARD, DarkTheme.BG_HOVER)
    
    def _create_filter_panel(self, parent):
        """创建过滤面板"""
        tk.Label(
            parent,
            text="客户名称:",
            font=DarkTheme.FONT_NORMAL,
            fg=DarkTheme.TEXT_PRIMARY,
            bg=DarkTheme.BG_CARD
        ).pack(side=tk.LEFT, padx=(16, 8), pady=12)
        
        self.customer_filter_var = tk.StringVar()
        self.customer_filter_entry = tk.Entry(
            parent,
            textvariable=self.customer_filter_var,
            font=DarkTheme.FONT_NORMAL,
            width=24,
            bg=DarkTheme.BG_INPUT,
            fg=DarkTheme.TEXT_PRIMARY,
            relief=tk.FLAT
        )
        self.customer_filter_entry.pack(side=tk.LEFT, padx=4, pady=12)
        self.customer_filter_entry.bind("<Return>", lambda event: self._apply_filters())
        
        self.apply_filter_btn = tk.Button(
            parent,
            text="应用筛选",
            font=DarkTheme.FONT_BUTTON,
            fg="white",
            bg=DarkTheme.ACCENT_SECONDARY,
            activebackground=DarkTheme.darken(DarkTheme.ACCENT_SECONDARY),
            activeforeground="white",
            relief=tk.FLAT,
            bd=0,
            padx=12,
            pady=6,
            command=self._apply_filters
        )
        self.apply_filter_btn.pack(side=tk.LEFT, padx=6, pady=10)
        
        self.clear_filter_btn = tk.Button(
            parent,
            text="清除筛选",
            font=DarkTheme.FONT_BUTTON,
            fg=DarkTheme.TEXT_PRIMARY,
            bg=DarkTheme.BG_SECONDARY,
            activebackground=DarkTheme.BG_HOVER,
            activeforeground=DarkTheme.TEXT_PRIMARY,
            relief=tk.FLAT,
            bd=0,
            padx=12,
            pady=6,
            command=self._clear_filters
        )
        self.clear_filter_btn.pack(side=tk.LEFT, padx=6, pady=10)
        DarkTheme.bind_hover(self.clear_filter_btn, DarkTheme.BG_SECONDARY, DarkTheme.BG_HOVER)
    
    def _create_report_area(self, parent):
        """创建报表显示区域"""
        self.report_header = tk.Label(
            parent,
            text="欠款明细报表",
            font=DarkTheme.FONT_SUBTITLE,
            fg=DarkTheme.TEXT_PRIMARY,
            bg=DarkTheme.BG_PRIMARY
        )
        self.report_header.pack(anchor=tk.W, pady=(0, 8))
        
        table_container = tk.Frame(parent, bg=DarkTheme.BG_CARD)
        table_container.pack(fill=tk.BOTH, expand=True)
        
        self.treeview = ttk.Treeview(table_container, show="headings", height=20)
        self.treeview.grid(row=0, column=0, sticky="nsew")
        
        y_scroll = ttk.Scrollbar(table_container, orient=tk.VERTICAL, command=self.treeview.yview)
        y_scroll.grid(row=0, column=1, sticky="ns")
        self.treeview.configure(yscrollcommand=y_scroll.set)
        
        x_scroll = ttk.Scrollbar(table_container, orient=tk.HORIZONTAL, command=self.treeview.xview)
        x_scroll.grid(row=1, column=0, sticky="ew")
        self.treeview.configure(xscrollcommand=x_scroll.set)
        
        table_container.grid_rowconfigure(0, weight=1)
        table_container.grid_columnconfigure(0, weight=1)
        
        self.record_count_label = tk.Label(
            parent,
            text="共 0 条记录",
            font=DarkTheme.FONT_SMALL,
            fg=DarkTheme.TEXT_MUTED,
            bg=DarkTheme.BG_PRIMARY
        )
        self.record_count_label.pack(anchor=tk.W, pady=(6, 0))
        
        self._configure_tree_columns("arrears")
    
    def load_data(self, report_type: str = "arrears", **filters):
        """加载报表数据
        
        Args:
            report_type: 'arrears' 或 'exchange'
            **filters: 报表特定的过滤条件
        """
        try:
            self._update_status("正在加载数据...")
            self.current_report_type = report_type
            self._configure_tree_columns(report_type)
            self.treeview.delete(*self.treeview.get_children())
            
            if report_type == "arrears":
                customer_name = filters.get("customer_name")
                self.current_data = self.engine.get_contract_arrears_detail(customer_name)
                for row in self.current_data:
                    overdue_days = row.get("overdue_days", 0) or 0
                    values = (
                        row.get("contract_id", ""),
                        row.get("customer_name", ""),
                        self._format_money(row.get("total_rent", 0)),
                        self._format_money(row.get("paid_amount", 0)),
                        self._format_money(row.get("unpaid_amount", 0)),
                        overdue_days,
                        "逾期" if overdue_days > 0 else "正常",
                        row.get("sign_date", ""),
                        row.get("notes", "")
                    )
                    tag = "overdue" if overdue_days > 0 else "normal"
                    self.treeview.insert("", tk.END, values=values, tags=(tag,))
            else:
                start_date = filters.get("start_date")
                end_date = filters.get("end_date")
                self.current_data = self.engine.get_hardware_exchange_summary(start_date, end_date)
                for row in self.current_data:
                    values = (
                        row.get("customer_name", ""),
                        row.get("exchange_count", 0),
                        row.get("exchange_days", row.get("avg_period", "")),
                        row.get("last_exchange_date", ""),
                        row.get("fault_count", row.get("fault_rate", 0)),
                        row.get("upgrade_count", row.get("upgrade_rate", 0)),
                        row.get("risk_level", "正常"),
                        row.get("contact", "")
                    )
                    tag = "high_risk" if "高" in str(row.get("risk_level", "")) else "normal"
                    self.treeview.insert("", tk.END, values=values, tags=(tag,))
            
            count = len(self.current_data)
            self.record_count_label.configure(text=f"共 {count} 条记录")
            self._update_status(f"已加载 {count} 条记录")
        except Exception as exc:
            messagebox.showerror("数据加载失败", f"加载数据时出错:\n{exc}")
            self._update_status("加载失败")
    
    def refresh(self):
        """刷新当前报表"""
        self._apply_filters()
    
    def export_csv(self):
        """导出当前报表为CSV"""
        try:
            if not self.current_data:
                messagebox.showwarning("无数据导出", "请先加载报表数据")
                return
            
            filename = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
            )
            if not filename:
                return
            
            if self.current_report_type == "arrears":
                csv_content = self.engine.export_arrears_to_csv()
            else:
                csv_content = self.engine.export_exchange_to_csv()
            
            with open(filename, "w", encoding="utf-8-sig") as file:
                file.write(csv_content)
            
            messagebox.showinfo("导出成功", f"已导出到:\n{filename}")
            self._update_status("导出成功")
        except Exception as exc:
            messagebox.showerror("导出失败", f"导出时出错:\n{exc}")
            self._update_status("导出失败")

    def _configure_tree_columns(self, report_type: str):
        """配置Treeview列定义"""
        if report_type == "arrears":
            columns = ("contract_id", "customer_name", "total_rent", "paid_amount",
                       "unpaid_amount", "overdue_days", "status", "sign_date", "notes")
            headings = ("合同编号", "客户名称", "应收总额", "已收金额",
                        "未收金额", "逾期天数", "状态", "签订日期", "备注")
            widths = (100, 150, 100, 100, 100, 80, 80, 110, 160)
        else:
            columns = ("customer_name", "exchange_count", "exchange_days", "last_exchange_date",
                       "fault_count", "upgrade_count", "risk_level", "contact")
            headings = ("客户名称", "换机次数", "换机天数", "最近换机日期",
                        "故障次数", "升级次数", "风险等级", "联系方式")
            widths = (150, 90, 90, 120, 90, 90, 90, 140)
        
        self.treeview.configure(columns=columns)
        for column, heading, width in zip(columns, headings, widths):
            self.treeview.heading(column, text=heading, command=lambda col=column: self._sort_column(col))
            self.treeview.column(column, width=width, minwidth=70, anchor=tk.CENTER)
        
        self.treeview.tag_configure("overdue", foreground=DarkTheme.ACCENT_RED)
        self.treeview.tag_configure("high_risk", foreground=DarkTheme.ACCENT_RED)
        self.treeview.tag_configure("normal", foreground=DarkTheme.TEXT_PRIMARY)

    def _on_report_type_changed(self, event=None):
        """处理报表类型切换"""
        report_name = self.report_type_var.get()
        self.current_report_type = "arrears" if report_name == "欠款明细报表" else "exchange"
        self.report_header.configure(text=report_name)
        self.load_data(self.current_report_type)

    def _apply_filters(self):
        """应用筛选条件"""
        filters = {}
        customer_name = self.customer_filter_var.get().strip()
        start_date = self.start_date_var.get().strip()
        end_date = self.end_date_var.get().strip()
        
        if customer_name:
            filters["customer_name"] = customer_name
        if start_date:
            filters["start_date"] = start_date
        if end_date:
            filters["end_date"] = end_date
        
        self.load_data(self.current_report_type, **filters)

    def _clear_filters(self):
        """清除筛选条件"""
        self.customer_filter_var.set("")
        self.start_date_var.set("")
        self.end_date_var.set("")
        self.load_data(self.current_report_type)

    def _sort_column(self, column: str, reverse: bool = False):
        """按列排序"""
        items = [(self.treeview.set(item, column), item) for item in self.treeview.get_children("")]
        items.sort(reverse=reverse)
        for index, (_, item) in enumerate(items):
            self.treeview.move(item, "", index)
        self.treeview.heading(column, command=lambda: self._sort_column(column, not reverse))

    def _update_status(self, message: str):
        """更新状态栏"""
        self.status_label.configure(text=f"✓ {message}")

    @staticmethod
    def _format_money(value) -> str:
        """格式化金额"""
        try:
            return f"{float(value or 0):,.2f}"
        except (TypeError, ValueError):
            return "0.00"


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
