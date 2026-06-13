#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户认证模块
处理登录验证和会话管理
"""

import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime, timedelta
from theme.colors import DarkTheme


class AuthManager:
    """认证管理器"""
    
    def __init__(self, data_manager):
        self.data_manager = data_manager
        self.current_user = None
        self.is_authenticated = False
        self.max_failed_attempts = 5
        self.lock_minutes = 10
    
    def verify_credentials(self, username: str, password: str) -> tuple:
        """验证用户名和密码，返回 (success, user_role)"""
        settings = self.data_manager.data.setdefault("settings", {})
        admin_user = settings.get("default_admin", "admin")

        if self.is_locked():
            return (False, None)

        # 尝试多用户登录
        from modules.user_mgmt import UserManager
        user_mgr = UserManager(self.data_manager)
        user = user_mgr.verify_user(username, password)
        if user:
            self.current_user = username
            self.is_authenticated = True
            settings["failed_login_count"] = 0
            settings["locked_until"] = None
            self.data_manager.save()
            return (True, user.get("role", "admin"))

        # 兼容旧版管理员登录
        if username == admin_user and self.data_manager.verify_password(password):
            self.current_user = username
            self.is_authenticated = True
            settings["failed_login_count"] = 0
            settings["locked_until"] = None
            self.data_manager.save()
            return (True, "admin")
        
        failed_count = int(settings.get("failed_login_count", 0)) + 1
        settings["failed_login_count"] = failed_count
        if failed_count >= self.max_failed_attempts:
            locked_until = datetime.now() + timedelta(minutes=self.lock_minutes)
            settings["locked_until"] = locked_until.strftime("%Y-%m-%d %H:%M:%S")
        self.data_manager.save()
        return (False, None)

    def is_locked(self) -> bool:
        """检查账户是否处于锁定状态"""
        settings = self.data_manager.data.setdefault("settings", {})
        locked_until = settings.get("locked_until")
        if not locked_until:
            return False
        try:
            locked_until_dt = datetime.strptime(locked_until, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            settings["locked_until"] = None
            self.data_manager.save()
            return False
        if datetime.now() < locked_until_dt:
            return True
        settings["failed_login_count"] = 0
        settings["locked_until"] = None
        self.data_manager.save()
        return False

    def lock_remaining_text(self) -> str:
        """返回锁定剩余时间文本"""
        settings = self.data_manager.data.setdefault("settings", {})
        locked_until = settings.get("locked_until")
        if not locked_until:
            return ""
        try:
            locked_until_dt = datetime.strptime(locked_until, "%Y-%m-%d %H:%M:%S")
            remaining = locked_until_dt - datetime.now()
            minutes = max(1, int(remaining.total_seconds() // 60) + 1)
            return f"账户已锁定，请约 {minutes} 分钟后再试"
        except ValueError:
            return "账户暂时锁定，请稍后再试"
    
    def logout(self):
        """注销登录"""
        self.current_user = None
        self.is_authenticated = False


class LoginWindow:
    """登录窗口 — 居中漂浮卡片式"""

    MIN_W, MIN_H = 520, 640

    def __init__(self, auth_manager, on_login_success):
        self.auth_manager = auth_manager
        self.on_login_success = on_login_success
        self.password_visible = False

        self.root = tk.Tk()
        self.root.title("速维电脑租赁管理系统 — 登录")
        self.root.minsize(self.MIN_W, self.MIN_H)
        self.root.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window()
        self._create_widgets()

    def _center_window(self):
        self.root.update_idletasks()
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        w = max(self.MIN_W, min(680, sw - 160))
        h = max(self.MIN_H, min(760, sh - 140))
        x, y = (sw - w) // 2, (sh - h) // 2
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _create_widgets(self):
        self._configure_login_styles()

        bg_color = DarkTheme.BG_PRIMARY
        # ── 顶部品牌区 ──
        top = tk.Frame(self.root, bg=bg_color)
        top.pack(fill=tk.X, pady=(40, 0))
        tk.Label(top, text="速 维", font=("微软雅黑", 36, "bold"),
                 fg=DarkTheme.ACCENT_PRIMARY, bg=bg_color).pack()
        tk.Label(top, text="电脑租赁管理系统", font=("微软雅黑", 16),
                 fg=DarkTheme.TEXT_SECONDARY, bg=bg_color).pack(pady=(2, 0))

        # ── 分隔线 ──
        sep = tk.Frame(self.root, bg=DarkTheme.ACCENT_PRIMARY, height=2, width=80)
        sep.pack(pady=(14, 20))
        sep.pack_propagate(False)
        sep.config(width=80)

        # ── 居中卡片 ──
        card_wrapper = tk.Frame(self.root, bg=bg_color)
        card_wrapper.pack(fill=tk.BOTH, expand=True, padx=60, pady=(0, 40))
        card_wrapper.grid_rowconfigure(0, weight=1)
        card_wrapper.grid_columnconfigure(0, weight=1)

        card = tk.Frame(card_wrapper, bg=DarkTheme.BG_CARD,
                        highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        card.grid(row=0, column=0, sticky="")

        # 卡片内边距
        inner = tk.Frame(card, bg=DarkTheme.BG_CARD)
        inner.pack(padx=48, pady=36)

        tk.Label(inner, text="管理员登录", font=("微软雅黑", 20, "bold"),
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_CARD).pack(pady=(0, 6))
        tk.Label(inner, text="请使用管理员账号登录系统",
                 font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_CARD).pack(pady=(0, 24))

        # 用户名
        self.username_entry = self._build_entry(inner, "用户名", "admin")
        # 密码
        self.password_entry = self._build_entry(inner, "密码", "admin123", show="●")

        # 操作行
        act = tk.Frame(inner, bg=DarkTheme.BG_CARD)
        act.pack(fill=tk.X, pady=(2, 16))
        self.show_password_btn = tk.Button(
            act, text="👁 显示密码", font=DarkTheme.FONT_SMALL,
            fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_TERTIARY,
            relief=tk.FLAT, cursor="hand2", command=self._toggle_password)
        self.show_password_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(self.show_password_btn, DarkTheme.BG_TERTIARY, DarkTheme.BG_HOVER)

        tk.Button(act, text="清空", font=DarkTheme.FONT_SMALL,
                  fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD,
                  relief=tk.FLAT, cursor="hand2", command=self._clear_form).pack(side=tk.RIGHT)

        # 状态
        self.status_var = tk.StringVar(value=self._initial_status_text())
        self.status_label = tk.Label(inner, textvariable=self.status_var, font=DarkTheme.FONT_SMALL,
                                     fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_CARD, anchor=tk.W)
        self.status_label.pack(fill=tk.X, pady=(0, 14))

        # 登录按钮
        login_btn = tk.Button(inner, text="登 录 系 统", font=("微软雅黑", 14, "bold"),
                              fg="white", bg=DarkTheme.ACCENT_PRIMARY,
                              relief=tk.FLAT, cursor="hand2", command=self._handle_login)
        login_btn.pack(fill=tk.X, ipady=10)
        DarkTheme.bind_hover(login_btn, DarkTheme.ACCENT_PRIMARY, DarkTheme.darken(DarkTheme.ACCENT_PRIMARY, 18))

        # 底部提示
        tk.Label(inner, text="默认账号：admin  ·  默认密码：admin123",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_CARD).pack(pady=(12, 0))

        # 全局热键
        self.root.bind('<Return>', lambda e: self._handle_login())
        self.root.bind('<Escape>', lambda e: self._clear_password())
        self.username_entry.focus()

    def _configure_login_styles(self):
        """配置登录页输入控件样式"""
        style = ttk.Style()
        style.configure(
            "Login.TEntry",
            fieldbackground=DarkTheme.BG_INPUT,
            foreground=DarkTheme.TEXT_PRIMARY,
            insertcolor=DarkTheme.TEXT_PRIMARY,
            borderwidth=0,
            padding=(10, 8)
        )

    def _build_entry(self, parent, label, default="", show=None):
        """创建统一样式输入框"""
        tk.Label(parent, text=label, font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD).pack(
            anchor=tk.W, pady=(0, 6))
        wrap = tk.Frame(parent, bg=DarkTheme.BG_INPUT)
        wrap.pack(fill=tk.X, pady=(0, 16))
        wrap.configure(highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        entry = ttk.Entry(wrap, font=("微软雅黑", 14), style="Login.TEntry", show=show)
        entry.pack(fill=tk.X, ipady=4)
        entry.insert(0, default)
        entry.bind("<FocusIn>", lambda e, frame=wrap: frame.configure(highlightbackground=DarkTheme.BORDER_FOCUS))
        entry.bind("<FocusOut>", lambda e, frame=wrap: frame.configure(highlightbackground=DarkTheme.BORDER_COLOR))
        return entry

    def _initial_status_text(self):
        """初始状态提示"""
        if self.auth_manager.is_locked():
            return self.auth_manager.lock_remaining_text()
        settings = self.auth_manager.data_manager.data.get("settings", {})
        failed_count = int(settings.get("failed_login_count", 0))
        if failed_count:
            remain = max(0, self.auth_manager.max_failed_attempts - failed_count)
            return f"上次登录失败，还可尝试 {remain} 次"
        return "数据库已就绪，按 Enter 快速登录"

    def _set_status(self, text, color=None):
        """更新非弹窗状态提示"""
        self.status_var.set(text)
        self.status_label.configure(fg=color or DarkTheme.TEXT_MUTED)

    def _toggle_password(self):
        """显示/隐藏密码"""
        self.password_visible = not self.password_visible
        self.password_entry.configure(show="" if self.password_visible else "●")
        self.show_password_btn.configure(text="🙈 隐藏密码" if self.password_visible else "👁 显示密码")

    def _clear_password(self):
        """清空密码"""
        self.password_entry.delete(0, tk.END)
        self.password_entry.focus()
        self._set_status("已清空密码，Esc 可再次清空", DarkTheme.TEXT_SECONDARY)

    def _clear_form(self):
        """清空表单"""
        self.username_entry.delete(0, tk.END)
        self.password_entry.delete(0, tk.END)
        self.username_entry.focus()
        self._set_status("表单已清空", DarkTheme.TEXT_SECONDARY)
    
    def _handle_login(self):
        """处理登录逻辑"""
        username = self.username_entry.get().strip()
        password = self.password_entry.get().strip()
        
        if not username or not password:
            self._set_status("请输入用户名和密码", DarkTheme.ACCENT_YELLOW)
            messagebox.showwarning("提示", "请输入用户名和密码")
            return

        if self.auth_manager.is_locked():
            self._set_status(self.auth_manager.lock_remaining_text(), DarkTheme.ACCENT_RED)
            messagebox.showerror("账户锁定", self.auth_manager.lock_remaining_text())
            return
        
        success, user_role = self.auth_manager.verify_credentials(username, password)
        if success:
            self._set_status("登录成功，正在进入系统...", DarkTheme.ACCENT_GREEN)
            self.root.destroy()
            self.on_login_success(username, user_role)
        else:
            settings = self.auth_manager.data_manager.data.get("settings", {})
            failed_count = int(settings.get("failed_login_count", 0))
            remain = max(0, self.auth_manager.max_failed_attempts - failed_count)
            if self.auth_manager.is_locked():
                self._set_status(self.auth_manager.lock_remaining_text(), DarkTheme.ACCENT_RED)
                messagebox.showerror("账户锁定", self.auth_manager.lock_remaining_text())
            else:
                self._set_status(f"用户名或密码错误，还可尝试 {remain} 次", DarkTheme.ACCENT_RED)
                messagebox.showerror("错误", f"用户名或密码错误，还可尝试 {remain} 次")
            self.password_entry.delete(0, tk.END)
            self.password_entry.focus()
    
    def run(self):
        """运行登录窗口"""
        self.root.mainloop()
