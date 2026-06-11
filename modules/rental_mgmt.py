#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""租赁管理模块 - 核心CRUD功能"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime, timedelta
import csv
from theme.colors import DarkTheme


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
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        ctrl = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        ctrl.pack(fill=tk.X, pady=(0, 10))

        tk.Label(ctrl, text="搜索:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY, 
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._apply_filter())
        ttk.Entry(ctrl, textvariable=self.search_var, width=28).pack(side=tk.LEFT, padx=(0, 12))

        tk.Label(ctrl, text="状态:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        self.status_var = tk.StringVar(value="全部")
        self.status_combo = ttk.Combobox(ctrl, textvariable=self.status_var, width=12,
                                         state="readonly", values=["全部", "在租", "已退租", "已丢失", "已买断", "已逾期"])
        self.status_combo.pack(side=tk.LEFT, padx=(0, 10))
        self.status_combo.bind("<<ComboboxSelected>>", lambda *_: self._apply_filter())
        ttk.Button(ctrl, text="🔄 刷新", command=self._refresh).pack(side=tk.LEFT)

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
            ("🔄 续租", self.renew_lease, DarkTheme.ACCENT_BLUE),
            ("✏️ 编辑", self.edit_record, DarkTheme.ACCENT_YELLOW),
            ("🗑️ 删除", self.delete_record, DarkTheme.ACCENT_RED),
            ("📥 批量导入", self.import_rentals, DarkTheme.ACCENT_GREEN),
            ("📤 批量导出", self.export_rentals, DarkTheme.ACCENT_GREEN),
            ("🤖 AI 助手", self.open_ai, DarkTheme.ACCENT_PURPLE),
        ]:
            b = tk.Button(btns, text=txt, font=DarkTheme.FONT_NORMAL, fg="white", bg=sty,
                           relief=tk.FLAT, cursor="hand2", command=cmd, padx=10, pady=6)
            b.pack(side=tk.LEFT, padx=4)

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
        tk.Button(btn_f, text="确认续租", font=DarkTheme.FONT_LABEL, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._do_renew(win, rec, lease, total, unit_var, time_e, amt_e, paid_e)
                  ).pack(side=tk.LEFT, padx=(0, 10))
        tk.Button(btn_f, text="取消", font=DarkTheme.FONT_LABEL, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=win.destroy).pack(side=tk.LEFT)

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
        messagebox.showinfo("提示", "编辑功能已简化为弹窗确认。点击确定后返回主页。")

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

        tk.Button(mf, text="关闭", font=DarkTheme.FONT_LABEL, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=win.destroy).pack(anchor=tk.E, pady=(10, 0))

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

    def _center(self, win, w, h):
        x = (win.winfo_screenwidth() // 2) - (w // 2)
        y = (win.winfo_screenheight() // 2) - (h // 2)
        win.geometry(f"{w}x{h}+{x}+{y}")
