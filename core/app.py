#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
应用主窗口
管理导航和模块切换
"""

import tkinter as tk
from tkinter import ttk, messagebox
from theme.colors import DarkTheme
from core.data_manager import DataManager
from core.report_engine import ReportEngine
from modules.dashboard import DashboardFrame
from modules.dashboard_v2 import DashboardV2Frame
from modules.rental_mgmt import RentalManagementFrame
from modules.rental_mgmt_v2_integration import RentalContractsV2Frame
from modules.due_reminder import DueReminderFrame
from modules.hardware_brands_ui import HardwareBrandFrame
from modules.reports_v2 import ReportsV2Frame
from modules.user_mgmt import UserManagementFrame


class MainWindow:
    """主应用窗口"""

    def __init__(self, username: str, data_manager: DataManager, root: tk.Tk = None, content_frame: tk.Frame = None):
        self.username = username
        self.current_module = None
        self.data_manager = data_manager
        self.report_engine = ReportEngine(data_manager)
        self.navigation_history = []
        self.data_manager.check_overdue()

        # 支持传入已有根窗口或内容框架，避免多窗口闪烁
        if content_frame is not None:
            # 使用传入的容器框架（单根窗口模式）
            self.root = root
            self.content_frame = content_frame
            self.content_frame.configure(bg=DarkTheme.BG_PRIMARY)
            self._setup_styles()
            self._create_layout_in_container()
        else:
            # 创建独立根窗口（兼容旧版）
            self.root = root if root else tk.Tk()
            self.root.title("速维电脑租赁管理系统 V2")
            self.root.geometry("1280x760")
            self.root.minsize(1024, 640)
            self.root.configure(bg=DarkTheme.BG_PRIMARY)
            self._setup_styles()
            self._create_layout()
    
    def _setup_styles(self):
        """配置 ttk 样式 — 暖金主题"""
        style = ttk.Style()
        style.theme_use('clam')
        accent = DarkTheme.ACCENT_PRIMARY

        style.configure("Sidebar.TFrame", background=DarkTheme.BG_SECONDARY)
        style.configure("Main.TFrame", background=DarkTheme.BG_PRIMARY)
        style.configure(
            "Nav.TButton",
            font=DarkTheme.FONT_LABEL,
            background=DarkTheme.BG_SECONDARY,
            foreground=DarkTheme.TEXT_SECONDARY,
            borderwidth=0,
            focuscolor="none",
            padding=(18, 14),
        )
        style.configure("Nav.Active.TButton", background=accent, foreground="white")
        style.map("Nav.TButton",
                  background=[("active", DarkTheme.BG_HOVER)],
                  foreground=[("active", DarkTheme.TEXT_PRIMARY)])

        style.configure("Content.TFrame", background=DarkTheme.BG_PRIMARY)
        style.configure("Card.TFrame", background=DarkTheme.BG_CARD, relief=tk.FLAT)
        style.configure("Primary.TButton",
                       background=accent, foreground="white", font=DarkTheme.FONT_BUTTON)
        style.map("Primary.TButton", background=[("active", DarkTheme.darken(accent, 10))])

        style.configure("Treeview",
                       background=DarkTheme.BG_INPUT,
                       foreground=DarkTheme.TEXT_PRIMARY,
                       fieldbackground=DarkTheme.BG_INPUT,
                       borderwidth=0, font=DarkTheme.FONT_NORMAL)
        style.configure("Treeview.Heading",
                       background=DarkTheme.BG_TERTIARY,
                       foreground=DarkTheme.TEXT_SECONDARY,
                       font=DarkTheme.FONT_BUTTON, borderwidth=0)
        style.map("Treeview.Heading", background=[("active", DarkTheme.BG_HOVER)])

        style.configure("TEntry",
                       fieldbackground=DarkTheme.BG_INPUT,
                       foreground=DarkTheme.TEXT_PRIMARY,
                       bordercolor=DarkTheme.BORDER_COLOR,
                       lightcolor=DarkTheme.BORDER_COLOR,
                       darkcolor=DarkTheme.BORDER_COLOR)
        style.configure("TCombobox",
                       fieldbackground=DarkTheme.BG_INPUT,
                       foreground=DarkTheme.TEXT_PRIMARY,
                       bordercolor=DarkTheme.BORDER_COLOR)
        style.configure("TNotebook", background=DarkTheme.BG_PRIMARY, borderwidth=0)
        style.configure("TNotebook.Tab",
                       background=DarkTheme.BG_CARD, foreground=DarkTheme.TEXT_PRIMARY,
                       font=DarkTheme.FONT_LABEL, padding=[14, 8])
        style.map("TNotebook.Tab",
                  background=[("selected", accent)],
                  foreground=[("selected", "white")])
    
    def _create_layout(self):
        """创建主布局 — 宽侧栏 + 顶部品牌栏"""
        # ── 顶部品牌栏 ──
        top_bar = tk.Frame(self.root, bg=DarkTheme.BG_SECONDARY, height=56)
        top_bar.pack(fill=tk.X, side=tk.TOP)
        top_bar.pack_propagate(False)

        tk.Label(top_bar, text="速维", font=("微软雅黑", 17, "bold"),
                 fg=DarkTheme.ACCENT_PRIMARY, bg=DarkTheme.BG_SECONDARY).pack(
            side=tk.LEFT, padx=(22, 2))
        tk.Label(top_bar, text="电脑租赁管理系统", font=("微软雅黑", 13),
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_SECONDARY).pack(
            side=tk.LEFT)

        tk.Label(top_bar, text=f"👤  {self.username}", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_SECONDARY).pack(
            side=tk.RIGHT, padx=22)

        # ── 主容器 ──
        main_container = tk.Frame(self.root, bg=DarkTheme.BG_PRIMARY)
        main_container.pack(fill=tk.BOTH, expand=True)

        # ── 侧边栏 (240px) ──
        sidebar = tk.Frame(main_container, bg=DarkTheme.BG_SECONDARY, width=240)
        sidebar.pack(side=tk.LEFT, fill=tk.Y)
        sidebar.pack_propagate(False)

        # 导航标题
        nav_hd = tk.Frame(sidebar, bg=DarkTheme.BG_SECONDARY, height=72)
        nav_hd.pack(fill=tk.X)
        nav_hd.pack_propagate(False)
        tk.Label(nav_hd, text="导 航", font=("微软雅黑", 13, "bold"),
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_SECONDARY).pack(
            side=tk.LEFT, padx=18, pady=24)

        # 分隔
        tk.Frame(sidebar, bg=DarkTheme.BORDER_COLOR, height=1).pack(fill=tk.X, padx=14)

        # 导航项
        self.nav_buttons = {}
        nav_items = [
            ("📊  仪表板",        "dashboard"),
            ("📈  管理看板(v2)",  "dashboard_v2"),
            ("📑  报表中心(v2)",  "reports_v2"),
            ("📋  租赁管理",      "rental"),
            ("📄  新版合同(v2)",  "rental_v2"),
            ("⏰  到期提醒",      "reminder"),
            ("💻  硬件品牌库",    "hardware_brands"),
            ("👥  用户管理",      "user_mgmt"),
        ]
        for text, key in nav_items:
            btn = ttk.Button(sidebar, text=text, style="Nav.TButton",
                           command=lambda k=key: self._switch_module(k))
            btn.pack(fill=tk.X, padx=10, pady=3)
            self.nav_buttons[key] = btn

        # 底部空间 + 退出
        tk.Frame(sidebar, bg=DarkTheme.BG_SECONDARY).pack(fill=tk.X, expand=True)
        tk.Frame(sidebar, bg=DarkTheme.BORDER_COLOR, height=1).pack(fill=tk.X, padx=14)

        logout_btn = tk.Button(sidebar, text="退 出 系 统", font=DarkTheme.FONT_BUTTON,
                              fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_SECONDARY,
                              relief=tk.FLAT, cursor="hand2", command=self._handle_logout)
        logout_btn.pack(fill=tk.X, padx=10, pady=(4, 16), ipady=6)
        DarkTheme.bind_hover(logout_btn, DarkTheme.BG_SECONDARY, DarkTheme.ACCENT_RED)

        # ── 内容区 ──
        self.content_frame = tk.Frame(main_container, bg=DarkTheme.BG_PRIMARY)
        self.content_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # ── 状态栏 ──
        self.status_bar = tk.Frame(self.root, bg=DarkTheme.BG_CARD, height=30)
        self.status_bar.pack(fill=tk.X, side=tk.BOTTOM)
        self.status_bar.pack_propagate(False)
        self.status_label = tk.Label(self.status_bar, text="✓ 系统就绪",
                                     font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                                     bg=DarkTheme.BG_CARD)
        self.status_label.pack(side=tk.LEFT, padx=16, pady=4)

        self.key_hint_label = tk.Label(self.status_bar, text="F5 刷新  ·  Ctrl+F 搜索",
                                       font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                                       bg=DarkTheme.BG_CARD)
        self.key_hint_label.pack(side=tk.RIGHT, padx=16, pady=4)

        # 快捷键
        self.root.bind("<F5>", lambda e: self._refresh_current())
        self.root.bind("<Control-f>", lambda e: self._focus_search())

        self._switch_module("dashboard")

    def _create_layout_in_container(self):
        """在传入的容器中创建布局（单根窗口模式）"""
        self._setup_styles()
        # ── 顶部品牌栏 ──
        top_bar = tk.Frame(self.content_frame, bg=DarkTheme.BG_SECONDARY, height=56)
        top_bar.pack(fill=tk.X, side=tk.TOP)
        top_bar.pack_propagate(False)

        tk.Label(top_bar, text="速维", font=("微软雅黑", 17, "bold"),
                 fg=DarkTheme.ACCENT_PRIMARY, bg=DarkTheme.BG_SECONDARY).pack(
            side=tk.LEFT, padx=(22, 2))
        tk.Label(top_bar, text="电脑租赁管理系统", font=("微软雅黑", 13),
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_SECONDARY).pack(
            side=tk.LEFT)

        tk.Label(top_bar, text=f"👤  {self.username}", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_SECONDARY).pack(
            side=tk.RIGHT, padx=22)

        # ── 主容器 ──
        main_container = tk.Frame(self.content_frame, bg=DarkTheme.BG_PRIMARY)
        main_container.pack(fill=tk.BOTH, expand=True)

        # ── 侧边栏 (240px) ──
        sidebar = tk.Frame(main_container, bg=DarkTheme.BG_SECONDARY, width=240)
        sidebar.pack(side=tk.LEFT, fill=tk.Y)
        sidebar.pack_propagate(False)

        nav_hd = tk.Frame(sidebar, bg=DarkTheme.BG_SECONDARY, height=72)
        nav_hd.pack(fill=tk.X)
        nav_hd.pack_propagate(False)
        tk.Label(nav_hd, text="导 航", font=("微软雅黑", 13, "bold"),
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_SECONDARY).pack(
            side=tk.LEFT, padx=18, pady=24)

        tk.Frame(sidebar, bg=DarkTheme.BORDER_COLOR, height=1).pack(fill=tk.X, padx=14)

        self.nav_buttons = {}
        nav_items = [
            ("📊  仪表板",        "dashboard"),
            ("📈  管理看板(v2)",  "dashboard_v2"),
            ("📑  报表中心(v2)",  "reports_v2"),
            ("📋  租赁管理",      "rental"),
            ("📄  新版合同(v2)",  "rental_v2"),
            ("⏰  到期提醒",      "reminder"),
            ("💻  硬件品牌库",    "hardware_brands"),
            ("👥  用户管理",      "user_mgmt"),
        ]
        for text, key in nav_items:
            btn = ttk.Button(sidebar, text=text, style="Nav.TButton",
                           command=lambda k=key: self._switch_module(k))
            btn.pack(fill=tk.X, padx=10, pady=3)
            self.nav_buttons[key] = btn

        tk.Frame(sidebar, bg=DarkTheme.BG_SECONDARY).pack(fill=tk.X, expand=True)
        tk.Frame(sidebar, bg=DarkTheme.BORDER_COLOR, height=1).pack(fill=tk.X, padx=14)

        logout_btn = tk.Button(sidebar, text="退 出 系 统", font=DarkTheme.FONT_BUTTON,
                              fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_SECONDARY,
                              relief=tk.FLAT, cursor="hand2", command=self._handle_logout)
        logout_btn.pack(fill=tk.X, padx=10, pady=(4, 16), ipady=6)
        DarkTheme.bind_hover(logout_btn, DarkTheme.BG_SECONDARY, DarkTheme.ACCENT_RED)

        # ── 内容区 ──
        self.content_area = tk.Frame(main_container, bg=DarkTheme.BG_PRIMARY)
        self.content_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # ── 状态栏 ──
        self.status_bar = tk.Frame(self.root, bg=DarkTheme.BG_CARD, height=30)
        self.status_bar.pack(fill=tk.X, side=tk.BOTTOM)
        self.status_bar.pack_propagate(False)
        self.status_label = tk.Label(self.status_bar, text="✓ 系统就绪",
                                     font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                                     bg=DarkTheme.BG_CARD)
        self.status_label.pack(side=tk.LEFT, padx=16, pady=4)

        self.key_hint_label = tk.Label(self.status_bar, text="F5 刷新  ·  Ctrl+F 搜索",
                                       font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                                       bg=DarkTheme.BG_CARD)
        self.key_hint_label.pack(side=tk.RIGHT, padx=16, pady=4)

        self.root.bind("<F5>", lambda e: self._refresh_current())
        self.root.bind("<Control-f>", lambda e: self._focus_search())

        self._switch_module("dashboard")

    def _switch_module(self, module_key: str):
        """切换模块"""
        # 确定内容区域（兼容单根窗口模式）
        target_frame = getattr(self, 'content_area', self.content_frame)
        
        # 清除当前内容
        for widget in target_frame.winfo_children():
            widget.destroy()
        
        # 更新导航按钮样式
        for key, btn in self.nav_buttons.items():
            if key == module_key:
                btn.configure(style="Nav.Active.TButton")
            else:
                btn.configure(style="Nav.TButton")
        
        # 加载新模块
        if module_key == "dashboard":
            self.current_module = DashboardFrame(target_frame, self.data_manager)
        elif module_key == "dashboard_v2":
            self.current_module = DashboardV2Frame(target_frame, self.report_engine)
            if hasattr(self.current_module, "set_drill_down_callback"):
                self.current_module.set_drill_down_callback(self._on_kpi_drill_down)
            elif hasattr(self.current_module, "drill_down_callback"):
                self.current_module.drill_down_callback = self._on_kpi_drill_down
        elif module_key == "reports_v2":
            self.current_module = ReportsV2Frame(target_frame, self.data_manager, self.report_engine)
            if hasattr(self.current_module, "load_data"):
                self.current_module.load_data()
        elif module_key == "rental":
            self.current_module = RentalManagementFrame(target_frame, self)
        elif module_key == "rental_v2":
            self.current_module = RentalContractsV2Frame(target_frame, self)
        elif module_key == "reminder":
            self.current_module = DueReminderFrame(target_frame, self.data_manager)
        elif module_key == "hardware_brands":
            self.current_module = HardwareBrandFrame(target_frame, self.data_manager)
        elif module_key == "user_mgmt":
            user_role = self._get_user_role()
            self.current_module = UserManagementFrame(target_frame, self.data_manager, user_role)

        self.current_module.pack(fill=tk.BOTH, expand=True)

    def _on_kpi_drill_down(self, kpi_key: str, drill_params: dict = None):
        """处理管理看板 KPI 下钻导航。"""
        drill_params = drill_params or {}
        current_key = self._get_current_module_key()
        if current_key:
            self.navigation_history.append(current_key)

        report_kpis = {
            "monthly_revenue",
            "annual_revenue",
            "unpaid_amount",
            "overdue_contracts",
            "payment_rate",
            "monthly_exchanges",
            "high_risk_customers",
        }

        if kpi_key in report_kpis:
            self._switch_module("reports_v2")
            self._apply_report_drill_down(kpi_key, drill_params)
        elif kpi_key == "active_contracts":
            self._switch_module("rental_v2")
        else:
            self.status_label.config(text=f"✓ 已下钻：{kpi_key}")

    def _apply_report_drill_down(self, kpi_key: str, drill_params: dict):
        """根据 KPI 类型应用报表下钻筛选。"""
        if not isinstance(self.current_module, ReportsV2Frame):
            return

        exchange_kpis = {"monthly_exchanges", "high_risk_customers"}
        report_type = "exchange" if kpi_key in exchange_kpis else "arrears"

        filters = {}
        filter_data = drill_params.get("filter_data", {})
        if isinstance(filter_data, dict):
            filters.update(filter_data)

        if report_type == "exchange" and hasattr(self.current_module, "report_type_var"):
            self.current_module.report_type_var.set("设备换机频率统计")
            if hasattr(self.current_module, "report_header"):
                self.current_module.report_header.configure(text="设备换机频率统计")
        elif hasattr(self.current_module, "report_type_var"):
            self.current_module.report_type_var.set("欠款明细报表")
            if hasattr(self.current_module, "report_header"):
                self.current_module.report_header.configure(text="欠款明细报表")

        self.current_module.load_data(report_type, **filters)
        self.status_label.config(text=f"✓ 已打开下钻报表：{kpi_key}")

    def _get_current_module_key(self):
        """返回当前模块对应的导航 key。"""
        if isinstance(self.current_module, DashboardFrame):
            return "dashboard"
        if isinstance(self.current_module, DashboardV2Frame):
            return "dashboard_v2"
        if isinstance(self.current_module, ReportsV2Frame):
            return "reports_v2"
        if isinstance(self.current_module, RentalManagementFrame):
            return "rental"
        if isinstance(self.current_module, RentalContractsV2Frame):
            return "rental_v2"
        if isinstance(self.current_module, DueReminderFrame):
            return "reminder"
        if isinstance(self.current_module, HardwareBrandFrame):
            return "hardware_brands"
        if isinstance(self.current_module, UserManagementFrame):
            return "user_mgmt"
        return None
    
    def _get_user_role(self):
        """获取当前用户角色"""
        try:
            settings = self.data_manager.data.get("settings", {})
            users = settings.get("users", [])
            for user in users:
                if user.get("username") == self.username:
                    return user.get("role", "admin")
        except Exception:
            pass
        return "admin"
    
    def _refresh_current(self):
        """F5 刷新当前模块"""
        if self.current_module and hasattr(self.current_module, '_refresh'):
            self.current_module._refresh()
            self.status_label.config(text="✓ 已刷新")
            self.root.after(2000, lambda: self.status_label.config(text="✓ 系统就绪"))

    def _focus_search(self):
        """Ctrl+F 聚焦搜索框"""
        if self.current_module and hasattr(self.current_module, 'search_var'):
            try:
                for child in self.current_module.winfo_children():
                    for sub in child.winfo_children():
                        if isinstance(sub, ttk.Entry):
                            sub.focus_set()
                            break
            except Exception:
                pass

    def _handle_logout(self):
        """处理退出"""
        if messagebox.askyesno("确认", "确定要退出系统吗？"):
            self.root.destroy()
    
    def run(self):
        """运行主窗口"""
        self.root.mainloop()
