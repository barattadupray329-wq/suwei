#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
速维电脑租赁管理系统 V2 - 主启动入口
单根窗口架构：隐藏根窗口 + Toplevel 登录，彻底消除黑框闪烁
"""

import sys
import os
import tkinter as tk

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.data_manager import DataManager
from core.auth import LoginWindow, AuthManager


def main():
    """系统入口 — 单根窗口架构"""
    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)

    # 1. 创建唯一根窗口，并立即隐藏（此时无可见窗口，绝无黑框）
    root = tk.Tk()
    root.withdraw()

    # 2. 登录窗口挂载在隐藏根窗口上
    login = LoginWindow(parent=root, auth_manager=auth)
    login.run()  # 阻塞等待，直到登录窗口销毁

    # 3. 登录窗口已销毁，检查登录结果
    if login.result:
        username, user_role = login.result
        from core.app import MainWindow
        from theme.colors import DarkTheme

        # 配置根窗口属性
        root.configure(bg=DarkTheme.BG_PRIMARY)
        root.title("速维电脑租赁管理系统 V2")
        root.minsize(1024, 640)

        # 4. 在根窗口中构建主应用 UI（此时根窗口仍是隐藏的）
        app = MainWindow(username, dm, root=root)

        # 5. 所有 UI 渲染完成后，才显示根窗口
        root.update_idletasks()
        root.deiconify()

        # 6. 进入主循环
        app.run()


if __name__ == "__main__":
    main()
