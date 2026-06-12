#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""仪表板首页 — 数据总览"""

import tkinter as tk
from tkinter import ttk
from theme.colors import DarkTheme
from datetime import datetime, date


class DashboardFrame(ttk.Frame):
    """仪表板"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)
        self.data_manager = data_manager
        self.clock_label = None
        self.cards = []
        self.configure(style="Main.TFrame")
        self._build()
        self._update_clock()

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        head = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        head.pack(fill=tk.X, pady=(0, 20))
        tk.Label(
            head, text="📊 数据总览",
            font=DarkTheme.FONT_TITLE,
            fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY
        ).pack(side=tk.LEFT)

        self.clock_label = tk.Label(head, text="", font=DarkTheme.FONT_LABEL,
            fg=DarkTheme.ACCENT_PRIMARY, bg=DarkTheme.BG_PRIMARY)
        self.clock_label.pack(side=tk.RIGHT, pady=6)

        # 4列布局: 统计卡片(左) + 财务卡片(右)
        top_grid = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        top_grid.pack(fill=tk.X, pady=(0, 10))

        stats = self.data_manager.get_stats()
        records = self.data_manager.get_records()
        total_rent = sum(float(r.get("lease_info", {}).get("total_rent", 0) or 0) for r in records)
        paid_amount = sum(float(r.get("paid_amount", 0) or 0) for r in records)
        unpaid_amount = total_rent - paid_amount

        stat_cards = [
            ("📦 总记录", stats["total"], DarkTheme.ACCENT_PRIMARY),
            ("✅ 在租", stats["active"], DarkTheme.STATUS_ACTIVE),
            ("⚠️ 逾期", stats["expired"], DarkTheme.STATUS_EXPIRED),
            ("🔙 退租", stats["returned"], DarkTheme.STATUS_RETURNED),
            ("🚫 丢失", stats["lost"], DarkTheme.STATUS_LOST),
            ("💎 买断", stats["bought"], DarkTheme.STATUS_BOUGHT),
        ]

        c1 = tk.Frame(top_grid, bg=DarkTheme.BG_PRIMARY)
        c1.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        for r in range(2):
            for c in range(3):
                idx = r * 3 + c
                if idx >= len(stat_cards):
                    break
                self._make_card(c1, stat_cards[idx], r, c)

        c2 = tk.Frame(top_grid, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        c2.pack(side=tk.LEFT, fill=tk.BOTH, padx=(12, 0))
        tk.Label(c2, text="💰 财务概览", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=16, pady=(14, 8))
        for lbl, val, color in [
            ("总租金", total_rent, DarkTheme.ACCENT_PRIMARY),
            ("已收金额", paid_amount, DarkTheme.ACCENT_GREEN),
            ("未收金额", unpaid_amount, DarkTheme.ACCENT_RED),
        ]:
            row = tk.Frame(c2, bg=DarkTheme.BG_CARD)
            row.pack(fill=tk.X, padx=16, pady=6)
            tk.Label(row, text=lbl, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_CARD).pack(side=tk.LEFT)
            tk.Label(row, text=f"¥{val:,.2f}", font=("微软雅黑", 16, "bold"),
                     fg=color, bg=DarkTheme.BG_CARD).pack(side=tk.RIGHT)

        # 下半区域: 即将到期提醒
        bottom = tk.Frame(main, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        bottom.pack(fill=tk.BOTH, expand=True, pady=(4, 0))
        tk.Label(bottom, text="⏰ 即将到期提醒", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_YELLOW, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=16, pady=(12, 8))

        today = date.today()
        upcoming = []
        for r in records:
            if r.get("status") != "在租":
                continue
            end_str = r.get("lease_info", {}).get("end_date", "")
            if not end_str:
                continue
            try:
                end_dt = datetime.strptime(end_str, "%Y-%m-%d").date()
                days_left = (end_dt - today).days
                if days_left <= 15:
                    renter = r.get("renter", {}).get("name", "")
                    upcoming.append((r.get("id", ""), renter, end_str, days_left))
            except ValueError:
                pass
        upcoming.sort(key=lambda x: x[3])

        if not upcoming:
            tk.Label(bottom, text="暂无即将到期记录 ✓", font=DarkTheme.FONT_NORMAL,
                     fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_CARD).pack(padx=16, pady=10)
        else:
            cols = ("记录ID", "租赁人", "到期日期", "剩余天数")
            tree = ttk.Treeview(bottom, columns=cols, show="headings", height=6)
            for c in cols:
                tree.heading(c, text=c)
                tree.column(c, width=120, anchor="center")
            tree.pack(fill=tk.BOTH, expand=True, padx=16, pady=(0, 12))
            for rid, name, end, days in upcoming[:10]:
                tree.insert("", tk.END, values=(rid, name, end, f"{days}天"),
                            tags=("urgent",) if days <= 3 else ())
            tree.tag_configure("urgent", foreground=DarkTheme.ACCENT_RED)

    def _update_clock(self):
        if self.clock_label:
            from datetime import datetime
            now = datetime.now()
            self.clock_label.config(text=f"🕐 {now.strftime('%Y-%m-%d %H:%M:%S')} 星期{['一','二','三','四','五','六','日'][now.weekday()]}")
            self.after(1000, self._update_clock)

    def _make_card(self, parent, card_info, row, col):
        title, value, color = card_info
        card = tk.Frame(parent, bg=DarkTheme.BG_CARD)
        card.grid(row=row, column=col, padx=6, pady=6, sticky="nsew")
        card.configure(highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        parent.grid_rowconfigure(row, weight=1)
        parent.grid_columnconfigure(col, weight=1)

        tk.Label(card, text=title, font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD).pack(pady=(10, 4))
        tk.Label(card, text=str(value), font=DarkTheme.FONT_CARD_VALUE,
                 fg=color, bg=DarkTheme.BG_CARD).pack(pady=(0, 10))
