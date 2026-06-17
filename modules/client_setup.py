#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
客户端自动配置模块
- 检查是否为主机 (SW02)
- 如果不是，尝试自动发现服务器
- 发现失败则弹窗请求手动输入 IP
"""

import json
import socket
import tkinter as tk
from pathlib import Path
from tkinter import messagebox

from modules.server_discovery import ServerDiscovery

# 配置文件路径 (与项目根目录同级或根目录下)
CONFIG_FILE = Path(__file__).parent.parent / "sync_client_config.json"


def is_server_machine():
    """判断当前机器是否为主服务器 (SW02)"""
    return socket.gethostname().upper() == "SW02"


def run_client_setup():
    """
    运行客户端配置流程。
    如果配置文件存在，直接返回 True。
    否则尝试自动发现，失败则弹窗。
    """
    if CONFIG_FILE.exists():
        return True

    print("🔍 正在自动发现服务器 SW02...")
    try:
        discovery = ServerDiscovery()
        # 尝试发现 5 秒
        ip = discovery.start_discovery(timeout=5, target_computer_name="SW02")

        if ip:
            url = f"http://{ip}:9999"
            _save_config(url)
            print(f"✅ 自动发现并配置成功: {url}")
            return True
    except Exception as e:
        print(f"⚠️ 自动发现过程出错: {e}")

    # 自动发现失败，弹窗请求手动输入
    return _show_manual_dialog()


def _save_config(url):
    """保存配置到 JSON 文件"""
    config = {
        "server_url": url,
        "check_interval": 60,
        "auto_update": True,
        "data_sync_enabled": True
    }
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def _show_manual_dialog():
    """显示手动输入 IP 的对话框"""
    dialog = tk.Tk()
    dialog.title("配置服务器地址")
    dialog.geometry("400x200")
    dialog.resizable(False, False)

    # 居中
    dialog.update_idletasks()
    w = dialog.winfo_screenwidth()
    h = dialog.winfo_screenheight()
    x = (w - 400) // 2
    y = (h - 200) // 2
    dialog.geometry(f"400x200+{x}+{y}")

    tk.Label(dialog, text="⚠️ 未自动发现服务器 SW02", font=("Microsoft YaHei", 12, "bold"), fg="red").pack(pady=(20, 5))
    tk.Label(dialog, text="请输入主电脑的 IP 地址:", font=("Microsoft YaHei", 10)).pack(pady=5)

    ip_var = tk.StringVar()
    entry = tk.Entry(dialog, textvariable=ip_var, width=25, font=("Consolas", 12), justify='center')
    entry.pack(pady=5)
    entry.insert(0, "192.168.3.")  # 默认前缀
    entry.focus_set()

    # 按钮容器
    btn_frame = tk.Frame(dialog)
    btn_frame.pack(pady=15)

    result = {"success": False}

    def on_ok():
        ip = ip_var.get().strip()
        if not ip or ip == "192.168.3.":
            messagebox.showwarning("输入错误", "请输入有效的 IP 地址", parent=dialog)
            return
        
        if not ip.startswith("http"):
            url = f"http://{ip}:9999"
        else:
            url = ip
            
        _save_config(url)
        result["success"] = True
        dialog.destroy()

    def on_cancel():
        dialog.destroy()

    tk.Button(btn_frame, text="确定并连接", command=on_ok, bg="#4CAF50", fg="white", font=("Microsoft YaHei", 10), width=12).pack(side=tk.LEFT, padx=5)
    tk.Button(btn_frame, text="取消", command=on_cancel, font=("Microsoft YaHei", 10), width=12).pack(side=tk.LEFT, padx=5)

    # 绑定回车键
    dialog.bind('<Return>', lambda e: on_ok())

    dialog.mainloop()
    return result["success"]
