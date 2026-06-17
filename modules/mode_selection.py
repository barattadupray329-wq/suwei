#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
启动模式选择模块
- 允许用户选择是作为“主电脑”还是“客户端”启动
"""

import tkinter as tk
from tkinter import ttk
from theme.colors import DarkTheme
import json
from pathlib import Path

CONFIG_FILE = Path(__file__).parent.parent / "sync_client_config.json"

def get_selected_mode():
    """
    显示模式选择对话框。
    如果配置文件中已记录模式，则自动使用该模式。
    否则弹出窗口让用户选择。
    
    返回: "server" 或 "client"
    """
    # 尝试读取上次选择
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                if config.get("role") == "client":
                    return "client"
                elif config.get("role") == "server":
                    return "server"
        except:
            pass

    # 弹出选择窗口
    dialog = tk.Tk()
    dialog.title("选择启动模式")
    dialog.geometry("450x280")
    dialog.resizable(False, False)
    
    # 居中
    dialog.update_idletasks()
    w = dialog.winfo_screenwidth()
    h = dialog.winfo_screenheight()
    x = (w - 450) // 2
    y = (h - 280) // 2
    dialog.geometry(f"450x280+{x}+{y}")
    
    # 标题
    tk.Label(dialog, text="请选择本机的运行角色", font=("Microsoft YaHei", 14, "bold"), fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(pady=(20, 10))
    
    selected_mode = {"value": None}
    
    def select(mode):
        selected_mode["value"] = mode
        dialog.destroy()
        
    # 服务器按钮
    btn_server = tk.Button(dialog, text="🖥️ 主电脑 (SW02)\n启动同步服务器，管理数据", font=("Microsoft YaHei", 12), 
                           bg=DarkTheme.ACCENT_BLUE, fg="white", relief=tk.FLAT, cursor="hand2",
                           command=lambda: select("server"), padx=20, pady=15, width=35)
    btn_server.pack(pady=5)
    DarkTheme.bind_hover(btn_server, DarkTheme.darken(DarkTheme.ACCENT_BLUE, 15))
    
    # 客户端按钮
    btn_client = tk.Button(dialog, text="💻 客户端 / 其他电脑\n连接主电脑，同步数据", font=("Microsoft YaHei", 12), 
                           bg=DarkTheme.ACCENT_PURPLE, fg="white", relief=tk.FLAT, cursor="hand2",
                           command=lambda: select("client"), padx=20, pady=15, width=35)
    btn_client.pack(pady=5)
    DarkTheme.bind_hover(btn_client, DarkTheme.darken(DarkTheme.ACCENT_PURPLE, 15))
    
    # 提示
    tk.Label(dialog, text="此选择将记住，下次启动自动应用", font=("Microsoft YaHei", 9), fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(pady=(10, 0))
    
    # 锁定焦点
    dialog.grab_set()
    dialog.wait_window()
    
    # 默认回退到 server
    return selected_mode.get("value") or "server"

def set_mode(mode):
    """保存选择的模式"""
    config = {}
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
        except:
            pass
    
    config["role"] = mode
    
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
