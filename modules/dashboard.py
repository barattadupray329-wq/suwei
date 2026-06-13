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

        # 操作按钮行
        btn_row = tk.Frame(head, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(side=tk.RIGHT)
        tk.Button(btn_row, text="🔄 刷新", font=DarkTheme.FONT_SMALL,
                  fg="white", bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=self._refresh, padx=10, pady=4).pack(side=tk.LEFT, padx=2)
        tk.Button(btn_row, text="💾 备份数据", font=DarkTheme.FONT_SMALL,
                  fg="white", bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT, cursor="hand2",
                  command=self._do_backup, padx=10, pady=4).pack(side=tk.LEFT, padx=2)
        tk.Button(btn_row, text="📜 日志", font=DarkTheme.FONT_SMALL,
                  fg="white", bg=DarkTheme.ACCENT_PURPLE, relief=tk.FLAT, cursor="hand2",
                  command=self._show_logs, padx=10, pady=4).pack(side=tk.LEFT, padx=2)
        tk.Button(btn_row, text="📊 报表导出", font=DarkTheme.FONT_SMALL,
                  fg="white", bg=DarkTheme.ACCENT_YELLOW, relief=tk.FLAT, cursor="hand2",
                  command=self._export_report, padx=10, pady=4).pack(side=tk.LEFT, padx=2)

        self.clock_label = tk.Label(head, text="", font=DarkTheme.FONT_LABEL,
                                     fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY)
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
            ("📦 总记录", stats["total"], DarkTheme.ACCENT_BLUE),
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
            ("总租金", total_rent, DarkTheme.ACCENT_BLUE),
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

    def _refresh(self):
        """刷新仪表板内容"""
        for w in self.winfo_children():
            w.destroy()
        self._build()
        self._update_clock()

    def _do_backup(self):
        """执行数据备份"""
        from tkinter import messagebox
        result = self.data_manager.backup_data()
        if result:
            last = self.data_manager.data.get("settings", {}).get("last_backup", "")
            messagebox.showinfo("备份成功", f"数据已备份到:\n{result}\n\n备份时间: {last}")
        else:
            messagebox.showerror("备份失败", "备份数据时发生错误，请检查目录权限")

    def _show_logs(self):
        """显示操作日志"""
        from modules.logger import get_logger
        import os
        log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")
        if not os.path.exists(log_dir):
            from tkinter import messagebox
            messagebox.showinfo("提示", "暂无日志记录")
            return
        log_files = sorted([f for f in os.listdir(log_dir) if f.endswith(".log")], reverse=True)
        if not log_files:
            from tkinter import messagebox
            messagebox.showinfo("提示", "暂无日志文件")
            return
        # 显示最新日志
        win = tk.Toplevel(self)
        win.title("📜 操作日志")
        win.geometry("800x500")
        win.transient(self)
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        win.update_idletasks()
        x = (win.winfo_screenwidth() // 2) - 400
        y = (win.winfo_screenheight() // 2) - 250
        win.geometry(f"800x500+{x}+{y}")

        def _safe_close(w=win):
            try:
                w.grab_release()
            except Exception:
                pass
            w.destroy()

        win.protocol("WM_DELETE_WINDOW", _safe_close)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        tk.Label(main, text="📜 操作日志", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_PURPLE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 10))

        # 过滤栏
        filter_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        filter_frame.pack(fill=tk.X, pady=(0, 8))
        tk.Label(filter_frame, text="过滤:", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        filter_var = tk.StringVar(value="ALL")
        for level, txt in [("ALL", "全部"), ("INFO", "INFO"), ("WARNING", "WARN"), ("ERROR", "ERROR")]:
            tk.Button(filter_frame, text=txt, font=DarkTheme.FONT_SMALL,
                      fg="white" if level != "ALL" else DarkTheme.TEXT_PRIMARY,
                      bg=DarkTheme.ACCENT_BLUE if level == "INFO" else (
                          DarkTheme.ACCENT_YELLOW if level == "WARNING" else (
                              DarkTheme.ACCENT_RED if level == "ERROR" else DarkTheme.BG_TERTIARY)),
                      relief=tk.FLAT, cursor="hand2",
                      command=lambda lv=level: _filter_logs(lv)).pack(side=tk.LEFT, padx=2)

        text_widget = tk.Text(main, font=("Consolas", 9), wrap=tk.WORD,
                              bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY,
                              insertbackground=DarkTheme.TEXT_PRIMARY)
        text_widget.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)

        # 读取最新日志
        latest_log = os.path.join(log_dir, log_files[0])
        try:
            with open(latest_log, "r", encoding="utf-8") as f:
                log_content = f.read()
        except:
            log_content = "无法读取日志文件"

        all_lines = log_content.split("\n")

        def _filter_logs(level):
            if level == "ALL":
                filtered = all_lines
            else:
                filtered = [l for l in all_lines if f"[{level}]" in l]
            text_widget.config(state=tk.NORMAL)
            text_widget.delete("1.0", tk.END)
            text_widget.insert("1.0", "\n".join(filtered[-500:]))  # 最多显示500行
            text_widget.config(state=tk.DISABLED)

        _filter_logs("ALL")

        tk.Label(main, text=f"共 {len(all_lines)} 行日志 (来自 {log_files[0]})",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(4, 0))

        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(8, 0))
        tk.Button(btn, text="关闭", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=_safe_close, padx=20, pady=8).pack(side=tk.LEFT)
        DarkTheme.bind_hover(btn.winfo_children()[0], DarkTheme.BG_HOVER)

    def _export_report(self):
        """导出统计报表 Excel"""
        from tkinter import messagebox, filedialog
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        except ImportError:
            messagebox.showerror("错误", "缺少 openpyxl 库，请先安装: pip install openpyxl")
            return

        fp = filedialog.asksaveasfilename(
            title="导出统计报表",
            defaultextension=".xlsx",
            filetypes=[("Excel 文件", "*.xlsx")],
            initialfile=f"租赁报表_{self.data_manager.data.get('settings', {}).get('last_backup', datetime.now().strftime('%Y%m%d_%H%M%S'))}.xlsx"
        )
        if not fp:
            return

        try:
            wb = Workbook()
            ws = wb.active
            ws.title = "租赁统计报表"

            # 样式
            title_font = Font(name="微软雅黑", size=14, bold=True, color="4472C4")
            header_font = Font(name="微软雅黑", size=11, bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
            normal_font = Font(name="微软雅黑", size=11)
            thin_border = Border(
                left=Side(style="thin"), right=Side(style="thin"),
                top=Side(style="thin"), bottom=Side(style="thin")
            )

            # 标题
            ws.merge_cells("A1:B1")
            ws["A1"] = "速维电脑租赁管理系统 — 统计报表"
            ws["A1"].font = title_font
            ws["A2"] = f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            ws["A2"].font = normal_font

            # 基本统计
            stats = self.data_manager.get_stats()
            ws["A4"] = "基本统计"
            ws["A4"].font = Font(name="微软雅黑", size=12, bold=True, color="4472C4")
            
            row = 5
            ws.cell(row=row, column=1, value="项目").font = header_font
            ws.cell(row=row, column=1).fill = header_fill
            ws.cell(row=row, column=2, value="数量").font = header_font
            ws.cell(row=row, column=2).fill = header_fill
            for label, key in [("总记录", "total"), ("在租", "active"), ("逾期", "expired"),
                               ("退租", "returned"), ("丢失", "lost"), ("买断", "bought")]:
                row += 1
                c1 = ws.cell(row=row, column=1, value=label)
                c1.font = normal_font
                c1.border = thin_border
                c2 = ws.cell(row=row, column=2, value=stats[key])
                c2.font = normal_font
                c2.border = thin_border

            # 财务汇总
            row += 2
            records = self.data_manager.get_records()
            total_rent = sum(float(r.get("lease_info", {}).get("total_rent", 0) or 0) for r in records)
            paid = sum(float(r.get("paid_amount", 0) or 0) for r in records)
            ws.cell(row=row, column=1, value="财务汇总").font = Font(name="微软雅黑", size=12, bold=True, color="4472C4")
            row += 1
            for label, val in [("总租金", total_rent), ("已收金额", paid), ("未收金额", total_rent - paid)]:
                c1 = ws.cell(row=row, column=1, value=label)
                c1.font = normal_font
                c1.border = thin_border
                c2 = ws.cell(row=row, column=2, value=val)
                c2.font = normal_font
                c2.number_format = '"¥"#,##0.00'
                c2.border = thin_border
                row += 1

            # 列宽
            ws.column_dimensions["A"].width = 20
            ws.column_dimensions["B"].width = 18

            wb.save(fp)
            messagebox.showinfo("成功", f"报表已导出:\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")

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
