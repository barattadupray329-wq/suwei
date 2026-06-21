#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""系统设置模块。"""

import os
import shutil
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox
from tkinter import ttk

from core.runtime_settings import clear_data_dir_override, get_data_dir_override, set_data_dir_override
from theme.colors import DarkTheme


class SystemSettingsFrame(tk.Frame):
    """系统设置页面。"""

    def __init__(self, parent, data_manager, root=None):
        super().__init__(parent, bg=DarkTheme.BG_PRIMARY)
        self.data_manager = data_manager
        self.root = root
        self.current_dir_var = tk.StringVar()
        self.backup_status_var = tk.StringVar(value="暂无备份记录")
        self.note_var = tk.StringVar(value="建议先备份，再更改数据位置。")
        self.backup_dir_var = tk.StringVar(value="默认备份到当前数据目录")
        self._build_ui()
        self._refresh_state()

    def _default_dir(self):
        return str((Path(__file__).parent.parent / "租赁数据").resolve())

    def _current_dir(self):
        return get_data_dir_override() or self._default_dir()

    def _data_file_name(self):
        db_path = getattr(self.data_manager, "db_file", None)
        if db_path:
            return Path(db_path).name
        return "rental_data.db"

    def _build_ui(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=18)

        header = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        header.pack(fill=tk.X, pady=(0, 14))
        tk.Label(header, text="⚙️ 系统设置", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)
        tk.Label(header, text="数据位置、备份与恢复", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(10, 0), pady=(10, 0))

        info_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        info_row.pack(fill=tk.X, pady=(0, 12))
        self._stat_card(info_row, "当前数据目录", self.current_dir_var, DarkTheme.ACCENT_CYAN)
        self._stat_card(info_row, "最近备份", self.backup_status_var, DarkTheme.ACCENT_GREEN)
        self._stat_card(info_row, "备份目录", self.backup_dir_var, DarkTheme.ACCENT_YELLOW)

        body = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        body.pack(fill=tk.BOTH, expand=True)

        left = tk.Frame(body, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 8))
        right = tk.Frame(body, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        right.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(8, 0))

        tk.Label(left, text="数据与备份", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=14, pady=(12, 8))

        self.dir_label = tk.Label(left, text="", font=("Consolas", 9), fg=DarkTheme.TEXT_PRIMARY,
                                  bg=DarkTheme.BG_INPUT, justify=tk.LEFT, wraplength=700,
                                  padx=10, pady=8)
        self.dir_label.pack(fill=tk.X, padx=14, pady=(0, 10))

        btn_row = tk.Frame(left, bg=DarkTheme.BG_CARD)
        btn_row.pack(fill=tk.X, padx=14, pady=(0, 14))
        self._button(btn_row, "📂 更改数据位置", self._change_data_dir, DarkTheme.ACCENT_BLUE)
        self._button(btn_row, "💾 立即备份", self._backup_now, DarkTheme.ACCENT_GREEN)
        self._button(btn_row, "🗂️ 打开数据目录", self._open_data_dir, DarkTheme.ACCENT_YELLOW)
        self._button(btn_row, "↻ 恢复默认", self._reset_data_dir, DarkTheme.BG_HOVER)

        status_box = tk.Frame(left, bg=DarkTheme.BG_CARD)
        status_box.pack(fill=tk.X, padx=14, pady=(0, 14))
        tk.Label(status_box, text="状态提示", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_PURPLE, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, pady=(0, 8))
        tk.Label(status_box, textvariable=self.note_var, font=DarkTheme.FONT_NORMAL,
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_CARD, justify=tk.LEFT,
                 wraplength=680).pack(anchor=tk.W)

        backup_tip = tk.Frame(left, bg=DarkTheme.BG_CARD)
        backup_tip.pack(fill=tk.X, padx=14, pady=(0, 14))
        tk.Label(backup_tip, text="备份说明", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_GREEN, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, pady=(0, 8))
        tk.Label(backup_tip, text="备份会使用当前数据目录；如果更换过目录，请先确认已切换到正确位置。",
                 font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_CARD,
                 justify=tk.LEFT, wraplength=620).pack(anchor=tk.W)

        tk.Label(left, text="说明", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_PURPLE, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=14, pady=(0, 8))
        for text in [
            "更改位置会复制现有数据文件到新目录。",
            "建议在迁移前先执行一次立即备份。",
            "恢复默认会回到程序默认的数据目录。",
        ]:
            tk.Label(left, text="• " + text, font=DarkTheme.FONT_NORMAL,
                     fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_CARD,
                     justify=tk.LEFT, wraplength=620).pack(anchor=tk.W, padx=14, pady=4)

        tk.Label(right, text="设置建议", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_GREEN, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=14, pady=(12, 8))
        suggestions = [
            ("1", "把数据目录固定到一个长期存在的磁盘路径。"),
            ("2", "切换目录后建议重启软件确保生效。"),
            ("3", "如果你准备迁移电脑，先做一次完整备份。"),
            ("4", "不要把数据放到容易被清理的临时目录。"),
        ]
        for idx, text in suggestions:
            row = tk.Frame(right, bg=DarkTheme.BG_CARD)
            row.pack(fill=tk.X, padx=14, pady=6)
            tk.Label(row, text=idx, width=3, font=DarkTheme.FONT_BUTTON,
                     fg="white", bg=DarkTheme.ACCENT_BLUE).pack(side=tk.LEFT)
            tk.Label(row, text=text, font=DarkTheme.FONT_NORMAL,
                     fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_CARD,
                     justify=tk.LEFT, wraplength=680).pack(side=tk.LEFT, padx=10)

    def _stat_card(self, parent, title, var, color):
        card = tk.Frame(parent, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4)
        tk.Label(card, text=title, font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=14, pady=(12, 4))
        tk.Label(card, textvariable=var, font=DarkTheme.FONT_NORMAL,
                 fg=color, bg=DarkTheme.BG_CARD, justify=tk.LEFT, wraplength=260).pack(anchor=tk.W, padx=14, pady=(0, 12))

    def _button(self, parent, text, command, color):
        btn = tk.Button(parent, text=text, font=DarkTheme.FONT_BUTTON, fg="white", bg=color,
                        relief=tk.FLAT, cursor="hand2", command=command, padx=12, pady=7)
        btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(btn, color)
        return btn

    def _refresh_state(self):
        current = self._current_dir()
        self.current_dir_var.set(current)
        self.dir_label.config(text=current)
        last_backup = self.data_manager.data.get("settings", {}).get("last_backup", "")
        if last_backup:
            self.backup_status_var.set(last_backup)
        else:
            self.backup_status_var.set("暂无备份记录")
        self.backup_dir_var.set(self._current_dir())
        self.note_var.set("建议先备份，再更改数据位置；切换后请重启应用。")

    def _backup_now(self):
        try:
            result = self.data_manager.backup_data()
            if result:
                last = self.data_manager.data.get("settings", {}).get("last_backup", "")
                self.backup_status_var.set(last or datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                messagebox.showinfo("成功", f"备份完成\n\n{result}")
            else:
                messagebox.showerror("失败", "备份未成功，请检查权限或路径。")
        except Exception as exc:
            messagebox.showerror("错误", f"备份失败：{exc}")

    def _open_data_dir(self):
        path = self._current_dir()
        try:
            Path(path).mkdir(parents=True, exist_ok=True)
            if hasattr(os, "startfile"):
                os.startfile(path)
            else:
                messagebox.showinfo("提示", path)
        except Exception as exc:
            messagebox.showerror("错误", f"打开目录失败：{exc}")

    def _change_data_dir(self):
        new_dir = filedialog.askdirectory(title="选择数据保存位置", parent=self.root or self)
        if not new_dir:
            return

        new_path = Path(new_dir)
        new_path.mkdir(parents=True, exist_ok=True)
        old_db_path = Path(self.data_manager.db_file)
        new_db_path = new_path / self._data_file_name()

        try:
            if old_db_path.exists():
                shutil.copy2(old_db_path, new_db_path)
            set_data_dir_override(str(new_path))
            self._refresh_state()
            messagebox.showinfo("成功", f"数据目录已更新\n\n{new_path}\n\n请重启应用以生效。")
        except Exception as exc:
            messagebox.showerror("错误", f"设置失败：{exc}")

    def _reset_data_dir(self):
        if not messagebox.askyesno("确认", "恢复默认数据目录会放弃当前自定义路径，确定继续吗？"):
            return
        clear_data_dir_override()
        self._refresh_state()
        messagebox.showinfo("成功", "已恢复默认数据目录，请重启应用以生效。")
