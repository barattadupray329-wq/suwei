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



def main():
    """系统入口"""
    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)

    def on_login_success(username: str):
        """登录成功后启动主应用"""
        from core.app import MainWindow
        # 使用闭包捕获 dm，避免作用域错误
        app = MainWindow(username, dm)
        app.run()
    
    # 显示登录窗口
    login = LoginWindow(auth, on_login_success)
    login.run()


if __name__ == "__main__":
    main()
