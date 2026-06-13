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
    """系统入口 — 单根窗口架构，登录窗口原地变身为应用主窗口"""
    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)

    # 登录窗口作为唯一根窗口启动
    from core.auth import LoginWindow
    login = LoginWindow(auth_manager=auth)
    username, user_role = login.run()  # 返回 (username, role) 或 (None, None)

    # 登录成功：将登录根窗口原地改造为主应用窗口
    if username:
        from core.app import MainWindow
        app = MainWindow(username, dm, root=login.root)  # 复用同一根窗口
        app.run()


if __name__ == "__main__":
    main()
