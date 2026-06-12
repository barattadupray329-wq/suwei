#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""租赁管理模块 - 核心CRUD功能"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime, timedelta
import csv
from theme.colors import DarkTheme
from modules.hardware_mgmt import HardwareDialog
from modules.reports import RenewHistoryDialog, AdvancedFilterDialog, ReportDialog


class RentalManagementFrame(ttk.Frame):
    """租赁管理"""

    STATUS_COLORS = {
        "在租": DarkTheme.STATUS_ACTIVE, "已逾期": DarkTheme.STATUS_EXPIRED,
        "已退租": DarkTheme.STATUS_RETURNED, "已丢失": DarkTheme.STATUS_LOST,
        "已买断": DarkTheme.STATUS_BOUGHT,
    }

    def __init__(self, parent, app):
        super().__init__(parent)
        self.app = app
        self.dm = app.data_manager
        self._all, self._shown = [], []
        self._build()
        self._refresh()

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        tk.Label(main, text="📋 租赁管理", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.ACCENT_PRIMARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        ctrl = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        ctrl.pack(fill=tk.X, pady=(0, 10))

        tk.Label(ctrl, text="搜索:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY, 
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._apply_filter())
        ttk.Entry(ctrl, textvariable=self.search_var, width=32, font=DarkTheme.FONT_NORMAL).pack(side=tk.LEFT, padx=(0, 12), ipady=2)

        tk.Label(ctrl, text="状态:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        self.status_var = tk.StringVar(value="全部")
        self.status_combo = ttk.Combobox(ctrl, textvariable=self.status_var, width=12,
                                         state="readonly", values=["全部", "在租", "已退租", "已丢失", "已买断", "已逾期"])
        self.status_combo.pack(side=tk.LEFT, padx=(0, 10))
        self.status_combo.bind("<<ComboboxSelected>>", lambda *_: self._apply_filter())
        for txt, cmd, clr in [
            ("🔄 刷新", self._refresh, DarkTheme.BG_HOVER),
            ("🔍 高级筛选", self._advanced_filter, DarkTheme.ACCENT_PURPLE),
            ("📋 报表", self._show_report, DarkTheme.ACCENT_CYAN),
        ]:
            btn = tk.Button(ctrl, text=txt, font=DarkTheme.FONT_SMALL, fg="white", bg=clr,
                            relief=tk.FLAT, cursor="hand2", command=cmd, padx=10, pady=4)
            btn.pack(side=tk.LEFT, padx=3)
            DarkTheme.bind_hover(btn, clr)

        table_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        table_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        cols = ("ID", "租赁人", "联系电话", "起租时间", "到期时间", "状态")
        self.tree = ttk.Treeview(table_frame, columns=cols, show="headings", height=14)
        widths = {"ID": 70, "租赁人": 100, "联系电话": 110, "起租时间": 110, "到期时间": 110, "状态": 70}
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 90), anchor="center")

        vbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.bind("<Double-1>", self.show_detail)

        btns = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btns.pack(fill=tk.X)

        for txt, cmd, sty in [
            ("➕ 新增记录", self.add_new_record, DarkTheme.ACCENT_PRIMARY),
            ("🔄 续租", self.renew_lease, DarkTheme.ACCENT_SECONDARY),
            ("✏️ 编辑", self.edit_record, DarkTheme.ACCENT_YELLOW),
            ("🗑️ 删除", self.delete_record, DarkTheme.ACCENT_RED),
            ("📥 批量导入", self.import_rentals, DarkTheme.ACCENT_GREEN),
            ("📤 批量导出", self.export_rentals, DarkTheme.ACCENT_GREEN),
            ("🤖 AI 助手", self.open_ai, DarkTheme.ACCENT_PURPLE),
        ]:
            b = tk.Button(btns, text=txt, font=DarkTheme.FONT_BUTTON, fg="white", bg=sty,
                           relief=tk.FLAT, cursor="hand2", command=cmd,
                           padx=DarkTheme.BUTTON_PAD_X, pady=DarkTheme.BUTTON_PAD_Y)
            b.pack(side=tk.LEFT, padx=3)
            DarkTheme.bind_hover(b, sty)

    def _refresh(self):
        self.dm.check_overdue()
        self._all = self.dm.get_records()
        self._apply_filter()

    def _apply_filter(self):
        q = self.search_var.get().strip().lower()
        s = self.status_var.get()
        self._shown = []
        for r in self._all:
            if s != "全部" and r.get("status") != s:
                continue
            if q:
                renter = r.get("renter", {})
                haystack = (str(r.get("id", "")) + str(renter.get("name", "")) + 
                            str(renter.get("phone", ""))).lower()
                if q not in haystack:
                    continue
            self._shown.append(r)
        self._render_tree()

    def _render_tree(self):
        for i in self.tree.get_children():
            self.tree.delete(i)
        for r in self._shown:
            renter, lease, st = r.get("renter", {}), r.get("lease_info", {}), r.get("status", "")
            self.tree.insert("", tk.END, values=(r.get("id", ""), renter.get("name", ""),
                                                renter.get("phone", ""), lease.get("start_date", ""),
                                                lease.get("end_date", ""), st), tags=(st,))
        for st, clr in self.STATUS_COLORS.items():
            self.tree.tag_configure(st, foreground=clr)

    def _selected_id(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("提示", "请先选择一条记录")
            return None
        return self.tree.item(sel[0])["values"][0]

    def _find_record(self, rid):
        for r in self._all:
            if r.get("id") == rid:
                return r
        return None

    def _advanced_filter(self):
        """打开高级筛选对话框"""
        dlg = AdvancedFilterDialog(self, {})
        filters = dlg.show()
        if filters is None:
            return
        # 根据筛选条件过滤
        kw = filters.get("keyword", "").lower()
        start_from = filters.get("start_date_from", "")
        start_to = filters.get("start_date_to", "")
        end_from = filters.get("end_date_from", "")
        end_to = filters.get("end_date_to", "")
        rent_min_str = filters.get("total_rent_min", "")
        rent_max_str = filters.get("total_rent_max", "")
        paid_min_str = filters.get("paid_min", "")
        paid_max_str = filters.get("paid_max", "")

        rent_min = float(rent_min_str) if rent_min_str else 0
        rent_max = float(rent_max_str) if rent_max_str else float('inf')
        paid_min = float(paid_min_str) if paid_min_str else 0
        paid_max = float(paid_max_str) if paid_max_str else float('inf')

        filtered = []
        for r in self._all:
            # 关键词筛选
            if kw:
                renter = r.get("renter", {})
                haystack = (str(r.get("id", "")) + str(renter.get("name", "")) + str(renter.get("phone", ""))).lower()
                if kw not in haystack:
                    continue

            lease = r.get("lease_info", {})
            start_date = lease.get("start_date", "")
            end_date = lease.get("end_date", "")

            # 日期范围筛选
            if start_from and start_date < start_from:
                continue
            if start_to and start_date > start_to:
                continue
            if end_from and end_date < end_from:
                continue
            if end_to and end_date > end_to:
                continue

            # 金额范围筛选
            total_rent = float(lease.get("total_rent", 0) or 0)
            paid_amount = float(r.get("paid_amount", 0) or 0)
            if total_rent < rent_min or total_rent > rent_max:
                continue
            if paid_amount < paid_min or paid_amount > paid_max:
                continue

            filtered.append(r)

        self._shown = filtered
        self._render_tree()
        messagebox.showinfo("筛选结果", f"筛选得到 {len(filtered)} 条记录")

    def _show_report(self):
        """显示报表窗口"""
        ReportDialog(self, self.dm)

    def add_new_record(self):
        """添加新的租赁记录"""
        win = tk.Toplevel(self)
        win.title("新增租赁记录")
        win.geometry("560x620")
        win.transient(self)
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center(win, 560, 620)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        tk.Label(main, text="➕ 新增租赁记录", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 10))

        form = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        form.pack(fill=tk.BOTH, expand=True)

        def make_row(parent, label, default="", width=28):
            row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=4)
            tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.W).pack(side=tk.LEFT)
            ent = ttk.Entry(row, width=width, font=DarkTheme.FONT_NORMAL)
            ent.pack(side=tk.LEFT, fill=tk.X, expand=True)
            if default is not None:
                ent.insert(0, str(default))
            return ent

        name_e = make_row(form, "租赁人*", "")
        phone_e = make_row(form, "联系电话*", "")
        id_e = make_row(form, "身份证", "")

        addr_row = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        addr_row.pack(fill=tk.BOTH, pady=4)
        tk.Label(addr_row, text="地址", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.NW).pack(side=tk.LEFT, pady=(4, 0))
        addr_t = tk.Text(addr_row, height=3, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                         bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, insertbackground=DarkTheme.TEXT_PRIMARY)
        addr_t.pack(side=tk.LEFT, fill=tk.X, expand=True)

        start_e = make_row(form, "起租日期*", datetime.now().strftime("%Y-%m-%d"))
        end_e = make_row(form, "到期日期*", (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"))
        monthly_e = make_row(form, "月租*", "0")
        total_e = make_row(form, "总租金*", "0")
        deposit_e = make_row(form, "押金", "0")
        paid_e = make_row(form, "已付金额", "0")

        st_row = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        st_row.pack(fill=tk.X, pady=4)
        tk.Label(st_row, text="状态", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.W).pack(side=tk.LEFT)
        status_var = tk.StringVar(value="在租")
        st_combo = ttk.Combobox(st_row, textvariable=status_var, state="readonly",
                                values=["在租", "已退租", "已丢失", "已买断", "已逾期"], width=26)
        st_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 硬件信息
        hw_row = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        hw_row.pack(fill=tk.X, pady=4)
        tk.Label(hw_row, text="硬件信息", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.W).pack(side=tk.LEFT)
        
        hardware_data = {}
        hw_btn = tk.Button(hw_row, text="⚙️ 编辑硬件信息", font=DarkTheme.FONT_BUTTON, fg="white",
                          bg=DarkTheme.ACCENT_PURPLE, relief=tk.FLAT, cursor="hand2",
                          command=lambda: self._edit_hardware_in_dialog(hardware_data), padx=12, pady=6)
        hw_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(hw_btn, DarkTheme.ACCENT_PURPLE)

        tip = tk.Label(main, text="日期格式建议：YYYY-MM-DD（例如 2026-06-11）",
                       font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY)
        tip.pack(anchor=tk.W, pady=(8, 6))

        def parse_num(label, text):
            if text == "":
                return 0.0
            try:
                value = float(text)
            except ValueError:
                raise ValueError(f"{label}必须是数字")
            if value < 0:
                raise ValueError(f"{label}不能为负数")
            return value

        def check_date(label, text):
            if not text:
                raise ValueError(f"{label}不能为空")
            try:
                return datetime.strptime(text, "%Y-%m-%d")
            except ValueError:
                raise ValueError(f"{label}格式错误，应为 YYYY-MM-DD")

        def save_new():
            try:
                name = name_e.get().strip()
                phone = phone_e.get().strip()
                if not name:
                    messagebox.showwarning("提示", "租赁人不能为空")
                    return
                if not phone:
                    messagebox.showwarning("提示", "联系电话不能为空")
                    return
                if not phone.isdigit() or len(phone) != 11:
                    messagebox.showwarning("提示", "联系电话应为11位数字")
                    return

                start = start_e.get().strip()
                end = end_e.get().strip()
                start_dt = check_date("起租日期", start)
                end_dt = check_date("到期日期", end)
                if start_dt > end_dt:
                    messagebox.showwarning("提示", "起租日期不能晚于到期日期")
                    return

                monthly = parse_num("月租", monthly_e.get().strip())
                total = parse_num("总租金", total_e.get().strip())
                deposit = parse_num("押金", deposit_e.get().strip())
                paid = parse_num("已付金额", paid_e.get().strip())
                if paid > total:
                    messagebox.showwarning("提示", "已付金额不能大于总租金")
                    return

                rec = {
                    "renter": {
                        "name": name,
                        "phone": phone,
                        "id_card": id_e.get().strip(),
                        "address": addr_t.get("1.0", tk.END).strip()
                    },
                    "lease_info": {
                        "start_date": start,
                        "end_date": end,
                        "monthly_rent": monthly,
                        "total_rent": total,
                        "deposit": deposit,
                        "lease_months": (end_dt - start_dt).days / 30.0
                    },
                    "status": status_var.get(),
                    "paid_amount": paid,
                    "renew_history": [],
                    "hardware": hardware_data
                }

                self.dm.add_record(rec)
                messagebox.showinfo("成功", f"新记录已创建\nID: {rec['id']}")
                win.destroy()
                self._refresh()
            except Exception as e:
                messagebox.showerror("错误", f"保存失败：{e}")

        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(8, 0))
        save_btn = tk.Button(btn, text="💾 创建", font=DarkTheme.FONT_BUTTON_BIG, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=save_new, padx=18, pady=10)
        save_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(save_btn, DarkTheme.ACCENT_BLUE)
        cancel_btn = tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON_BIG, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=win.destroy, padx=18, pady=10)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

    def renew_lease(self):
        rid = self._selected_id()
        if rid is None:
            return
        rec = self._find_record(rid)
        if not rec:
            return
        if rec.get("status") in ("已退租", "已丢失", "已买断"):
            messagebox.showwarning("提示", f"状态为'{rec['status']}'，无法续租")
            return

        lease = rec.get("lease_info", {})
        end_str = lease.get("end_date", "")
        total = float(lease.get("total_rent", 0))
        if not end_str:
            messagebox.showerror("错误", "该记录缺少到期时间")
            return

        win = tk.Toplevel(self)
        win.title(f"续租 — {rid}")
        win.geometry("420x460")
        win.transient(self)
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center(win, 420, 460)

        f = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        f.pack(fill=tk.BOTH, expand=True, padx=20, pady=16)

        tk.Label(f, text="🔄 续租", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        renter = rec.get("renter", {})
        for txt in [f"租赁人：{renter.get('name', '')}", f"当前到期：{end_str}",
                    f"当前租金总额：¥{total:.2f}"]:
            tk.Label(f, text=txt, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=2)

        unit_var = tk.StringVar(value="月")
        unit_f = tk.Frame(f, bg=DarkTheme.BG_PRIMARY)
        unit_f.pack(fill=tk.X, pady=8)
        tk.Label(unit_f, text="时间单位：", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 8))
        for val, txt in [("天", "天"), ("月", "月")]:
            tk.Radiobutton(unit_f, text=txt, variable=unit_var, value=val, font=DarkTheme.FONT_NORMAL,
                           bg=DarkTheme.BG_PRIMARY, fg=DarkTheme.TEXT_PRIMARY,
                           selectcolor=DarkTheme.ACCENT_BLUE).pack(side=tk.LEFT, padx=6)

        time_e = self._field_row(f, "续租时间：")
        amt_e = self._field_row(f, "续租金额(¥)：")
        paid_e = self._field_row(f, "已付金额(¥)：", str(rec.get("paid_amount", 0)))

        btn_f = tk.Frame(f, bg=DarkTheme.BG_PRIMARY)
        btn_f.pack(fill=tk.X, pady=(12, 0))
        renew_btn = tk.Button(btn_f, text="✅ 确认续租", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._do_renew(win, rec, lease, total, unit_var, time_e, amt_e, paid_e),
                  padx=14, pady=8)
        renew_btn.pack(side=tk.LEFT, padx=(0, 10))
        DarkTheme.bind_hover(renew_btn, DarkTheme.ACCENT_BLUE)
        cancel_btn = tk.Button(btn_f, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=win.destroy, padx=14, pady=8)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

    def _field_row(self, parent, label, default=""):
        row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=6)
        tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=14, anchor=tk.W).pack(side=tk.LEFT, padx=(0, 6))
        e = ttk.Entry(row, font=DarkTheme.FONT_NORMAL, width=22)
        e.pack(side=tk.LEFT)
        if default:
            e.insert(0, default)
        return e

    def _do_renew(self, win, rec, lease, cur_total, unit_var, time_e, amt_e, paid_e):
        try:
            t_str = time_e.get().strip()
            if not t_str:
                messagebox.showwarning("提示", "请输入续租时间")
                return
            t_val = float(t_str)
            if t_val <= 0:
                messagebox.showwarning("提示", "时间必须 > 0")
                return

            a_str = amt_e.get().strip()
            if not a_str:
                messagebox.showwarning("提示", "请输入续租金额")
                return
            amt = float(a_str)
            if amt < 0:
                messagebox.showwarning("提示", "金额不能为负")
                return

            p_str = paid_e.get().strip()
            new_paid = float(p_str) if p_str else rec.get("paid_amount", 0)
            if new_paid < 0:
                messagebox.showwarning("提示", "已付金额不能为负")
                return
            if new_paid > cur_total + amt:
                messagebox.showwarning("提示", "已付金额不能大于总租金")
                return

            cur_end = datetime.strptime(lease["end_date"], "%Y-%m-%d")
            if unit_var.get() == "天":
                new_end = cur_end + timedelta(days=int(t_val))
                add_months = t_val / 30.0
            else:
                new_end = cur_end + timedelta(days=int(t_val * 30))
                add_months = t_val
            new_end_str = new_end.strftime("%Y-%m-%d")

            lease["end_date"] = new_end_str
            lease["total_rent"] = cur_total + amt
            if "lease_months" in lease:
                try:
                    lease["lease_months"] = float(lease["lease_months"]) + add_months
                except (ValueError, TypeError):
                    pass

            rec.setdefault("renew_history", []).append({
                "renew_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "renew_time": t_val, "renew_unit": unit_var.get(), "renew_amount": amt,
                "old_end_date": cur_end.strftime("%Y-%m-%d"), "new_end_date": new_end_str,
                "operator": self.app.username or "系统",
            })
            rec["paid_amount"] = new_paid
            self.dm.save()
            messagebox.showinfo("成功", f"续租成功！\n时间：{t_val}{unit_var.get()}\n金额：¥{amt:.2f}\n新到期：{new_end_str}")
            win.destroy()
            self._refresh()
        except Exception as e:
            messagebox.showerror("错误", f"续租失败：{e}")

    def edit_record(self):
        rid = self._selected_id()
        if not rid or not (rec := self._find_record(rid)):
            return
        
        win = tk.Toplevel(self)
        win.title(f"编辑记录 — {rid}")
        win.geometry("560x620")
        win.transient(self)
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center(win, 560, 620)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        tk.Label(main, text=f"✏️ 编辑租赁记录 ({rid})", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_YELLOW, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 10))

        renter = rec.get("renter", {})
        lease = rec.get("lease_info", {})

        form = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        form.pack(fill=tk.BOTH, expand=True)

        def make_row(parent, label, default="", width=28):
            row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=4)
            tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.W).pack(side=tk.LEFT)
            ent = ttk.Entry(row, width=width, font=DarkTheme.FONT_NORMAL)
            ent.pack(side=tk.LEFT, fill=tk.X, expand=True)
            if default is not None:
                ent.insert(0, str(default))
            return ent

        name_e = make_row(form, "租赁人*", renter.get("name", ""))
        phone_e = make_row(form, "联系电话*", renter.get("phone", ""))
        id_e = make_row(form, "身份证", renter.get("id_card", ""))

        addr_row = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        addr_row.pack(fill=tk.BOTH, pady=4)
        tk.Label(addr_row, text="地址", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.NW).pack(side=tk.LEFT, pady=(4, 0))
        addr_t = tk.Text(addr_row, height=3, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                         bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, insertbackground=DarkTheme.TEXT_PRIMARY)
        addr_t.pack(side=tk.LEFT, fill=tk.X, expand=True)
        addr_t.insert("1.0", renter.get("address", ""))

        start_e = make_row(form, "起租日期", lease.get("start_date", ""))
        end_e = make_row(form, "到期日期", lease.get("end_date", ""))
        monthly_e = make_row(form, "月租", lease.get("monthly_rent", "0"))
        total_e = make_row(form, "总租金", lease.get("total_rent", "0"))
        deposit_e = make_row(form, "押金", lease.get("deposit", "0"))
        paid_e = make_row(form, "已付金额", rec.get("paid_amount", "0"))

        st_row = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        st_row.pack(fill=tk.X, pady=4)
        tk.Label(st_row, text="状态", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.W).pack(side=tk.LEFT)
        status_var = tk.StringVar(value=rec.get("status", "在租"))
        st_combo = ttk.Combobox(st_row, textvariable=status_var, state="readonly",
                                values=["在租", "已退租", "已丢失", "已买断", "已逾期"], width=26)
        st_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)

        settle_e = make_row(form, "结算金额", rec.get("settlement_amount", ""))

        tip = tk.Label(main, text="日期格式建议：YYYY-MM-DD（例如 2026-06-11）",
                       font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY)
        tip.pack(anchor=tk.W, pady=(8, 6))

        def parse_num(label, text):
            if text == "":
                return 0.0
            try:
                value = float(text)
            except ValueError:
                raise ValueError(f"{label}必须是数字")
            if value < 0:
                raise ValueError(f"{label}不能为负数")
            return value

        def check_date(label, text):
            if not text:
                return None
            try:
                return datetime.strptime(text, "%Y-%m-%d")
            except ValueError:
                raise ValueError(f"{label}格式错误，应为 YYYY-MM-DD")

        def save_edit():
            try:
                name = name_e.get().strip()
                phone = phone_e.get().strip()
                if not name:
                    messagebox.showwarning("提示", "租赁人不能为空")
                    return
                if not phone:
                    messagebox.showwarning("提示", "联系电话不能为空")
                    return
                if not phone.isdigit() or len(phone) != 11:
                    messagebox.showwarning("提示", "联系电话应为11位数字")
                    return

                start = start_e.get().strip()
                end = end_e.get().strip()
                start_dt = check_date("起租日期", start)
                end_dt = check_date("到期日期", end)
                if start_dt and end_dt and start_dt > end_dt:
                    messagebox.showwarning("提示", "起租日期不能晚于到期日期")
                    return

                monthly = parse_num("月租", monthly_e.get().strip())
                total = parse_num("总租金", total_e.get().strip())
                deposit = parse_num("押金", deposit_e.get().strip())
                paid = parse_num("已付金额", paid_e.get().strip())
                if paid > total:
                    messagebox.showwarning("提示", "已付金额不能大于总租金")
                    return

                rec.setdefault("renter", {})
                rec.setdefault("lease_info", {})
                rec["renter"]["name"] = name
                rec["renter"]["phone"] = phone
                rec["renter"]["id_card"] = id_e.get().strip()
                rec["renter"]["address"] = addr_t.get("1.0", tk.END).strip()

                rec["lease_info"]["start_date"] = start
                rec["lease_info"]["end_date"] = end
                rec["lease_info"]["monthly_rent"] = monthly
                rec["lease_info"]["total_rent"] = total
                rec["lease_info"]["deposit"] = deposit

                rec["paid_amount"] = paid
                rec["status"] = status_var.get()

                settle_text = settle_e.get().strip()
                if settle_text:
                    rec["settlement_amount"] = parse_num("结算金额", settle_text)
                    rec["settlement_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                else:
                    rec.pop("settlement_amount", None)
                    rec.pop("settlement_date", None)

                self.dm.save()
                messagebox.showinfo("成功", "记录已更新")
                win.destroy()
                self._refresh()
            except Exception as e:
                messagebox.showerror("错误", f"保存失败：{e}")

        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(8, 0))
        save_btn = tk.Button(btn, text="💾 保存", font=DarkTheme.FONT_BUTTON_BIG, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=save_edit, padx=18, pady=10)
        save_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(save_btn, DarkTheme.ACCENT_BLUE)
        cancel_btn = tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON_BIG, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=win.destroy, padx=18, pady=10)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

    def delete_record(self):
        rid = self._selected_id()
        if rid is None:
            return
        if not messagebox.askyesno("确认", f"确定删除记录 {rid}？"):
            return
        self.dm.delete_record(rid)
        messagebox.showinfo("成功", "已删除")
        self._refresh()

    def show_detail(self, event=None):
        rid = self._selected_id()
        if not rid or not (rec := self._find_record(rid)):
            return
        win = tk.Toplevel(self)
        win.title(f"详情 — {rid}")
        win.geometry("700x500")
        win.transient(self)
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center(win, 700, 500)

        mf = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        mf.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        renter, lease, st = rec.get("renter", {}), rec.get("lease_info", {}), rec.get("status", "")
        tk.Label(mf, text=f"📋 {rid}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)

        for lbl, val, color in [
            ("租赁人：", renter.get("name", ""), DarkTheme.TEXT_PRIMARY),
            ("电话：", renter.get("phone", ""), DarkTheme.TEXT_PRIMARY),
            ("身份证：", renter.get("id_card", ""), DarkTheme.TEXT_PRIMARY),
            ("地址：", renter.get("address", ""), DarkTheme.TEXT_PRIMARY),
            ("起租：", lease.get("start_date", ""), DarkTheme.TEXT_PRIMARY),
            ("到期：", lease.get("end_date", ""), self.STATUS_COLORS.get(st, DarkTheme.TEXT_PRIMARY)),
            ("月租：", f"¥{float(lease.get('monthly_rent', 0)):.2f}", DarkTheme.ACCENT_BLUE),
            ("总租金：", f"¥{float(lease.get('total_rent', 0)):.2f}", DarkTheme.ACCENT_BLUE),
            ("状态：", st, self.STATUS_COLORS.get(st, DarkTheme.TEXT_PRIMARY)),
        ]:
            row = tk.Frame(mf, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=lbl, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.W).pack(side=tk.LEFT)
            tk.Label(row, text=val, font=DarkTheme.FONT_NORMAL, fg=color,
                     bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, fill=tk.X, expand=True)

        btn_row = tk.Frame(mf, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(anchor=tk.E, pady=(10, 0), fill=tk.X)
        hist_btn = tk.Button(btn_row, text="📜 续租历史", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_PURPLE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._show_renew_history(rec), padx=14, pady=8)
        hist_btn.pack(side=tk.LEFT, padx=(0, 6))
        DarkTheme.bind_hover(hist_btn, DarkTheme.ACCENT_PURPLE)
        close_btn = tk.Button(btn_row, text="关闭", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=win.destroy, padx=14, pady=8)
        close_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(close_btn, DarkTheme.ACCENT_BLUE)

    def export_rentals(self):
        if not self._all:
            messagebox.showwarning("提示", "没有可导出的记录")
            return
        fp = filedialog.asksaveasfilename(title="导出 CSV", defaultextension=".csv",
                                          filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
                                          initialfile=f"租赁清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        if not fp:
            return
        headers = ["记录ID", "租赁人", "联系电话", "身份证", "地址", "起租日期", "到期日期",
                   "月租", "总租金", "押金", "已付金额", "状态"]
        try:
            with open(fp, "w", newline="", encoding="utf-8-sig") as f:
                w = csv.writer(f)
                w.writerow(headers)
                for r in self._all:
                    renter, lease = r.get("renter", {}), r.get("lease_info", {})
                    w.writerow([r.get("id", ""), renter.get("name", ""), renter.get("phone", ""),
                                renter.get("id_card", ""), renter.get("address", ""),
                                lease.get("start_date", ""), lease.get("end_date", ""),
                                lease.get("monthly_rent", ""), lease.get("total_rent", ""),
                                lease.get("deposit", ""), r.get("paid_amount", ""), r.get("status", "")])
            messagebox.showinfo("成功", f"已导出 {len(self._all)} 条记录\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败：{e}")

    def import_rentals(self):
        fp = filedialog.askopenfilename(title="导入 CSV",
                                        filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")])
        if not fp:
            return
        try:
            existing = {str(r.get("id", "")) for r in self.dm.get_records()}
            ok, errs = 0, []
            with open(fp, "r", newline="", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                if not reader.fieldnames:
                    messagebox.showerror("错误", "CSV 缺少表头")
                    return
                for idx, row in enumerate(reader, 2):
                    rid, nm = row.get("记录ID", "").strip(), row.get("租赁人", "").strip()
                    if not rid or not nm:
                        errs.append((idx, "记录ID和租赁人不能为空"))
                        continue
                    if rid in existing:
                        errs.append((idx, f"ID {rid} 已存在"))
                        continue
                    rec = {
                        "id": rid,
                        "renter": {"name": nm, "phone": row.get("联系电话", "").strip(),
                                   "id_card": row.get("身份证", "").strip(), "address": row.get("地址", "").strip()},
                        "lease_info": {"start_date": row.get("起租日期", "").strip(),
                                       "end_date": row.get("到期日期", "").strip(),
                                       "monthly_rent": row.get("月租", "").strip(),
                                       "total_rent": row.get("总租金", "").strip(),
                                       "deposit": row.get("押金", "").strip()},
                        "paid_amount": row.get("已付金额", "").strip() or "0",
                        "status": row.get("状态", "").strip() or "在租",
                    }
                    self.dm.add_record(rec)
                    existing.add(rid)
                    ok += 1
            msg = f"成功导入 {ok} 条"
            if errs:
                msg += f"\n跳过 {len(errs)} 行："
                for ri, er in errs[:5]:
                    msg += f"\n  第 {ri} 行：{er}"
                if len(errs) > 5:
                    msg += f"\n  …其余 {len(errs) - 5} 行略"
            messagebox.showinfo("导入结果", msg)
            self._refresh()
        except Exception as e:
            messagebox.showerror("错误", f"导入失败：{e}")

    def open_ai(self):
        try:
            from modules.ai_assistant import AIAssistantDialog
            AIAssistantDialog(self, self.app)
        except (ImportError, Exception):
            messagebox.showwarning("提示", "AI 助手模块未就绪")

    def _show_renew_history(self, rec):
        """显示租赁历史对话框"""
        dlg = RenewHistoryDialog(self, rec)
        dlg.show()

    def _edit_hardware_in_dialog(self, hardware_dict):
        """打开硬件编辑对话框"""
        dlg = HardwareDialog(self, hardware_dict)
        result = dlg.show()
        if result is not None:
            hardware_dict.update(result)

    def _center(self, win, w, h):
        x = (win.winfo_screenwidth() // 2) - (w // 2)
        y = (win.winfo_screenheight() // 2) - (h // 2)
        win.geometry(f"{w}x{h}+{x}+{y}")
