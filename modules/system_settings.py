#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
系统设置模块 - 允许用户配置数据保存位置
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import shutil
from pathlib import Path
from theme.colors import DarkTheme
from core.runtime_settings import get_data_dir_override, set_data_dir_override, clear_data_dir_override


class SystemSettingsFrame(tk.Frame):
    """系统设置框架"""

    def __init__(self, parent, data_manager, root=None):
        super().__init__(parent, bg=DarkTheme.BG_PRIMARY)
        self.data_manager = data_manager
        self.root = root
        self._build_ui()

    def _build_ui(self):
        """构建UI"""
        # 标题
        title = tk.Label(
            self, text="⚙️  系统设置", font=DarkTheme.FONT_TITLE,
            fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY
        )
        title.pack(anchor=tk.W, padx=20, pady=(16, 12))

        # 主容器
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=16)

        # ─────── 数据保存位置 ───────
        section = tk.Label(
            main, text="📁 数据保存位置", font=DarkTheme.FONT_SUBTITLE,
            fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY
        )
        section.pack(anchor=tk.W, pady=(0, 10))

        # 当前位置显示
        location_frame = tk.Frame(main, bg=DarkTheme.BG_CARD, relief=tk.FLAT)
        location_frame.pack(fill=tk.X, pady=(0, 12))
        location_frame.configure(height=60)

        tk.Label(
            location_frame, text="当前数据目录：", font=DarkTheme.FONT_LABEL,
            fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD
        ).pack(anchor=tk.W, padx=12, pady=(8, 2))

        current_dir = get_data_dir_override()
        if not current_dir:
            # 获取默认数据目录
            default_db_path = Path(__file__).parent.parent / "rental_data.json"
            current_dir = str(default_db_path.parent)

        self.dir_label = tk.Label(
            location_frame, text=current_dir, font=("Consolas", 9),
            fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_INPUT,
            wraplength=600, justify=tk.LEFT
        )
        self.dir_label.pack(fill=tk.X, padx=12, pady=4)
        tk.Label(
            location_frame, text="", font=DarkTheme.FONT_SMALL,
            fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_CARD
        ).pack(anchor=tk.W, padx=12, pady=(0, 8))

        # 按钮行
        btn_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_frame.pack(fill=tk.X, pady=(0, 16))

        browse_btn = tk.Button(
            btn_frame, text="📂 浏览并更改位置", font=DarkTheme.FONT_BUTTON,
            fg="white", bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
            command=self._change_data_dir, padx=14, pady=8
        )
        browse_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(browse_btn, DarkTheme.ACCENT_BLUE)

        reset_btn = tk.Button(
            btn_frame, text="↻ 恢复默认", font=DarkTheme.FONT_BUTTON,
            fg="white", bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
            command=self._reset_data_dir, padx=14, pady=8
        )
        reset_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(reset_btn, DarkTheme.BG_HOVER)

        # 信息提示
        info = tk.Label(
            main, text="💡 更改位置后，现有数据库文件将自动复制到新位置，需要重启应用。",
            font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY,
            wraplength=600, justify=tk.LEFT
        )
        info.pack(anchor=tk.W, pady=(0, 16))

        # 分隔线
        sep = tk.Frame(main, bg=DarkTheme.BORDER_COLOR, height=1)
        sep.pack(fill=tk.X, pady=(0, 16))

        # 关于部分
        about = tk.Label(
            main, text="ℹ️  关于本软件", font=DarkTheme.FONT_SUBTITLE,
            fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY
        )
        about.pack(anchor=tk.W, pady=(0, 10))

        about_text = tk.Label(
            main, text="速维电脑租赁管理系统 v2.0\n单机版 - 本地数据存储\n© 2024 All Rights Reserved",
            font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY,
            justify=tk.LEFT
        )
        about_text.pack(anchor=tk.W)

    def _change_data_dir(self):
        """更改数据保存位置"""
        new_dir = filedialog.askdirectory(
            title="选择数据保存位置",
            parent=self.root
        )
        if not new_dir:
            return

        new_path = Path(new_dir)
        if not new_path.exists():
            new_path.mkdir(parents=True, exist_ok=True)

        # 复制现有数据库文件
        old_db_path = Path(self.data_manager.db_file)
        new_db_path = new_path / old_db_path.name

        try:
            if old_db_path.exists():
                shutil.copy2(old_db_path, new_db_path)
                messagebox.showinfo(
                    "成功",
                    f"数据已复制到：\n{new_db_path}\n\n请重启应用以生效。"
                )
            else:
                messagebox.showinfo(
                    "成功",
                    f"位置已设置为：\n{new_dir}\n\n请重启应用以生效。"
                )

            # 保存设置
            set_data_dir_override(str(new_path))
            self.dir_label.config(text=str(new_path))

        except Exception as e:
            messagebox.showerror("错误", f"设置失败：{e}")

    def _reset_data_dir(self):
        """恢复默认位置"""
        if messagebox.askyesno("确认", "确定要恢复默认数据位置吗？"):
            clear_data_dir_override()
            default_db_path = Path(__file__).parent.parent / "rental_data.json"
            default_dir = str(default_db_path.parent)
            self.dir_label.config(text=default_dir)
            messagebox.showinfo("成功", "已恢复默认位置，请重启应用以生效。")
