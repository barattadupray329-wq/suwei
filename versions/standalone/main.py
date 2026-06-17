#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单机版主入口 - 本地存储，无网络同步
"""

import sys
import os
import tkinter as tk
import logging
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import config
from core.data_manager import DataManager
from core.auth import AuthManager
from theme.colors import DarkTheme

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """单机版主入口"""
    logger.info(f"启动 {config.VERSION_DISPLAY}")
    
    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)
    
    # 创建主窗口
    root = tk.Tk()
    root.configure(bg=DarkTheme.BG_PRIMARY)
    root.geometry("1280x760")
    root.title(config.VERSION_DISPLAY)
    root.minsize(1024, 640)
    root.withdraw()
    
    # 显示登录界面
    app_container = tk.Frame(root, bg=DarkTheme.BG_PRIMARY)
    app_container.pack(fill=tk.BOTH, expand=True)
    
    from core.auth import LoginFrame
    login_frame = LoginFrame(app_container, auth)
    login_frame.pack(fill=tk.BOTH, expand=True)
    
    root.update_idletasks()
    root.deiconify()
    root.wait_variable(login_frame.login_result)
    result = login_frame.login_result.get()
    
    login_frame.destroy()
    for widget in app_container.winfo_children():
        widget.destroy()
    
    if result and result != "cancel":
        import json
        data = json.loads(result)
        username = data["username"]
        user_role = data["role"]
        from core.app import MainWindow
        
        # 创建主界面
        app = MainWindow(username, dm, root=root, content_frame=app_container)
        root.update_idletasks()
        app.run()
    else:
        root.destroy()


if __name__ == "__main__":
    main()
