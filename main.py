#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
速维电脑租赁管理系统 V2 - 主启动入口
单根窗口架构：隐藏根窗口 + Toplevel 登录，彻底消除黑框闪烁
"""

import sys
import os
import socket
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
from modules.nutstore_sync import init_sync_manager, get_sync_manager
from modules.splash_screen import show_splash_with_sync
from modules.sync_server_manager import init_sync_server, get_sync_server_manager
from modules.client_setup import is_server_machine, run_client_setup
from modules.mode_selection import get_selected_mode, set_mode


def main():
    """系统入口 — 单根窗口直出架构，零窗口切换 = 零闪烁"""
    
    # 1. 选择启动模式 (Server 或 Client)
    selected_role = get_selected_mode()
    
    # 客户端自动配置 (仅 Client 模式需要)
    if selected_role == "client":
        if not run_client_setup():
            print("❌ 客户端配置失败，退出程序")
            sys.exit(0)
    
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

    # 2. 根据模式执行初始化
    sync_manager = None
    sync_success = True  # 客户端默认跳过同步，直接成功
    current_hostname = socket.gethostname().upper()
    is_server = current_hostname == "SW02" or selected_role == "server"
    
    if is_server:
        # --- Server 模式 (SW02)：坚果云同步 ---
        project_root = os.path.dirname(os.path.abspath(__file__))
        sync_manager = init_sync_manager(project_root)
        
        # 显示启动屏幕并等待坚果云数据同步
        root.deiconify()
        root.update_idletasks()
        sync_success = show_splash_with_sync(root, sync_manager, timeout=30)
        
        if not sync_success:
            import tkinter.messagebox as messagebox
            root.update_idletasks()
            root.lift()
            root.attributes('-topmost', True)
            root.attributes('-topmost', False)
            continue_anyway = messagebox.askyesno(
                "同步失败",
                "数据同步失败。是否仍然继续？\n\n注意：继续运行可能导致数据不一致。",
                icon="warning"
            )
            if not continue_anyway:
                root.destroy()
                return
        
        # 安全隐藏根窗口
        try:
            root.withdraw()
        except tk.TclError:
            # 根窗口已被销毁，重新创建
            root = tk.Tk()
            root.configure(bg=DarkTheme.BG_PRIMARY)
            root.geometry("1280x760")
            root.title("速维电脑租赁管理系统 V2")
            root.minsize(1024, 640)
    else:
        # --- Client 模式：直接跳过坚果云同步，进入客户端设置 ---
        pass

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
        
        # Server 模式专属任务：坚果云监控 + HTTP 服务器
        if selected_role == "server":
            # 启动后台坚果云监控
            if sync_manager:
                sync_manager.start_monitoring(lambda: None)
            
            # 启动 HTTP 同步服务器，向其他电脑广播
            logger.info("初始化 HTTP 同步服务器...")
            project_root = os.path.dirname(os.path.abspath(__file__))
            sync_server = init_sync_server(project_root)
            if sync_server.is_running:
                server_url = sync_server.get_server_url()
                logger.info(f"✅ HTTP 同步服务器已启动: {server_url}")
        
        root.update_idletasks()
        app.run()
    else:
        root.destroy()


if __name__ == "__main__":
    main()
