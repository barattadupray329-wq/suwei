#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户认证模块
处理登录验证和会话管理
"""

import tkinter as tk
from tkinter import ttk, messagebox
from theme.colors import DarkTheme


class AuthManager:
    """认证管理器"""
    
    def __init__(self, data_manager):
        self.data_manager = data_manager
        self.current_user = None
        self.is_authenticated = False
    
    def verify_credentials(self, username: str, password: str) -> bool:
        """验证用户名和密码"""
        settings = self.data_manager.data.get("settings", {})
        admin_user = settings.get("default_admin", "admin")
        admin_pass = settings.get("default_password", "admin123")
        
        if username == admin_user and password == admin_pass:
            self.current_user = username
            self.is_authenticated = True
            return True
        return False
    
    def logout(self):
        """注销登录"""
        self.current_user = None
        self.is_authenticated = False


class LoginWindow:
    """登录窗口"""
    
    def __init__(self, auth_manager, on_login_success):
        self.auth_manager = auth_manager
        self.on_login_success = on_login_success
        
        self.root = tk.Tk()
        self.root.title("速维电脑租赁管理系统 - 登录")
        self.root.geometry("420x520")
        self.root.resizable(False, False)
        self.root.configure(bg=DarkTheme.BG_PRIMARY)
        
        # 居中显示
        self._center_window()
        
        self._create_widgets()
    
    def _center_window(self):
        """窗口居中"""
        self.root.update_idletasks()
        width = 420
        height = 520
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'{width}x{height}+{x}+{y}')
    
    def _create_widgets(self):
        """创建登录界面组件"""
        # Logo/标题区域
        title_frame = tk.Frame(self.root, bg=DarkTheme.BG_PRIMARY)
        title_frame.pack(fill=tk.X, pady=(40, 20))
        
        tk.Label(
            title_frame,
            text="💻 速维电脑",
            font=("微软雅黑", 24, "bold"),
            fg=DarkTheme.ACCENT_CYAN,
            bg=DarkTheme.BG_PRIMARY
        ).pack(pady=(0, 5))
        
        tk.Label(
            title_frame,
            text="租赁管理系统",
            font=("微软雅黑", 16),
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_PRIMARY
        ).pack()
        
        # 登录表单区域
        form_frame = tk.Frame(self.root, bg=DarkTheme.BG_CARD, relief=tk.FLAT)
        form_frame.pack(fill=tk.X, padx=40, pady=20)
        form_frame.configure(highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        
        # 用户名
        tk.Label(
            form_frame,
            text="👤 用户名",
            font=DarkTheme.FONT_LABEL,
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_CARD
        ).pack(anchor=tk.W, padx=20, pady=(20, 5))
        
        self.username_entry = ttk.Entry(
            form_frame,
            font=DarkTheme.FONT_NORMAL,
            width=25
        )
        self.username_entry.pack(fill=tk.X, padx=20, pady=(0, 15))
        self.username_entry.insert(0, "admin")
        
        # 密码
        tk.Label(
            form_frame,
            text="🔒 密码",
            font=DarkTheme.FONT_LABEL,
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_CARD
        ).pack(anchor=tk.W, padx=20, pady=(0, 5))
        
        self.password_entry = ttk.Entry(
            form_frame,
            font=DarkTheme.FONT_NORMAL,
            width=25,
            show="●"
        )
        self.password_entry.pack(fill=tk.X, padx=20, pady=(0, 20))
        self.password_entry.insert(0, "admin123")
        
        # 登录按钮
        login_btn = tk.Button(
            form_frame,
            text="🚀 登 录",
            font=("微软雅黑", 12, "bold"),
            fg="white",
            bg=DarkTheme.ACCENT_BLUE,
            activebackground=DarkTheme.ACCENT_CYAN,
            activeforeground="white",
            relief=tk.FLAT,
            cursor="hand2",
            command=self._handle_login
        )
        login_btn.pack(fill=tk.X, padx=20, pady=(0, 20))
        login_btn.config(height=2)
        
        # 绑定回车键
        self.root.bind('<Return>', lambda e: self._handle_login())
        
        # 聚焦到用户名输入框
        self.username_entry.focus()
    
    def _handle_login(self):
        """处理登录逻辑"""
        username = self.username_entry.get().strip()
        password = self.password_entry.get().strip()
        
        if not username or not password:
            messagebox.showwarning("提示", "请输入用户名和密码")
            return
        
        if self.auth_manager.verify_credentials(username, password):
            self.root.destroy()
            self.on_login_success(username)
        else:
            messagebox.showerror("错误", "用户名或密码错误")
            self.password_entry.delete(0, tk.END)
            self.password_entry.focus()
    
    def run(self):
        """运行登录窗口"""
        self.root.mainloop()
