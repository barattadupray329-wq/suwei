#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用户管理模块
支持多用户、角色权限管理
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import hashlib
import os
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


class UserManager:
    """用户管理器"""

    def __init__(self, data_manager):
        self.dm = data_manager
        self._ensure_users_table()

    def _ensure_users_table(self):
        """确保用户表存在"""
        settings = self.dm.data.setdefault("settings", {})
        if "users" not in settings:
            # 创建默认管理员
            salt = os.urandom(16).hex()
            pwd_hash = self._hash_password("admin123", salt)
            settings["users"] = [
                {
                    "username": "admin",
                    "password_hash": pwd_hash,
                    "password_salt": salt,
                    "role": "admin",
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "last_login": None,
                    "is_active": True,
                }
            ]
            self.dm.save()

    def _hash_password(self, password: str, salt: str) -> str:
        """密码哈希"""
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

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
        return settings.get("users", [])

    def add_user(self, username: str, password: str, role: str = "operator") -> bool:
        """添加用户"""
        if not username or not password:
            return False
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        # 检查用户名是否已存在
        if any(u["username"] == username for u in users):
            return False
        salt = os.urandom(16).hex()
        pwd_hash = self._hash_password(password, salt)
        new_user = {
            "username": username,
            "password_hash": pwd_hash,
            "password_salt": salt,
            "role": role,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "last_login": None,
            "is_active": True,
        }
        users.append(new_user)
        self.dm.save()
        return True

    def update_user_role(self, username: str, new_role: str) -> bool:
        """更新用户角色"""
        settings = self.dm.data.setdefault("settings", {})
        users = settings.get("users", [])
        for user in users:
            if user["username"] == username:
                user["role"] = new_role
                self.dm.save()
                return True
        return False

    def update_user_password(self, username: str, new_password: str) -> bool:
        """更新用户密码"""
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


class UserManagementFrame(ttk.Frame):
    """用户管理界面"""

    def __init__(self, parent, data_manager, current_user_role="admin"):
        super().__init__(parent)
        self.dm = data_manager
        self.user_mgr = UserManager(data_manager)
        self.current_user_role = current_user_role
        self.configure(style="Main.TFrame")
        self._build()

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        # 标题
        head = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        head.pack(fill=tk.X, pady=(0, 14))
        tk.Label(head, text="👥 用户管理", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)

        # 权限提示
        perm = self.user_mgr.get_permissions(self.current_user_role)
        if not perm.get("can_modify_users"):
            tk.Label(head, text="⚠️ 您没有用户管理权限", font=DarkTheme.FONT_SMALL,
                     fg=DarkTheme.ACCENT_RED, bg=DarkTheme.BG_PRIMARY).pack(side=tk.RIGHT)
            return

        # 操作按钮
        btn_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, pady=(0, 10))
        tk.Button(btn_row, text="➕ 添加用户", font=DarkTheme.FONT_SMALL,
                  fg="white", bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=self._add_user_dialog, padx=10, pady=4).pack(side=tk.LEFT, padx=2)
        tk.Button(btn_row, text="🔑 重置密码", font=DarkTheme.FONT_SMALL,
                  fg="white", bg=DarkTheme.ACCENT_YELLOW, relief=tk.FLAT, cursor="hand2",
                  command=self._reset_password_dialog, padx=10, pady=4).pack(side=tk.LEFT, padx=2)
        tk.Button(btn_row, text="🚫 启用/禁用", font=DarkTheme.FONT_SMALL,
                  fg="white", bg=DarkTheme.ACCENT_PURPLE, relief=tk.FLAT, cursor="hand2",
                  command=self._toggle_user_dialog, padx=10, pady=4).pack(side=tk.LEFT, padx=2)
        tk.Button(btn_row, text="🗑 删除用户", font=DarkTheme.FONT_SMALL,
                  fg="white", bg=DarkTheme.ACCENT_RED, relief=tk.FLAT, cursor="hand2",
                  command=self._delete_user_dialog, padx=10, pady=4).pack(side=tk.LEFT, padx=2)

        # 用户列表
        self._build_table(main)

    def _build_table(self, parent):
        """用户列表表格"""
        cols = ("#", "用户名", "角色", "状态", "创建时间", "最后登录")
        self.tree = ttk.Treeview(parent, columns=cols, show="headings", height=16)
        widths = {"#": 50, "用户名": 120, "角色": 100, "状态": 80, "创建时间": 160, "最后登录": 160}
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 100), anchor="center")

        vbar = ttk.Scrollbar(parent, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)

        self._load_users()

    def _load_users(self):
        """加载用户列表"""
        for i in self.tree.get_children():
            self.tree.delete(i)
        users = self.user_mgr.get_all_users()
        for idx, user in enumerate(users, 1):
            role_info = ROLE_PERMISSIONS.get(user.get("role", "viewer"), ROLE_PERMISSIONS["viewer"])
            status = "✅ 启用" if user.get("is_active", True) else "🚫 禁用"
            status_color = DarkTheme.ACCENT_GREEN if user.get("is_active", True) else DarkTheme.ACCENT_RED
            self.tree.insert("", tk.END, values=(
                idx,
                user.get("username", ""),
                role_info.get("label", user.get("role", "")),
                status,
                user.get("created_at", ""),
                user.get("last_login", "从未登录"),
            ), tags=(status_color,))
        self.tree.tag_configure(DarkTheme.ACCENT_GREEN, foreground=DarkTheme.ACCENT_GREEN)
        self.tree.tag_configure(DarkTheme.ACCENT_RED, foreground=DarkTheme.ACCENT_RED)

    def _add_user_dialog(self):
        """添加用户对话框"""
        win = tk.Toplevel(self)
        win.title("➕ 添加用户")
        win.geometry("400x300")
        win.transient(self)
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=16)

        tk.Label(main, text="添加新用户", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        refs = {}
        refs['username'] = self._make_field(main, "用户名*", "")
        refs['password'] = self._make_field(main, "密码*", "", show="●")
        
        # 角色选择
        role_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        role_row.pack(fill=tk.X, pady=3)
        tk.Label(role_row, text="角色*", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        refs['role_var'] = tk.StringVar(value="operator")
        role_combo = ttk.Combobox(role_row, textvariable=refs['role_var'], state="readonly",
                                  values=["admin", "operator", "viewer"], width=20)
        role_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 权限说明
        perm_frame = tk.Frame(main, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        perm_frame.pack(fill=tk.X, pady=(8, 12))
        tk.Label(perm_frame, text="权限说明:", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=8, pady=(6, 2))
        self.perm_label = tk.Label(perm_frame, text="", font=DarkTheme.FONT_SMALL,
                                   fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_CARD, justify=tk.LEFT)
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

    def _do_add_user(self, refs, win):
        """执行添加用户"""
        username = refs['username'].get().strip()
        password = refs['password'].get().strip()
        role = refs['role_var'].get()
        
        if not username or not password:
            messagebox.showwarning("提示", "用户名和密码不能为空")
            return
        
        if self.user_mgr.add_user(username, password, role):
            messagebox.showinfo("成功", f"用户 {username} 已创建")
            win.destroy()
            self._load_users()
        else:
            messagebox.showerror("错误", f"用户 {username} 已存在")

    def _reset_password_dialog(self):
        """重置密码对话框"""
        selected = self.tree.selection()
        if not selected:
            messagebox.showinfo("提示", "请先选择要重置密码的用户")
            return
        iid = selected[0]
        username = self.tree.item(iid, "values")[1]
        
        if username == "admin":
            messagebox.showwarning("提示", "管理员密码请通过修改配置文件重置")
            return
        
        new_pwd = simpledialog.askstring("重置密码", f"请输入用户 {username} 的新密码:",
                                          show="●", parent=self)
        if not new_pwd or not new_pwd.strip():
            return
        
        if self.user_mgr.update_user_password(username, new_pwd.strip()):
            messagebox.showinfo("成功", f"用户 {username} 密码已重置")
            self._load_users()
        else:
            messagebox.showerror("错误", "密码重置失败")

    def _toggle_user_dialog(self):
        """启用/禁用用户"""
        selected = self.tree.selection()
        if not selected:
            messagebox.showinfo("提示", "请先选择要操作的用户")
            return
        iid = selected[0]
        username = self.tree.item(iid, "values")[1]
        
        if username == "admin":
            messagebox.showwarning("提示", "不能禁用管理员账号")
            return
        
        if self.user_mgr.toggle_user_active(username):
            user = next((u for u in self.user_mgr.get_all_users() if u["username"] == username), None)
            status = "启用" if user and user.get("is_active", True) else "禁用"
            messagebox.showinfo("成功", f"用户 {username} 已{status}")
            self._load_users()
        else:
            messagebox.showerror("错误", "操作失败")

    def _delete_user_dialog(self):
        """删除用户确认"""
        selected = self.tree.selection()
        if not selected:
            messagebox.showinfo("提示", "请先选择要删除的用户")
            return
        iid = selected[0]
        username = self.tree.item(iid, "values")[1]
        
        if username == "admin":
            messagebox.showwarning("提示", "不能删除管理员账号")
            return
        
        if messagebox.askyesno("确认删除", f"确定删除用户 {username} 吗？"):
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
