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
from PIL import Image, ImageTk


def _center_window(window: tk.Toplevel | tk.Tk, width: int, height: int, parent: tk.Misc | None = None):
    """将窗口居中到父窗口或屏幕中心。"""
    window.update_idletasks()
    if parent is not None:
        parent.update_idletasks()
        px = parent.winfo_rootx()
        py = parent.winfo_rooty()
        pw = parent.winfo_width()
        ph = parent.winfo_height()
        x = px + max((pw - width) // 2, 0)
        y = py + max((ph - height) // 2, 0)
    else:
        sw = window.winfo_screenwidth()
        sh = window.winfo_screenheight()
        x = max((sw - width) // 2, 0)
        y = max((sh - height) // 2, 0)
    window.geometry(f"{width}x{height}+{x}+{y}")

if os.name == "nt":
    try:
        import ctypes
    except Exception:
        ctypes = None

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


def _should_run_web() -> bool:
    return os.environ.get("SUWEI_WEB", "0").lower() in {"1", "true", "yes", "on"}


def hide_console_window():
    """尽量隐藏 Windows 控制台窗口。"""
    if os.name != "nt" or ctypes is None:
        return
    try:
        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0)
    except Exception:
        pass


def main():
    """系统入口 — 桌面版与 Web 版统一入口。"""

    if _should_run_web():
        from web_app import run
        host = os.environ.get("SUWEI_WEB_HOST", "0.0.0.0")
        port = int(os.environ.get("SUWEI_WEB_PORT", "8000"))
        run(host=host, port=port)
        return

    hide_console_window()

    # 创建唯一的根窗口，先隐藏并透明化，避免初始绘制闪烁
    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes("-alpha", 0.0)
    except Exception:
        pass
    root.configure(bg=DarkTheme.BG_PRIMARY)
    screen_w = root.winfo_screenwidth()
    screen_h = root.winfo_screenheight()
    win_w = min(1280, max(1024, screen_w - 80))
    win_h = min(760, max(640, screen_h - 120))
    root.geometry(f"{win_w}x{win_h}")
    root.title("速维电脑租赁管理系统")
    root.minsize(min(1024, max(900, screen_w - 120)), min(640, max(600, screen_h - 160)))
    root.resizable(True, True)
    root.state("normal")
    try:
        # 让窗口在高 DPI 屏幕上按系统缩放显示，避免界面过小
        if os.name == "nt":
            root.tk.call("tk", "scaling", root.winfo_fpixels("1i") / 72.0)
    except Exception:
        pass
    icon_dir = os.path.dirname(os.path.abspath(__file__))
    icon_png = os.path.join(icon_dir, "DOU.png")
    icon_ico = os.path.join(icon_dir, "douyu_icon.ico")
    try:
        if os.path.exists(icon_png):
            icon_img = tk.PhotoImage(file=icon_png)
            root.iconphoto(True, icon_img)
            root._icon_img = icon_img  # 保持引用，避免图标被回收
        elif os.path.exists(icon_ico):
            root.iconbitmap(icon_ico)
    except Exception:
        pass

    # 初始化数据管理
    dm = DataManager()
    auth = AuthManager(dm)

    # 创建主应用框架容器（背景色与根窗口完全一致）
    app_container = tk.Frame(root, bg=DarkTheme.BG_PRIMARY)
    app_container.pack(fill=tk.BOTH, expand=True)

    # 先显示登录界面，等所有内容准备好后再一次性展示
    from core.auth import LoginFrame
    login_frame = LoginFrame(app_container, auth)
    login_frame.pack(fill=tk.BOTH, expand=True)

    root.update_idletasks()
    root.geometry("1280x760")

    def show_window():
        try:
            root.attributes("-alpha", 1.0)
        except Exception:
            pass
        root.deiconify()

    # 关键：延迟到控件布局稳定后再显示，减少闪烁
    root.after(50, show_window)

    # 主窗口居中显示
    _center_window(root, root.winfo_width() or 1280, root.winfo_height() or 760)

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
