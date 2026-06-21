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
        title_row = tk.Frame(head, bg=DarkTheme.BG_PRIMARY)
        title_row.pack(side=tk.LEFT)
        tk.Label(title_row, text="⏰ 到期提醒", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.ACCENT_YELLOW, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)
        self.status_hint_label = tk.Label(title_row, text="", font=DarkTheme.FONT_SMALL,
                                          fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY)
        self.status_hint_label.pack(side=tk.LEFT, padx=(10, 0), pady=(8, 0))

        refresh_btn = tk.Button(head, text="🔄 刷新", font=DarkTheme.FONT_BUTTON, fg="white",
                                bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                                command=self.refresh, padx=12, pady=6)
        refresh_btn.pack(side=tk.RIGHT)
        DarkTheme.bind_hover(refresh_btn, DarkTheme.ACCENT_BLUE)

        # 统计卡片
        cards_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        cards_frame.pack(fill=tk.X, pady=(0, 14))
        self.card_labels = {}
        for label, key, color in [
            ("🔴 已逾期", "overdue", DarkTheme.ACCENT_RED),
            ("🟠 严重逾期", "severe", DarkTheme.ACCENT_PURPLE),
            ("🟡 快到期", "urgent", DarkTheme.ACCENT_YELLOW),
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

        section_bar = tk.Frame(list_frame, bg=DarkTheme.BG_PRIMARY)
        section_bar.pack(fill=tk.X, pady=(0, 8))
        tk.Label(section_bar, text="风险分组：严重逾期 / 已逾期 / 快到期 / 未到期", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)

        filter_bar = tk.Frame(list_frame, bg=DarkTheme.BG_PRIMARY)
        filter_bar.pack(fill=tk.X, pady=(0, 8))
        tk.Label(filter_bar, text="查看范围", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 8))
        self.view_var = tk.StringVar(value="all")
        for key, text, color in [
            ("severe", "严重逾期", DarkTheme.ACCENT_RED),
            ("overdue", "已逾期", DarkTheme.ACCENT_PURPLE),
            ("due", "快到期", DarkTheme.ACCENT_YELLOW),
            ("not_due", "未逾期", DarkTheme.BG_HOVER),
            ("all", "全部", DarkTheme.BG_HOVER),
        ]:
            tk.Radiobutton(filter_bar, text=text, variable=self.view_var, value=key,
                           font=DarkTheme.FONT_SMALL, indicatoron=False,
                           fg="white", bg=color, selectcolor=color,
                           relief=tk.FLAT, cursor="hand2", command=self.refresh).pack(side=tk.LEFT, padx=3)

        sort_box = tk.Frame(list_frame, bg=DarkTheme.BG_PRIMARY)
        sort_box.pack(fill=tk.X, pady=(0, 8))
        tk.Label(sort_box, text="排序", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 8))
        self.sort_dir_var = tk.StringVar(value="desc")
        tk.Button(sort_box, text="🔽 高到低", font=DarkTheme.FONT_SMALL, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._set_sort_dir("desc")).pack(side=tk.LEFT, padx=3)
        tk.Button(sort_box, text="🔼 低到高", font=DarkTheme.FONT_SMALL, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._set_sort_dir("asc")).pack(side=tk.LEFT, padx=3)

        cols = ("ID", "租赁人", "联系电话", "到期日期", "剩余天数", "风险等级", "月租")
        self.tree = ttk.Treeview(list_frame, columns=cols, show="headings", height=12)
        widths = {"ID": 70, "租赁人": 100, "联系电话": 110, "到期日期": 110,
                  "剩余天数": 90, "风险等级": 80, "月租": 70}
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 90), anchor="center")

        vbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.tree.yview)

        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.tag_configure("severe", foreground="#ffffff", background=DarkTheme.ACCENT_RED)
        self.tree.tag_configure("overdue", foreground="#ffffff", background=DarkTheme.ACCENT_PURPLE)
        self.tree.tag_configure("urgent", foreground=DarkTheme.TEXT_PRIMARY, background="#3a2f12")
        self.tree.tag_configure("not_due", foreground=DarkTheme.TEXT_PRIMARY, background=DarkTheme.BG_CARD)

        # 按钮
        btn_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_frame.pack(fill=tk.X, pady=(10, 0))
        exp_btn = tk.Button(btn_frame, text="📤 导出提醒 CSV", font=DarkTheme.FONT_BUTTON,
                            fg="white", bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT,
                            cursor="hand2", command=self._export_csv, padx=12, pady=6)
        exp_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(exp_btn, DarkTheme.ACCENT_GREEN)

    def _classify_days(self, days: int):
        """按剩余天数返回展示文本、标签和统计桶。"""
        if days < 0:
            if days <= -7:
                return "严重逾期", f"已逾期{abs(days)}天", "severe", "severe"
            return "已逾期", f"已逾期{abs(days)}天", "overdue", "overdue"
        if days <= 3:
            return "快到期", f"{days}天", "urgent", "urgent"
        return "未到期", f"{days}天", None, "not_due"

    def refresh(self):
        self.dm.check_overdue()
        all_records = self.dm.get_records()
        today = date.today()

        self.records = []
        for r in all_records:
            lease = r.get("lease_info", {}) or {}
            end_str = lease.get("end_date", "")
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

        view = getattr(self, "view_var", None).get() if hasattr(self, "view_var") else "all"

        def _sort_key(x):
            days = x["days"]
            if days <= -7:
                bucket = 0  # 严重逾期
                metric = abs(days)
            elif days < 0:
                bucket = 1  # 已逾期
                metric = abs(days)
            elif days <= 3:
                bucket = 2  # 快到期
                metric = days
            else:
                bucket = 3  # 未到期
                metric = days

            if view == "severe":
                return (0, -metric if self.sort_dir_var.get() == "desc" else metric)
            if view == "overdue":
                return (0, -metric if self.sort_dir_var.get() == "desc" else metric)
            if view == "due":
                return (0, -metric if self.sort_dir_var.get() == "desc" else metric)
            if view == "not_due":
                return (0, -metric if self.sort_dir_var.get() == "desc" else metric)
            return (bucket, -metric if self.sort_dir_var.get() == "desc" else metric)

        self.records.sort(key=_sort_key)

        if hasattr(self, "status_hint_label"):
            sort_text = "高到低" if self.sort_dir_var.get() == "desc" else "低到高"
            view_text_map = {
                "all": "全部",
                "severe": "严重逾期",
                "overdue": "已逾期",
                "due": "快到期",
                "not_due": "未逾期",
            }
            self.status_hint_label.config(text=f"当前：{view_text_map.get(view, '全部')} / {sort_text}")

        severe_count = overdue_count = urgent_count = 0
        for rec in self.records:
            _, _, bucket, _ = self._classify_days(rec["days"])
            if bucket == "severe":
                severe_count += 1
            elif bucket == "overdue":
                overdue_count += 1
            elif bucket == "urgent":
                urgent_count += 1

        self.card_labels["overdue"].config(text=str(overdue_count))
        self.card_labels["severe"].config(text=str(severe_count))
        self.card_labels["urgent"].config(text=str(urgent_count))

        for item in self.tree.get_children():
            self.tree.delete(item)

        for rec in self.records:
            r, days = rec["record"], rec["days"]
            renter = r.get("renter", {})
            lease = r.get("lease_info", {})
            monthly = lease.get("monthly_rent", 0)
            status_text, days_text, bucket, tag = self._classify_days(days)
            show = (
                view == "all" or
                (view == "overdue" and bucket == "overdue") or
                (view == "due" and bucket == "urgent") or
                (view == "not_due" and bucket in ("urgent", "not_due")) or
                (view == "severe" and bucket == "severe")
            )
            if not show:
                continue
            self.tree.insert("", tk.END, values=(
                r.get("id", ""), renter.get("name", ""), renter.get("phone", ""),
                rec["end_date"], days_text, status_text,
                f"¥{float(monthly or 0):.0f}"), tags=(tag,))

    def _set_sort_dir(self, direction):
        self.sort_dir_var.set(direction)
        self.refresh()

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
