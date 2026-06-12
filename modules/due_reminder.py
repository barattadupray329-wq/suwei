#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
到期提醒模块
独立页面：统计卡片、到期/逾期列表、CSV导出
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime, date
import csv
from theme.colors import DarkTheme


class DueReminderFrame(ttk.Frame):
    """到期提醒界面"""

    def __init__(self, parent_controller, data_manager):
        super().__init__(parent_controller)
        self.dm = data_manager
        self.records = []
        self.configure(style="Main.TFrame")
        self._build()
        self.refresh()

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        head = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        head.pack(fill=tk.X, pady=(0, 14))
        tk.Label(head, text="⏰ 到期提醒", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.ACCENT_YELLOW, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)

        refresh_btn = tk.Button(head, text="🔄 刷新", font=DarkTheme.FONT_BUTTON, fg="white",
                                bg=DarkTheme.ACCENT_SECONDARY, relief=tk.FLAT, cursor="hand2",
                                command=self.refresh, padx=12, pady=6)
        refresh_btn.pack(side=tk.RIGHT)
        DarkTheme.bind_hover(refresh_btn, DarkTheme.ACCENT_SECONDARY)

        # 统计卡片
        cards_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        cards_frame.pack(fill=tk.X, pady=(0, 14))
        self.card_labels = {}
        for label, key, color in [
            ("🔴 已逾期", "overdue", DarkTheme.ACCENT_RED),
            ("🟡 3天内到期", "urgent", DarkTheme.ACCENT_YELLOW),
            ("🟢 7天内到期", "week", DarkTheme.ACCENT_GREEN),
            ("📅 30天内到期", "month", DarkTheme.ACCENT_BLUE),
        ]:
            card = tk.Frame(cards_frame, bg=DarkTheme.BG_CARD,
                            highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
            card.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=4, pady=4)
            tk.Label(card, text=label, font=DarkTheme.FONT_LABEL,
                     fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD).pack(pady=(8, 2))
            lbl = tk.Label(card, text="0", font=DarkTheme.FONT_CARD_VALUE,
                           fg=color, bg=DarkTheme.BG_CARD)
            lbl.pack(pady=(0, 8))
            self.card_labels[key] = lbl

        # 表格
        list_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        list_frame.pack(fill=tk.BOTH, expand=True)

        cols = ("ID", "租赁人", "联系电话", "到期日期", "剩余天数", "状态", "月租")
        self.tree = ttk.Treeview(list_frame, columns=cols, show="headings", height=12)
        widths = {"ID": 70, "租赁人": 100, "联系电话": 110, "到期日期": 110,
                  "剩余天数": 90, "状态": 80, "月租": 70}
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 90), anchor="center")

        vbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.tag_configure("overdue", foreground=DarkTheme.ACCENT_RED)
        self.tree.tag_configure("urgent", foreground=DarkTheme.ACCENT_YELLOW)

        # 按钮
        btn_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_frame.pack(fill=tk.X, pady=(10, 0))
        exp_btn = tk.Button(btn_frame, text="📤 导出提醒 CSV", font=DarkTheme.FONT_BUTTON,
                            fg="white", bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT,
                            cursor="hand2", command=self._export_csv, padx=12, pady=6)
        exp_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(exp_btn, DarkTheme.ACCENT_GREEN)

    def refresh(self):
        self.dm.check_overdue()
        all_records = self.dm.get_records()
        today = date.today()

        self.records = []
        for r in all_records:
            if r.get("status") not in ("在租", "已逾期"):
                continue
            end_str = r.get("lease_info", {}).get("end_date", "")
            if not end_str:
                continue
            try:
                end_dt = datetime.strptime(end_str, "%Y-%m-%d").date()
                days = (end_dt - today).days
                self.records.append({"record": r, "days": days,
                                     "end_date": end_str,
                                     "end_dt": end_dt})
            except ValueError:
                continue

        self.records.sort(key=lambda x: x["days"])

        overdue_count = sum(1 for r in self.records if r["days"] < 0)
        urgent_count = sum(1 for r in self.records if 0 <= r["days"] <= 3)
        week_count = sum(1 for r in self.records if 0 <= r["days"] <= 7)
        month_count = sum(1 for r in self.records if 0 <= r["days"] <= 30)

        self.card_labels["overdue"].config(text=str(overdue_count))
        self.card_labels["urgent"].config(text=str(urgent_count))
        self.card_labels["week"].config(text=str(week_count))
        self.card_labels["month"].config(text=str(month_count))

        for item in self.tree.get_children():
            self.tree.delete(item)

        for rec in self.records:
            r, days = rec["record"], rec["days"]
            renter = r.get("renter", {})
            lease = r.get("lease_info", {})
            monthly = lease.get("monthly_rent", 0)
            status_text = "已逾期" if days < 0 else "即将到期"
            days_text = f"已逾期{abs(days)}天" if days < 0 else f"{days}天"

            tag = "overdue" if days < 0 else ("urgent" if days <= 3 else "")
            self.tree.insert("", tk.END, values=(
                r.get("id", ""), renter.get("name", ""), renter.get("phone", ""),
                rec["end_date"], days_text, status_text,
                f"¥{float(monthly or 0):.0f}"), tags=(tag,))

    def _export_csv(self):
        if not self.records:
            messagebox.showinfo("提示", "没有需要导出的提醒")
            return
        fp = filedialog.asksaveasfilename(
            title="导出到期提醒", defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
            initialfile=f"到期提醒_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        if not fp:
            return
        try:
            with open(fp, "w", newline="", encoding="utf-8-sig") as f:
                w = csv.writer(f)
                w.writerow(["记录ID", "租赁人", "联系电话", "到期日期", "剩余天数", "状态", "月租"])
                for rec in self.records:
                    r, days = rec["record"], rec["days"]
                    renter = r.get("renter", {})
                    lease = r.get("lease_info", {})
                    status_text = "已逾期" if days < 0 else "即将到期"
                    days_text = f"已逾期{abs(days)}天" if days < 0 else f"{days}天"
                    w.writerow([r.get("id", ""), renter.get("name", ""),
                                renter.get("phone", ""), rec["end_date"],
                                days_text, status_text, lease.get("monthly_rent", "")])
            messagebox.showinfo("成功", f"已导出 {len(self.records)} 条提醒\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败：{e}")
