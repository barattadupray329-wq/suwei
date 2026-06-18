#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
速维电脑租赁管理系统 V2 - 单机版主启动入口
单根窗口架构：隐藏根窗口 + Toplevel 登录，彻底消除黑框闪烁
"""

import sys
import os
import tkinter as tk
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.data_manager import DataManager
from core.auth import AuthManager
from theme.colors import DarkTheme


def main():
    """系统入口 — 单根窗口直出架构，零窗口切换 = 零闪烁"""
    
    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)

    # 创建唯一的根窗口
    root = tk.Tk()
    # 立即配置背景色，防止默认黑色露出
    root.configure(bg=DarkTheme.BG_PRIMARY)
    root.geometry("1280x760")
    root.title("速维电脑租赁管理系统 V2")
    root.minsize(1024, 640)
    # 立即隐藏，等待 UI 完全构建
    root.withdraw()

    # 创建主应用框架容器（背景色与根窗口完全一致）
    app_container = tk.Frame(root, bg=DarkTheme.BG_PRIMARY)
    app_container.pack(fill=tk.BOTH, expand=True)

    # 先显示登录界面
    from core.auth import LoginFrame
    login_frame = LoginFrame(app_container, auth)
    login_frame.pack(fill=tk.BOTH, expand=True)

    # 关键：UI 构建完成后再显示窗口，确保用户直接看到完整的登录界面
    root.update_idletasks()
    root.deiconify()

    # 主窗口居中显示
    root.update_idletasks()
    w = root.winfo_width()
    h = root.winfo_height()
    ws = root.winfo_screenwidth()
    hs = root.winfo_screenheight()
    root.geometry(f"{w}x{h}+{(ws - w) // 2}+{(hs - h) // 2}")

    # 等待登录完成
    root.wait_variable(login_frame.login_result)
    result = login_frame.login_result.get()

    # 无论登录成功或取消，都清理登录界面
    login_frame.destroy()
    for widget in app_container.winfo_children():
        widget.destroy()

    if result and result != "cancel":
        import json
        data = json.loads(result)
        username = data["username"]
        user_role = data["role"]
        from core.app import MainWindow

        # 在同一个容器中创建主界面（无缝切换，无窗口状态变化）
        app = MainWindow(username, dm, root=root, content_frame=app_container)
        
        root.update_idletasks()
        app.run()
    else:
        root.destroy()


if __name__ == "__main__":
    main()
