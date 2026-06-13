#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
速维电脑租赁管理系统 V2 - 主启动入口
全新深色主题重构版本
"""

import sys
import os

import tkinter as tk

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.data_manager import DataManager
from core.auth import LoginWindow, AuthManager



def main():
    """系统入口 — 单窗口模式，避免登录闪烁"""
    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)

    # 创建唯一根窗口
    root = tk.Tk()
    root.withdraw()  # 先隐藏根窗口，避免显示空白/黑色窗口

    def on_login_success(username: str, user_role: str = "admin"):
        """登录成功后启动主应用"""
        from core.app import MainWindow
        root.deiconify()  # 显示主窗口
        app = MainWindow(username, dm, root=root)
        app.run()
    
    # 显示登录对话框（挂载在隐藏根窗口上）
    from core.auth import LoginWindow
    login = LoginWindow(parent=root, auth_manager=auth, on_login_success=on_login_success)
    login.run()


if __name__ == "__main__":
    main()
