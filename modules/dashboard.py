#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""仪表板首页 — 数据总览"""

import tkinter as tk
from tkinter import ttk
from theme.colors import DarkTheme
from datetime import datetime


class DashboardFrame(ttk.Frame):
    """仪表板"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)
        self.data_manager = data_manager
        self.configure(style="Main.TFrame")
        self._build()

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # 标题
        tk.Label(
            main, text="📊 数据总览",
            font=DarkTheme.FONT_TITLE,
            fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY
        ).pack(anchor=tk.W, pady=(0, 20))

        # 统计卡片网格 (2x3)
        stats = self.data_manager.get_stats()
        cards = [
            ("📦 总记录数", stats["total"], DarkTheme.ACCENT_BLUE),
            ("✅ 在租中", stats["active"], DarkTheme.STATUS_ACTIVE),
            ("⚠️ 已逾期", stats["expired"], DarkTheme.STATUS_EXPIRED),
            ("🔙 已退租", stats["returned"], DarkTheme.STATUS_RETURNED),
            ("🚫 已丢失", stats["lost"], DarkTheme.STATUS_LOST),
            ("💎 已买断", stats["bought"], DarkTheme.STATUS_BOUGHT),
        ]

        card_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        card_frame.pack(fill=tk.BOTH, expand=True)
        for r in range(2):
            for c in range(3):
                idx = r * 3 + c
                if idx >= len(cards):
                    break
                self._make_card(card_frame, cards[idx], r, c)

        # 底部欢迎区
        bottom = tk.Frame(main, bg=DarkTheme.BG_CARD)
        bottom.pack(fill=tk.X, pady=(20, 0))
        bottom.configure(highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        tk.Label(
            bottom,
            text=f"🕐 当前时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            font=DarkTheme.FONT_LABEL,
            fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD
        ).pack(padx=20, pady=15)

    def _make_card(self, parent, card_info, row, col):
        title, value, color = card_info
        card = tk.Frame(parent, bg=DarkTheme.BG_CARD)
        card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
        card.configure(highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        parent.grid_rowconfigure(row, weight=1)
        parent.grid_columnconfigure(col, weight=1)

        tk.Label(card, text=title, font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD).pack(pady=(15, 5))
        tk.Label(card, text=str(value), font=("微软雅黑", 32, "bold"),
                 fg=color, bg=DarkTheme.BG_CARD).pack(pady=(0, 15))
