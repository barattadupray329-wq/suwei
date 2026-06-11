#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
速维电脑租赁管理系统 V2 - 主启动入口
全新深色主题重构版本
"""

import sys
import os

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.data_manager import DataManager
from core.auth import LoginWindow, AuthManager


def on_login_success(username: str):
    """登录成功后启动主应用"""
    from core.app import MainWindow
    # 创建主应用并共享数据管理器
    app = MainWindow(username, dm)
    app.run()


def main():
    """系统入口"""
    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)
    
    # 显示登录窗口
    login = LoginWindow(auth, on_login_success)
    login.run()


if __name__ == "__main__":
    main()
