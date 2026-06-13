#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户认证模块
处理登录验证和会话管理
"""

import tkinter as tk
import ctypes
import ctypes.wintypes
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


class LoginFrame(tk.Frame):
    """登录界面 — 直接嵌入根窗口的 Frame，零窗口切换 = 零闪烁"""

    def __init__(self, parent, auth_manager):
        from theme.colors import DarkTheme
        super().__init__(parent, bg=DarkTheme.BG_PRIMARY)
        self.auth_manager = auth_manager
        self.password_visible = False
        # 使用 StringVar 传递登录结果，main() 通过 wait_variable 等待
        self.login_result = tk.StringVar(value="")  # ""=未登录, JSON=成功, "cancel"=关闭

        self.dark_theme = DarkTheme
        self._configure_login_styles()
        self._create_widgets()
        self.parent = parent

    def _configure_login_styles(self):
        style = ttk.Style()
        style.configure(
            "Login.TEntry",
            fieldbackground=self.dark_theme.BG_INPUT,
            foreground=self.dark_theme.TEXT_PRIMARY,
            insertcolor=self.dark_theme.TEXT_PRIMARY,
            borderwidth=0,
            padding=(10, 8)
        )

    def _create_widgets(self):
        dt = self.dark_theme
        bg_color = dt.BG_PRIMARY
        card_bg = dt.BG_CARD

        # ── 顶部品牌区 ──
        top = tk.Frame(self, bg=bg_color)
        top.pack(fill=tk.X, pady=(40, 0))
        tk.Label(top, text="速 维", font=("微软雅黑", 36, "bold"),
                 fg=dt.ACCENT_PRIMARY, bg=bg_color).pack()
        tk.Label(top, text="电脑租赁管理系统", font=("微软雅黑", 16),
                 fg=dt.TEXT_SECONDARY, bg=bg_color).pack(pady=(2, 0))

        # ── 分隔线 ──
        sep = tk.Frame(self, bg=dt.ACCENT_PRIMARY, height=2, width=80)
        sep.pack(pady=(14, 20))
        sep.pack_propagate(False)
        sep.config(width=80)

        # ── 居中卡片 ──
        card_wrapper = tk.Frame(self, bg=bg_color)
        card_wrapper.pack(fill=tk.BOTH, expand=True, padx=60, pady=(0, 40))
        card_wrapper.grid_rowconfigure(0, weight=1)
        card_wrapper.grid_columnconfigure(0, weight=1)

        card = tk.Frame(card_wrapper, bg=card_bg,
                        highlightbackground=dt.BORDER_COLOR, highlightthickness=1)
        card.grid(row=0, column=0, sticky="")

        inner = tk.Frame(card, bg=card_bg)
        inner.pack(padx=48, pady=36)

        tk.Label(inner, text="管理员登录", font=("微软雅黑", 20, "bold"),
                 fg=dt.TEXT_PRIMARY, bg=card_bg).pack(pady=(0, 6))
        tk.Label(inner, text="请使用管理员账号登录系统",
                 font=dt.FONT_LABEL, fg=dt.TEXT_SECONDARY,
                 bg=card_bg).pack(pady=(0, 24))

        self.username_entry = self._build_entry(inner, "用户名", "admin")
        self.password_entry = self._build_entry(inner, "密码", "admin123", show="●")

        act = tk.Frame(inner, bg=card_bg)
        act.pack(fill=tk.X, pady=(2, 16))
        self.show_password_btn = tk.Button(
            act, text="👁 显示密码", font=dt.FONT_SMALL,
            fg=dt.TEXT_SECONDARY, bg=dt.BG_TERTIARY,
            relief=tk.FLAT, cursor="hand2", command=self._toggle_password)
        self.show_password_btn.pack(side=tk.LEFT)
        dt.bind_hover(self.show_password_btn, dt.BG_TERTIARY, dt.BG_HOVER)

        tk.Button(act, text="清空", font=dt.FONT_SMALL,
                  fg=dt.TEXT_SECONDARY, bg=card_bg,
                  relief=tk.FLAT, cursor="hand2", command=self._clear_form).pack(side=tk.RIGHT)

        self.status_var = tk.StringVar(value=self._initial_status_text())
        self.status_label = tk.Label(inner, textvariable=self.status_var, font=dt.FONT_SMALL,
                                     fg=dt.TEXT_MUTED, bg=card_bg, anchor=tk.W)
        self.status_label.pack(fill=tk.X, pady=(0, 14))

        login_btn = tk.Button(inner, text="登 录 系 统", font=("微软雅黑", 14, "bold"),
                              fg="white", bg=dt.ACCENT_PRIMARY,
                              relief=tk.FLAT, cursor="hand2", command=self._handle_login)
        login_btn.pack(fill=tk.X, ipady=10)
        dt.bind_hover(login_btn, dt.ACCENT_PRIMARY, dt.darken(dt.ACCENT_PRIMARY, 18))

        tk.Label(inner, text="默认账号：admin  ·  默认密码：admin123",
                 font=dt.FONT_SMALL, fg=dt.TEXT_MUTED,
                 bg=card_bg).pack(pady=(12, 0))

        self.bind('<Return>', lambda e: self._handle_login())
        self.bind('<Escape>', lambda e: self._cancel_login())
        self.username_entry.focus()

    def _build_entry(self, parent, label, default="", show=None):
        dt = self.dark_theme
        tk.Label(parent, text=label, font=dt.FONT_LABEL,
                 fg=dt.TEXT_SECONDARY, bg=dt.BG_CARD).pack(
            anchor=tk.W, pady=(0, 6))
        wrap = tk.Frame(parent, bg=dt.BG_INPUT)
        wrap.pack(fill=tk.X, pady=(0, 16))
        wrap.configure(highlightbackground=dt.BORDER_COLOR, highlightthickness=1)
        entry = ttk.Entry(wrap, font=("微软雅黑", 14), style="Login.TEntry", show=show)
        entry.pack(fill=tk.X, ipady=4)
        entry.insert(0, default)
        entry.bind("<FocusIn>", lambda e, frame=wrap: frame.configure(highlightbackground=dt.BORDER_FOCUS))
        entry.bind("<FocusOut>", lambda e, frame=wrap: frame.configure(highlightbackground=dt.BORDER_COLOR))
        return entry

    def _initial_status_text(self):
        if self.auth_manager.is_locked():
            return self.auth_manager.lock_remaining_text()
        settings = self.auth_manager.data_manager.data.get("settings", {})
        failed_count = int(settings.get("failed_login_count", 0))
        if failed_count:
            remain = max(0, self.auth_manager.max_failed_attempts - failed_count)
            return f"上次登录失败，还可尝试 {remain} 次"
        return "数据库已就绪，按 Enter 快速登录"

    def _set_status(self, text, color=None):
        self.status_var.set(text)
        self.status_label.configure(fg=color or self.dark_theme.TEXT_MUTED)

    def _toggle_password(self):
        self.password_visible = not self.password_visible
        self.password_entry.configure(show="" if self.password_visible else "●")
        self.show_password_btn.configure(text="🙈 隐藏密码" if self.password_visible else "👁 显示密码")

    def _clear_password(self):
        self.password_entry.delete(0, tk.END)
        self.password_entry.focus()
        self._set_status("已清空密码，Esc 可再次清空", self.dark_theme.TEXT_SECONDARY)

    def _clear_form(self):
        self.username_entry.delete(0, tk.END)
        self.password_entry.delete(0, tk.END)
        self.username_entry.focus()
        self._set_status("表单已清空", self.dark_theme.TEXT_SECONDARY)

    def _cancel_login(self):
        """取消登录，关闭窗口"""
        self.login_result.set("cancel")

    def _handle_login(self):
        username = self.username_entry.get().strip()
        password = self.password_entry.get().strip()

        if not username or not password:
            self._set_status("请输入用户名和密码", self.dark_theme.ACCENT_YELLOW)
            messagebox.showwarning("提示", "请输入用户名和密码")
            return

        if self.auth_manager.is_locked():
            self._set_status(self.auth_manager.lock_remaining_text(), self.dark_theme.ACCENT_RED)
            messagebox.showerror("账户锁定", self.auth_manager.lock_remaining_text())
            return

        success, user_role = self.auth_manager.verify_credentials(username, password)
        if success:
            self._set_status("登录成功，正在进入系统...", self.dark_theme.ACCENT_GREEN)
            # 通过 StringVar 传递结果，main() 等待此变量
            import json
            self.login_result.set(json.dumps({"username": username, "role": user_role}))
        else:
            settings = self.auth_manager.data_manager.data.get("settings", {})
            failed_count = int(settings.get("failed_login_count", 0))
            remain = max(0, self.auth_manager.max_failed_attempts - failed_count)
            if self.auth_manager.is_locked():
                self._set_status(self.auth_manager.lock_remaining_text(), self.dark_theme.ACCENT_RED)
                messagebox.showerror("账户锁定", self.auth_manager.lock_remaining_text())
            else:
                self._set_status(f"用户名或密码错误，还可尝试 {remain} 次", self.dark_theme.ACCENT_RED)
                messagebox.showerror("错误", f"用户名或密码错误，还可尝试 {remain} 次")
            self.password_entry.delete(0, tk.END)
            self.password_entry.focus()
