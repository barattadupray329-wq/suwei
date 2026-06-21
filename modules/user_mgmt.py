#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户管理模块
支持多用户、角色权限管理与基础账号维护
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import hashlib
import os
import re
from datetime import datetime
from theme.colors import DarkTheme


# 角色权限定义
ROLE_PERMISSIONS = {
    "admin": {
        "label": "管理员",
        "can_delete": True,
        "can_export": True,
        "can_import": True,
        "can_modify_users": True,
        "can_view_all": True,
        "can_backup": True,
    },
    "operator": {
        "label": "操作员",
        "can_delete": False,
        "can_export": True,
        "can_import": True,
        "can_modify_users": False,
        "can_view_all": True,
        "can_backup": False,
    },
    "viewer": {
        "label": "只读用户",
        "can_delete": False,
        "can_export": True,
        "can_import": False,
        "can_modify_users": False,
        "can_view_all": False,
        "can_backup": False,
    },
}

VALID_ROLES = tuple(ROLE_PERMISSIONS.keys())


class UserManager:
    """用户管理器"""

    def __init__(self, data_manager):
        self.dm = data_manager
        self._ensure_users_table()

    def _ensure_users_table(self):
        """确保用户表存在。"""
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users")
        changed = False
        if not isinstance(users, list) or not users:
            settings["users"] = [self._create_default_admin()]
            changed = True
        else:
            normalized = []
            for user in users:
                normalized.append(self._normalize_user(user))
            if normalized != users:
                settings["users"] = normalized
                changed = True
        if changed:
            self.dm.save()

    def _create_default_admin(self) -> dict:
        salt = os.urandom(16).hex()
        pwd_hash = self._hash_password("admin123", salt)
        return {
            "username": "admin",
            "password_hash": pwd_hash,
            "password_salt": salt,
            "role": "admin",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "last_login": None,
            "is_active": True,
        }

    def _normalize_user(self, user: dict) -> dict:
        normalized = dict(user or {})
        normalized.setdefault("username", "")
        normalized.setdefault("password_hash", "")
        normalized.setdefault("password_salt", "")
        normalized["role"] = normalized.get("role", "viewer") if normalized.get("role") in VALID_ROLES else "viewer"
        normalized.setdefault("created_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        normalized.setdefault("last_login", None)
        normalized["is_active"] = bool(normalized.get("is_active", True))
        return normalized

    def _hash_password(self, password: str, salt: str) -> str:
        """密码哈希"""
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

    def _validate_username(self, username: str) -> bool:
        return bool(username) and 2 <= len(username) <= 24 and re.fullmatch(r"[A-Za-z0-9_\-\u4e00-\u9fa5]+", username) is not None

    def _validate_password(self, password: str) -> bool:
        return bool(password) and len(password) >= 6

    def verify_user(self, username: str, password: str) -> dict | None:
        """验证用户登录"""
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        for user in users:
            if user["username"] == username and user.get("is_active", True):
                pwd_hash = self._hash_password(password, user.get("password_salt", ""))
                if pwd_hash == user.get("password_hash", ""):
                    user["last_login"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    self.dm.save()
                    return user
        return None

    def get_all_users(self) -> list:
        """获取所有用户"""
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        return [self._normalize_user(u) for u in users]

    def add_user(self, username: str, password: str, role: str = "operator") -> bool:
        """添加用户"""
        username = (username or "").strip()
        if not self._validate_username(username) or not self._validate_password(password):
            return False
        if role not in VALID_ROLES:
            role = "viewer"
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        if any(u["username"] == username for u in users):
            return False
        salt = os.urandom(16).hex()
        pwd_hash = self._hash_password(password, salt)
        users.append({
            "username": username,
            "password_hash": pwd_hash,
            "password_salt": salt,
            "role": role,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "last_login": None,
            "is_active": True,
        })
        self.dm.save()
        return True

    def update_user_role(self, username: str, new_role: str) -> bool:
        """更新用户角色"""
        if new_role not in VALID_ROLES:
            return False
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        for user in users:
            if user["username"] == username:
                if username == "admin" and new_role != "admin":
                    return False
                user["role"] = new_role
                self.dm.save()
                return True
        return False

    def update_user_password(self, username: str, new_password: str) -> bool:
        """更新用户密码"""
        if not self._validate_password(new_password):
            return False
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        for user in users:
            if user["username"] == username:
                salt = os.urandom(16).hex()
                user["password_hash"] = self._hash_password(new_password, salt)
                user["password_salt"] = salt
                self.dm.save()
                return True
        return False

    def delete_user(self, username: str) -> bool:
        """删除用户（不能删除admin）"""
        if username == "admin":
            return False
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        original_len = len(users)
        users[:] = [u for u in users if u["username"] != username]
        if len(users) < original_len:
            self.dm.save()
            return True
        return False

    def toggle_user_active(self, username: str) -> bool:
        """启用/禁用用户"""
        if username == "admin":
            return False
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        for user in users:
            if user["username"] == username:
                user["is_active"] = not user.get("is_active", True)
                self.dm.save()
                return True
        return False

    def get_permissions(self, role: str) -> dict:
        """获取角色权限"""
        return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["viewer"])

    def get_user_summary(self) -> dict:
        users = self.get_all_users()
        return {
            "total": len(users),
            "active": sum(1 for u in users if u.get("is_active", True)),
            "inactive": sum(1 for u in users if not u.get("is_active", True)),
            "admins": sum(1 for u in users if u.get("role") == "admin"),
        }


class UserManagementFrame(ttk.Frame):
    """用户管理界面"""

    def __init__(self, parent, data_manager, current_user_role="admin"):
        super().__init__(parent)
        self.dm = data_manager
        self.user_mgr = UserManager(data_manager)
        self.current_user_role = current_user_role
        self.configure(style="Main.TFrame")
        self._build()

    def _center_window(self, win, width, height):
        """让弹窗显示在程序中心。"""
        win.update_idletasks()
        parent = self.winfo_toplevel()
        parent.update_idletasks()
        parent_x = parent.winfo_rootx()
        parent_y = parent.winfo_rooty()
        parent_w = parent.winfo_width()
        parent_h = parent.winfo_height()
        if parent_w <= 1 or parent_h <= 1:
            parent_w = parent.winfo_screenwidth()
            parent_h = parent.winfo_screenheight()
            parent_x = 0
            parent_y = 0
        x = parent_x + max((parent_w - width) // 2, 0)
        y = parent_y + max((parent_h - height) // 2, 0)
        win.geometry(f"{width}x{height}+{x}+{y}")

    def _action_button(self, parent, text, command, color, padx=10, pady=4):
        btn = tk.Button(parent, text=text, font=DarkTheme.FONT_SMALL,
                        fg="white", bg=color, relief=tk.FLAT, cursor="hand2",
                        command=command, padx=padx, pady=pady)
        btn.pack(side=tk.LEFT, padx=2)
        DarkTheme.bind_hover(btn, color)
        return btn

    def _section_header(self, parent, text, color):
        return tk.Label(parent, text=text, font=DarkTheme.FONT_TITLE,
                        fg=color, bg=DarkTheme.BG_PRIMARY)

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        head = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        head.pack(fill=tk.X, pady=(0, 10))
        self._section_header(head, "👥 用户管理", DarkTheme.ACCENT_CYAN).pack(side=tk.LEFT)
        summary = self.user_mgr.get_user_summary()
        self.summary_label = tk.Label(
            head,
            text=f"总用户 {summary['total']} | 启用 {summary['active']} | 停用 {summary['inactive']}",
            font=DarkTheme.FONT_SMALL,
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_PRIMARY,
        )
        self.summary_label.pack(side=tk.RIGHT)

        perm = self.user_mgr.get_permissions(self.current_user_role)
        if not perm.get("can_modify_users"):
            tk.Label(head, text="⚠️ 您没有用户管理权限", font=DarkTheme.FONT_SMALL,
                     fg=DarkTheme.ACCENT_RED, bg=DarkTheme.BG_PRIMARY).pack(side=tk.RIGHT, padx=(0, 14))
            return

        search_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        search_row.pack(fill=tk.X, pady=(0, 10))
        tk.Label(search_row, text="搜索", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=8, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        self.search_var = tk.StringVar()
        search_entry = ttk.Entry(search_row, textvariable=self.search_var, width=28)
        search_entry.pack(side=tk.LEFT, padx=(0, 8))
        search_entry.bind("<KeyRelease>", lambda *_: self._load_users())
        tk.Button(search_row, text="清空", font=DarkTheme.FONT_BUTTON, fg="white", bg=DarkTheme.BG_HOVER,
                  relief=tk.FLAT, cursor="hand2", command=self._clear_search, padx=12, pady=4).pack(side=tk.LEFT)

        btn_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, pady=(0, 10))
        self._action_button(btn_row, "➕ 添加用户", self._add_user_dialog, DarkTheme.ACCENT_BLUE)
        self._action_button(btn_row, "✏️ 修改角色", self._change_role_dialog, DarkTheme.ACCENT_CYAN)
        self._action_button(btn_row, "🔑 修改密码", self._reset_password_dialog, DarkTheme.ACCENT_YELLOW)
        self._action_button(btn_row, "🚫 启用/禁用", self._toggle_user_dialog, DarkTheme.ACCENT_PURPLE)
        self._action_button(btn_row, "🗑 删除用户", self._delete_user_dialog, DarkTheme.ACCENT_RED)
        self._action_button(btn_row, "🔄 重置默认密码", self._reset_to_default_password, DarkTheme.ACCENT_YELLOW)
        self._action_button(btn_row, "⟳ 刷新", self._refresh_users, DarkTheme.ACCENT_GREEN)
        self._action_button(btn_row, "🧹 清理选择", self._clear_selection, DarkTheme.BG_HOVER)

        self._build_table(main)

    def _build_table(self, parent):
        """用户列表表格"""
        table_frame = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
        table_frame.pack(fill=tk.BOTH, expand=True)
        cols = ("#", "用户名", "角色", "状态", "创建时间", "最后登录")
        self.tree = ttk.Treeview(table_frame, columns=cols, show="headings", height=16)
        widths = {"#": 50, "用户名": 120, "角色": 100, "状态": 80, "创建时间": 160, "最后登录": 160}
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 100), anchor="center")

        vbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.bind("<Double-1>", lambda *_: self._auto_open_selected_user())

        self._load_users()

    def _load_users(self):
        """加载用户列表"""
        if not hasattr(self, "tree"):
            return
        for i in self.tree.get_children():
            self.tree.delete(i)
        query = getattr(self, "search_var", tk.StringVar()).get().strip().lower()
        users = self.user_mgr.get_all_users()
        if query:
            users = [u for u in users if query in u.get("username", "").lower() or query in u.get("role", "").lower()]
        for idx, user in enumerate(users, 1):
            role_info = ROLE_PERMISSIONS.get(user.get("role", "viewer"), ROLE_PERMISSIONS["viewer"])
            active = user.get("is_active", True)
            status = "✅ 启用" if active else "🚫 禁用"
            status_color = DarkTheme.ACCENT_GREEN if active else DarkTheme.ACCENT_RED
            self.tree.insert("", tk.END, values=(
                idx,
                user.get("username", ""),
                role_info.get("label", user.get("role", "")),
                status,
                user.get("created_at", ""),
                user.get("last_login", "从未登录"),
            ), tags=(status_color, user.get("role", "viewer")))
        self.tree.tag_configure(DarkTheme.ACCENT_GREEN, foreground=DarkTheme.ACCENT_GREEN)
        self.tree.tag_configure(DarkTheme.ACCENT_RED, foreground=DarkTheme.ACCENT_RED)
        self.tree.tag_configure("admin", background="#17324d")
        summary = self.user_mgr.get_user_summary()
        if hasattr(self, "summary_label"):
            self.summary_label.config(text=f"总用户 {summary['total']} | 启用 {summary['active']} | 停用 {summary['inactive']}")

    def _selected_username(self):
        """获取当前选中的用户名。"""
        selected = self.tree.selection()
        if not selected:
            return None
        iid = selected[0]
        values = self.tree.item(iid, "values")
        return values[1] if len(values) > 1 else None

    def _refresh_users(self):
        self._load_users()
        messagebox.showinfo("提示", "用户列表已刷新")

    def _clear_search(self):
        if hasattr(self, "search_var"):
            self.search_var.set("")
        self._load_users()

    def _clear_selection(self):
        if hasattr(self, "tree"):
            self.tree.selection_remove(self.tree.selection())

    def _auto_open_selected_user(self):
        user = self._get_selected_user()
        if not user:
            return
        self._change_role_dialog()

    def _refresh_users(self):
        summary = self.user_mgr.get_user_summary()
        self._load_users()
        messagebox.showinfo("刷新完成", f"用户列表已刷新\n总用户: {summary['total']}\n启用: {summary['active']}\n停用: {summary['inactive']}")

    def _get_selected_user(self):
        username = self._selected_username()
        if not username:
            return None
        return next((u for u in self.user_mgr.get_all_users() if u.get("username") == username), None)

    def _add_user_dialog(self):
        """添加用户对话框"""
        win = tk.Toplevel(self)
        win.title("➕ 添加用户")
        win.transient(self.winfo_toplevel())
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window(win, 470, 430)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=16)

        tk.Label(main, text="添加新用户", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        refs = {}
        refs['username'] = self._make_field(main, "用户名*", "")
        refs['password'] = self._make_field(main, "密码*", "", show="●")
        refs['confirm_password'] = self._make_field(main, "确认密码*", "", show="●")
        tk.Label(main, text="用户名支持中文、英文、数字、下划线和连字符，密码至少 6 位", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(2, 6))

        role_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        role_row.pack(fill=tk.X, pady=3)
        tk.Label(role_row, text="角色*", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        refs['role_var'] = tk.StringVar(value="operator")
        role_combo = ttk.Combobox(role_row, textvariable=refs['role_var'], state="readonly",
                                  values=list(VALID_ROLES), width=20)
        role_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)

        perm_frame = tk.Frame(main, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        perm_frame.pack(fill=tk.X, pady=(8, 12))
        tk.Label(perm_frame, text="权限说明:", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=8, pady=(6, 2))
        self.perm_label = tk.Label(perm_frame, text="", font=DarkTheme.FONT_SMALL,
                                   fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_CARD, justify=tk.LEFT, wraplength=390)
        self.perm_label.pack(anchor=tk.W, padx=8, pady=(0, 6))

        def update_perm_desc(*_):
            role = refs['role_var'].get()
            perm = self.user_mgr.get_permissions(role)
            desc = f"可操作: {', '.join([k for k, v in perm.items() if v and k != 'label'])}"
            self.perm_label.config(text=desc)

        refs['role_var'].trace_add("write", update_perm_desc)
        update_perm_desc()

        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(0, 8))
        tk.Button(btn, text="✅ 创建", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._do_add_user(refs, win), padx=14, pady=6).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=win.destroy, padx=14, pady=6).pack(side=tk.LEFT)
        win.bind("<Return>", lambda *_: self._do_add_user(refs, win))
        win.bind("<Escape>", lambda *_: win.destroy())

    def _do_add_user(self, refs, win):
        """执行添加用户"""
        username = refs['username'].get().strip()
        password = refs['password'].get().strip()
        confirm_password = refs['confirm_password'].get().strip()
        role = refs['role_var'].get()

        if not username or not password or not confirm_password:
            messagebox.showwarning("提示", "请完整填写用户名和密码")
            return
        if password != confirm_password:
            messagebox.showwarning("提示", "两次输入的密码不一致")
            return

        if self.user_mgr.add_user(username, password, role):
            messagebox.showinfo("成功", f"用户 {username} 已创建")
            win.destroy()
            self._load_users()
        else:
            messagebox.showerror("错误", "用户创建失败，请检查用户名格式、密码长度或是否重复")

    def _change_role_dialog(self):
        """修改用户角色。"""
        user = self._get_selected_user()
        if not user:
            messagebox.showinfo("提示", "请先选择要修改的用户")
            return
        if user.get("username") == "admin":
            messagebox.showwarning("提示", "管理员角色不能修改")
            return

        win = tk.Toplevel(self)
        win.title("修改角色")
        win.transient(self.winfo_toplevel())
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window(win, 380, 220)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=16)
        tk.Label(main, text=f"用户：{user.get('username')}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 10))

        role_var = tk.StringVar(value=user.get("role", "viewer"))
        role_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        role_row.pack(fill=tk.X, pady=3)
        tk.Label(role_row, text="新角色", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Combobox(role_row, textvariable=role_var, state="readonly", values=list(VALID_ROLES), width=20).pack(side=tk.LEFT, fill=tk.X, expand=True)

        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(18, 0))
        tk.Button(btn, text="确定", font=DarkTheme.FONT_BUTTON, fg="white", bg=DarkTheme.ACCENT_BLUE,
                  relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._do_change_role(user.get("username"), role_var.get(), win), padx=14, pady=6).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white", bg=DarkTheme.BG_HOVER,
                  relief=tk.FLAT, cursor="hand2", command=win.destroy, padx=14, pady=6).pack(side=tk.LEFT)
        win.bind("<Return>", lambda *_: self._do_change_role(user.get("username"), role_var.get(), win))
        win.bind("<Escape>", lambda *_: win.destroy())

    def _do_change_role(self, username, new_role, win):
        if self.user_mgr.update_user_role(username, new_role):
            messagebox.showinfo("成功", f"用户 {username} 角色已更新为 {ROLE_PERMISSIONS.get(new_role, {}).get('label', new_role)}")
            win.destroy()
            self._load_users()
        else:
            messagebox.showerror("错误", "角色修改失败")

    def _reset_password_dialog(self):
        """修改密码对话框"""
        user = self._get_selected_user()
        if not user:
            messagebox.showinfo("提示", "请先选择要修改密码的用户")
            return

        username = user.get("username")
        if username == "admin" and self.current_user_role != "admin":
            messagebox.showwarning("提示", "只有管理员可以修改管理员密码")
            return

        win = tk.Toplevel(self)
        win.title("重置密码")
        win.transient(self.winfo_toplevel())
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window(win, 380, 220)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=16)
        tk.Label(main, text=f"用户：{username}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_YELLOW, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 10))
        tk.Label(main, text="请输入新密码，至少 6 位", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))
        tk.Label(main, text="管理员修改管理员密码时也在这里操作", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))

        pwd_var = tk.StringVar()
        pwd_entry = ttk.Entry(main, textvariable=pwd_var, show="●", font=DarkTheme.FONT_NORMAL)
        pwd_entry.pack(fill=tk.X, pady=(0, 8))
        pwd_entry.focus_set()

        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(12, 0))
        tk.Button(btn, text="确定", font=DarkTheme.FONT_BUTTON, fg="white", bg=DarkTheme.ACCENT_BLUE,
                  relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._do_reset_password(username, pwd_var.get(), win), padx=14, pady=6).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white", bg=DarkTheme.BG_HOVER,
                  relief=tk.FLAT, cursor="hand2", command=win.destroy, padx=14, pady=6).pack(side=tk.LEFT)
        win.bind("<Return>", lambda *_: self._do_reset_password(username, pwd_var.get(), win))
        win.bind("<Escape>", lambda *_: win.destroy())

    def _do_reset_password(self, username, new_pwd, win):
        new_pwd = (new_pwd or "").strip()
        if not new_pwd:
            messagebox.showwarning("提示", "请输入新密码")
            return
        if self.user_mgr.update_user_password(username, new_pwd):
            messagebox.showinfo("成功", f"用户 {username} 密码已更新")
            win.destroy()
            self._load_users()
        else:
            messagebox.showerror("错误", "密码修改失败，请确认密码长度至少 6 位")

    def _reset_to_default_password(self):
        user = self._get_selected_user()
        if not user:
            messagebox.showinfo("提示", "请先选择要重置的用户")
            return
        username = user.get("username")
        if username == "admin" and self.current_user_role != "admin":
            messagebox.showwarning("提示", "只有管理员可以重置管理员密码")
            return
        if not messagebox.askyesno("确认", f"将用户 {username} 密码重置为默认值 admin123，是否继续？"):
            return
        if self.user_mgr.update_user_password(username, "admin123"):
            messagebox.showinfo("成功", f"用户 {username} 已重置为默认密码")
            self._load_users()
        else:
            messagebox.showerror("错误", "重置失败")

    def _toggle_user_dialog(self):
        """启用/禁用用户"""
        user = self._get_selected_user()
        if not user:
            messagebox.showinfo("提示", "请先选择要操作的用户")
            return

        if user.get("username") == "admin":
            messagebox.showwarning("提示", "不能禁用管理员账号")
            return

        action = "禁用" if user.get("is_active", True) else "启用"
        if not messagebox.askyesno("确认", f"确定要{action}用户 {user.get('username')} 吗？"):
            return

        if self.user_mgr.toggle_user_active(user.get("username")):
            messagebox.showinfo("成功", f"用户 {user.get('username')} 已{action}")
            self._load_users()
        else:
            messagebox.showerror("错误", "操作失败")

    def _delete_user_dialog(self):
        """删除用户确认"""
        user = self._get_selected_user()
        if not user:
            messagebox.showinfo("提示", "请先选择要删除的用户")
            return

        username = user.get("username")
        if username == "admin":
            messagebox.showwarning("提示", "不能删除管理员账号")
            return

        if messagebox.askyesno("确认删除", f"确定删除用户 {username} 吗？此操作不可恢复。"):
            if self.user_mgr.delete_user(username):
                messagebox.showinfo("成功", f"用户 {username} 已删除")
                self._load_users()
            else:
                messagebox.showerror("错误", "删除失败")

    def _make_field(self, parent, label, default="", show=None):
        """创建输入行"""
        row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=3)
        tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        entry = ttk.Entry(row, width=22, font=DarkTheme.FONT_NORMAL, show=show)
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        if default:
            entry.insert(0, default)
        return entry
