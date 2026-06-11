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
from modules.dashboard import DashboardFrame
from modules.rental_mgmt import RentalManagementFrame


class MainWindow:
    """主应用窗口"""
    
    def __init__(self, username: str, data_manager: DataManager):
        self.username = username
        self.current_module = None
        self.data_manager = data_manager
        
        # 自动检查逾期
        self.data_manager.check_overdue()
        
        self.root = tk.Tk()
        self.root.title("速维电脑租赁管理系统 v2")
        self.root.geometry("1280x720")
        self.root.minsize(1000, 600)
        self.root.configure(bg=DarkTheme.BG_PRIMARY)
        
        self._setup_styles()
        self._create_layout()
    
    def _setup_styles(self):
        """配置ttk样式"""
        style = ttk.Style()
        style.theme_use('clam')
        
        style.configure("Sidebar.TFrame", background=DarkTheme.BG_SECONDARY)
        style.configure("Main.TFrame", background=DarkTheme.BG_PRIMARY)
        style.configure("Nav.TButton",
                       font=("微软雅黑", 12),
                       background=DarkTheme.BG_TERTIARY,
                       foreground=DarkTheme.TEXT_PRIMARY,
                       borderwidth=0,
                       focuscolor="none",
                       padding=12)
        style.configure("Nav.Active.TButton",
                       background=DarkTheme.ACCENT_BLUE,
                       foreground="white")
        style.configure("Nav.TButton:hover",
                       background=DarkTheme.ACCENT_BLUE)
        style.map("Nav.TButton",
                 background=[("active", DarkTheme.ACCENT_BLUE)],
                 foreground=[("active", "white")])
        
        style.configure("Content.TFrame", background=DarkTheme.BG_PRIMARY)
        style.configure("Card.TFrame",
                       background=DarkTheme.BG_CARD,
                       relief=tk.FLAT)
        style.configure("Primary.TButton",
                       background=DarkTheme.ACCENT_BLUE,
                       foreground="white",
                       font=("微软雅黑", 10, "bold"))
        style.map("Primary.TButton",
                 background=[("active", DarkTheme.ACCENT_CYAN)])
        
        style.configure("Treeview",
                       background=DarkTheme.BG_INPUT,
                       foreground=DarkTheme.TEXT_PRIMARY,
                       fieldbackground=DarkTheme.BG_INPUT,
                       borderwidth=0,
                       font=("微软雅黑", 10))
        style.configure("Treeview.Heading",
                       background=DarkTheme.BG_TERTIARY,
                       foreground=DarkTheme.TEXT_PRIMARY,
                       font=("微软雅黑", 10, "bold"),
                       borderwidth=0)
        style.map("Treeview.Heading",
                 background=[("active", DarkTheme.BG_HOVER)])
        
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
        style.configure("TNotebook",
                       background=DarkTheme.BG_PRIMARY,
                       borderwidth=0)
        style.configure("TNotebook.Tab",
                       background=DarkTheme.BG_CARD,
                       foreground=DarkTheme.TEXT_PRIMARY,
                       font=("微软雅黑", 10),
                       padding=[12, 6])
        style.map("TNotebook.Tab",
                 background=[("selected", DarkTheme.ACCENT_BLUE)],
                 foreground=[("selected", "white")])
    
    def _create_layout(self):
        """创建主布局"""
        # 顶部栏
        top_bar = tk.Frame(self.root, bg=DarkTheme.BG_SECONDARY, height=60)
        top_bar.pack(fill=tk.X, side=tk.TOP)
        top_bar.pack_propagate(False)
        
        tk.Label(
            top_bar,
            text="💻 速维电脑租赁管理系统",
            font=("微软雅黑", 16, "bold"),
            fg=DarkTheme.ACCENT_CYAN,
            bg=DarkTheme.BG_SECONDARY
        ).pack(side=tk.LEFT, padx=20)
        
        tk.Label(
            top_bar,
            text=f"👤 {self.username}",
            font=("微软雅黑", 11),
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_SECONDARY
        ).pack(side=tk.RIGHT, padx=20)
        
        # 主容器
        main_container = tk.Frame(self.root, bg=DarkTheme.BG_PRIMARY)
        main_container.pack(fill=tk.BOTH, expand=True)
        
        # 左侧导航
        sidebar = tk.Frame(main_container, bg=DarkTheme.BG_SECONDARY, width=200)
        sidebar.pack(side=tk.LEFT, fill=tk.Y)
        sidebar.pack_propagate(False)
        
        # 导航按钮
        self.nav_buttons = {}
        nav_items = [
            ("📊 仪表板", "dashboard"),
            ("📋 租赁管理", "rental"),
        ]
        
        for i, (text, key) in enumerate(nav_items):
            btn = ttk.Button(
                sidebar,
                text=text,
                style="Nav.TButton",
                command=lambda k=key: self._switch_module(k)
            )
            btn.pack(fill=tk.X, padx=10, pady=5)
            self.nav_buttons[key] = btn
        
        # 底部退出按钮
        tk.Frame(sidebar, bg=DarkTheme.BG_SECONDARY).pack(fill=tk.X, expand=True)
        logout_btn = ttk.Button(
            sidebar,
            text="🚪 退出系统",
            style="Nav.TButton",
            command=self._handle_logout
        )
        logout_btn.pack(fill=tk.X, padx=10, pady=(0, 20))
        
        # 右侧内容区
        self.content_frame = tk.Frame(main_container, bg=DarkTheme.BG_PRIMARY)
        self.content_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # 默认加载仪表板
        self._switch_module("dashboard")
    
    def _switch_module(self, module_key: str):
        """切换模块"""
        # 清除当前内容
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        
        # 更新导航按钮样式
        for key, btn in self.nav_buttons.items():
            if key == module_key:
                btn.configure(style="Nav.Active.TButton")
            else:
                btn.configure(style="Nav.TButton")
        
        # 加载新模块
        if module_key == "dashboard":
            self.current_module = DashboardFrame(self.content_frame, self.data_manager)
        elif module_key == "rental":
            self.current_module = RentalManagementFrame(self.content_frame, self)
        
        self.current_module.pack(fill=tk.BOTH, expand=True)
    
    def _handle_logout(self):
        """处理退出"""
        if messagebox.askyesno("确认", "确定要退出系统吗？"):
            self.root.destroy()
    
    def run(self):
        """运行主窗口"""
        self.root.mainloop()
