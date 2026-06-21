#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
混合模式运行器
- exe 可以加载最新的源代码
- 适合开发过程中频繁更新
- 无需每次都重新打包
"""

import sys
import os

if os.name == "nt":
    try:
        import ctypes
    except Exception:
        ctypes = None

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.code_loader import init_code_loader, get_code_loader


def hide_console_window():
    if os.name != "nt" or ctypes is None:
        return
    try:
        hwnd = ctypes.windll.kernel32.GetConsoleWindow()
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 0)
    except Exception:
        pass


def main():
    """主函数 - 混合模式启动"""
    hide_console_window()
    project_root = os.path.dirname(os.path.abspath(__file__))
    
    # 初始化代码加载器
    code_loader = init_code_loader(project_root)
    
    # 检查代码更新
    print("检查代码更新...")
    if code_loader.check_code_updates():
        print("✓ 发现代码更新，自动加载最新版本")
        # 保存最新的代码清单
        code_loader.save_code_manifest()
        # 重新加载所有模块
        code_loader.reload_all_modules()
    else:
        print("✓ 代码已是最新版本")
    
    # 生成代码清单供 exe 使用
    code_loader.save_code_manifest()
    
    # 导入并运行主应用
    print("启动应用...")
    from main import main as run_main
    run_main()


if __name__ == "__main__":
    main()
