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
    """系统入口 — 登录优先架构，认证后才创建主窗口"""
    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)

    login_result = {"username": None, "role": None}

    def on_login_success(username: str, user_role: str = "admin"):
        """登录成功回调"""
        login_result["username"] = username
        login_result["role"] = user_role

    # 登录窗口作为独立根窗口（无黑框问题）
    from core.auth import LoginWindow
    login = LoginWindow(auth_manager=auth, on_login_success=on_login_success)
    login.run()

    # 登录窗口已销毁，认证通过则创建主应用
    if login_result["username"]:
        from core.app import MainWindow
        app = MainWindow(login_result["username"], dm)
        app.run()


if __name__ == "__main__":
    main()
