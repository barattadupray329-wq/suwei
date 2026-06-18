#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""租赁管理模块 - 核心CRUD功能"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime, timedelta
import csv
from theme.colors import DarkTheme
from modules.hardware_mgmt import HardwareDialog


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
        self._record_index = {}  # ID→记录索引映射，加速查找
        self._right_frame = None  # 右侧面板引用
        self._current_form_refs = {}  # 当前表单控件引用
        # 大数据量优化
        self._page_size = 100  # 每页显示记录数
        self._current_page = 0  # 当前页码
        self._total_pages = 0  # 总页数
        self._build()
        self._refresh()

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        tk.Label(main, text="📋 租赁管理", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        # 双栏布局：左侧列表，右侧表单/详情
        self._paned = tk.PanedWindow(main, orient=tk.HORIZONTAL, bg=DarkTheme.BG_PRIMARY, sashwidth=6)
        self._paned.pack(fill=tk.BOTH, expand=True)

        # ── 左侧面板 ──
        left = tk.Frame(self._paned, bg=DarkTheme.BG_PRIMARY)
        self._paned.add(left, minsize=400)

        ctrl = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        ctrl.pack(fill=tk.X, pady=(0, 8))

        tk.Label(ctrl, text="搜索:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._apply_filter())
        ttk.Entry(ctrl, textvariable=self.search_var, width=28, font=DarkTheme.FONT_NORMAL).pack(side=tk.LEFT, padx=(0, 10), ipady=2)

        tk.Label(ctrl, text="状态:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        self.status_var = tk.StringVar(value="全部")
        self.status_combo = ttk.Combobox(ctrl, textvariable=self.status_var, width=10,
                                         state="readonly", values=["全部", "在租", "已退租", "已丢失", "已买断", "已逾期"])
        self.status_combo.pack(side=tk.LEFT, padx=(0, 8))
        self.status_combo.bind("<<ComboboxSelected>>", lambda *_: self._apply_filter())

        btn_row = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, pady=(0, 8))

        for txt, cmd, clr in [
            ("➕ 新增", self.add_new_record, DarkTheme.ACCENT_CYAN),
            ("✏️ 编辑", self.edit_record, DarkTheme.ACCENT_YELLOW),
            ("🗑️ 删除", self.delete_record, DarkTheme.ACCENT_RED),
            ("🔄 续租", self.renew_lease, DarkTheme.ACCENT_BLUE),
            ("📥 导入", self.import_rentals, DarkTheme.ACCENT_GREEN),
            ("📤 导出", self.export_rentals, DarkTheme.ACCENT_GREEN),
            ("🤖 AI", self.open_ai, DarkTheme.ACCENT_PURPLE),
        ]:
            b = tk.Button(btn_row, text=txt, font=DarkTheme.FONT_SMALL, fg="white", bg=clr,
                           relief=tk.FLAT, cursor="hand2", command=cmd, padx=10, pady=4)
            b.pack(side=tk.LEFT, padx=2)
            DarkTheme.bind_hover(b, clr)

        for txt, cmd, clr in [
            ("🔍 高级筛选", self._advanced_filter, DarkTheme.ACCENT_PURPLE),
            ("📋 报表", self._show_report, DarkTheme.ACCENT_CYAN),
            ("⚡ 批量操作", self._batch_operations, DarkTheme.ACCENT_YELLOW),
        ]:
            b = tk.Button(btn_row, text=txt, font=DarkTheme.FONT_SMALL, fg="white", bg=clr,
                           relief=tk.FLAT, cursor="hand2", command=cmd, padx=10, pady=4)
            b.pack(side=tk.LEFT, padx=2)
            DarkTheme.bind_hover(b, clr)

        # 分页容器
        self._page_frame = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        self._page_frame.pack(fill=tk.X, pady=(4, 0))

        table_frame = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        table_frame.pack(fill=tk.BOTH, expand=True)

        cols = ("ID", "数量", "租赁人", "联系电话", "到期时间", "总租金", "已付", "未付", "逾期(天)", "状态")
        self.tree = ttk.Treeview(table_frame, columns=cols, show="headings", height=14)
        widths = {"ID": 60, "数量": 40, "租赁人": 80, "联系电话": 100, "到期时间": 100, "总租金": 70, "已付": 70, "未付": 70, "逾期(天)": 70, "状态": 60}
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 80), anchor="center")

        vbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.bind("<Double-1>", self.show_detail)
        self.tree.bind("<<TreeviewSelect>>", lambda *_: self._on_tree_select())

        # ── 右侧面板 ──
        self._right_frame = tk.Frame(self._paned, bg=DarkTheme.BG_PRIMARY)
        self._paned.add(self._right_frame, minsize=300)
        self._show_right_placeholder()

    def _show_right_placeholder(self):
        """右侧占位提示"""
        for w in self._right_frame.winfo_children():
            w.destroy()
        tk.Label(self._right_frame, text="📄 选择记录查看详情\n或点击按钮进行编辑",
                 font=DarkTheme.FONT_SUBTITLE, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_PRIMARY, justify=tk.CENTER).pack(expand=True)

    def _on_tree_select(self):
        """选择列表项时自动在右侧显示详情"""
        sel = self.tree.selection()
        if not sel:
            return
        rid = self.tree.item(sel[0])["values"][0]
        rec = self._find_record(rid)
        if rec:
            self._show_detail_panel(rec)

    def _show_detail_panel(self, rec):
        """右侧显示详情面板"""
        self.dm.refresh_record_business_fields(rec)
        for w in self._right_frame.winfo_children():
            w.destroy()

        # 可滚动内容
        canvas = tk.Canvas(self._right_frame, bg=DarkTheme.BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self._right_frame, orient="vertical", command=canvas.yview)
        content = tk.Frame(canvas, bg=DarkTheme.BG_PRIMARY)
        content.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all"),
                                                                width=e.width, height=e.height))
        canvas_frame = canvas.create_window((0, 0), window=content, anchor="nw", width=600)
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        def _on_canvas_configure(event):
            canvas.itemconfig(canvas_frame, width=event.width)
        canvas.bind("<Configure>", _on_canvas_configure)

        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        rid = rec.get("id", "")
        renter = rec.get("renter", {})
        lease = rec.get("lease_info", {})
        st = rec.get("status", "")
        paid_amount = float(rec.get("paid_amount", 0) or 0)
        unpaid_amount = float(rec.get("unpaid_amount", 0) or 0)
        overdue_days = int(rec.get("overdue_days", 0) or 0)
        hardware_summary = self.dm.summarize_hardware(rec)

        # 标题行
        hdr = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Label(hdr, text=f"📋 {rid}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 详情列表
        details = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        details.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 8))

        for lbl, val, color in [
            ("数量", f"{int(rec.get('quantity', 1))} 套", DarkTheme.ACCENT_CYAN),
            ("租赁人", renter.get("name", ""), DarkTheme.TEXT_PRIMARY),
            ("电话", renter.get("phone", ""), DarkTheme.TEXT_PRIMARY),
            ("身份证", renter.get("id_card", "未填"), DarkTheme.TEXT_SECONDARY),
            ("地址", renter.get("address", "未填"), DarkTheme.TEXT_SECONDARY),
            ("起租日期", lease.get("start_date", ""), DarkTheme.TEXT_PRIMARY),
            ("到期日期", lease.get("end_date", ""), self.STATUS_COLORS.get(st, DarkTheme.TEXT_PRIMARY)),
            ("月租", f"¥{float(lease.get('monthly_rent', 0)):.2f}", DarkTheme.ACCENT_BLUE),
            ("总租金", f"¥{float(lease.get('total_rent', 0)):.2f}", DarkTheme.ACCENT_BLUE),
            ("已付金额", f"¥{paid_amount:.2f}", DarkTheme.ACCENT_GREEN),
            ("未付金额", f"¥{unpaid_amount:.2f}", DarkTheme.ACCENT_YELLOW if unpaid_amount > 0 else DarkTheme.TEXT_PRIMARY),
            ("逾期天数", f"{overdue_days} 天", DarkTheme.ACCENT_RED if overdue_days > 0 else DarkTheme.TEXT_PRIMARY),
            ("状态", st, self.STATUS_COLORS.get(st, DarkTheme.TEXT_PRIMARY)),
        ]:
            row = tk.Frame(details, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=f"{lbl}:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 6))
            tk.Label(row, text=str(val), font=DarkTheme.FONT_NORMAL, fg=color,
                     bg=DarkTheme.BG_PRIMARY, wraplength=260, justify=tk.LEFT).pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 硬件信息
        hw_frame = tk.Frame(details, bg=DarkTheme.BG_PRIMARY)
        hw_frame.pack(fill=tk.X, pady=(6, 0))
        tk.Label(hw_frame, text="硬件:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.NW).pack(side=tk.LEFT, padx=(0, 6), pady=(0, 0))
        hw_text = tk.Text(hw_frame, height=4, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                          bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, relief=tk.FLAT, padx=4, pady=4)
        hw_text.pack(side=tk.LEFT, fill=tk.X, expand=True)
        hw_text.insert("1.0", hardware_summary)
        hw_text.config(state=tk.DISABLED)

        # 操作按钮
        btn_row = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, padx=12, pady=(12, 8))

        for txt, cmd, clr in [
            ("✏️ 编辑", lambda r=rec: self._show_edit_form(r), DarkTheme.ACCENT_YELLOW),
            ("🔄 续租", lambda r=rec: self._show_renew_form(r), DarkTheme.ACCENT_BLUE),
            ("📜 续租历史", lambda r=rec: self._show_renew_history(r), DarkTheme.ACCENT_PURPLE),
            ("💰 收款", lambda r=rec: self._show_payment_form(r), DarkTheme.ACCENT_GREEN),
            ("⚙️ 硬件", lambda r=rec: self._edit_hardware_in_record(r), DarkTheme.ACCENT_CYAN),
            ("📄 合同", lambda r=rec: self._export_contract(r), DarkTheme.ACCENT_PRIMARY),
        ]:
            b = tk.Button(btn_row, text=txt, font=DarkTheme.FONT_SMALL, fg="white", bg=clr,
                           relief=tk.FLAT, cursor="hand2", command=cmd, padx=8, pady=4)
            b.pack(side=tk.LEFT, padx=3)
            DarkTheme.bind_hover(b, clr)

    def _refresh(self):
        self.dm.check_overdue()
        self._all = self.dm.get_records()
        # 构建索引
        self._record_index = {r.get("id"): r for r in self._all}
        self._current_page = 0  # 重置到第一页
        self._apply_filter()

    def _find_record(self, rid):
        """使用索引加速查找，O(1)复杂度"""
        return self._record_index.get(rid)

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
        self._current_page = 0  # 重置到第一页
        self._render_tree()

    def _render_tree(self):
        """分页渲染 Treeview，支持大数据量"""
        total = len(self._shown)
        if total == 0:
            for i in self.tree.get_children():
                self.tree.delete(i)
            return

        # 计算分页
        self._total_pages = max(1, (total + self._page_size - 1) // self._page_size)
        self._current_page = min(self._current_page, self._total_pages - 1)

        start = self._current_page * self._page_size
        end = min(start + self._page_size, total)
        page_data = self._shown[start:end]

        # 批量删除并插入
        for i in self.tree.get_children():
            self.tree.delete(i)

        # 批量插入（比逐条插入快）
        items = []
        for r in page_data:
            # 只刷新当前页记录的业务字段，减少计算量
            self.dm.refresh_record_business_fields(r)
            renter = r.get("renter", {})
            lease = r.get("lease_info", {})
            st = r.get("status", "")
            total_rent = lease.get("total_rent", 0) or 0
            paid = r.get("paid_amount", 0) or 0
            unpaid = r.get("unpaid_amount", 0) or 0
            overdue_days = r.get("overdue_days", 0) or 0
            items.append((
                r.get("id", ""),
                int(r.get("quantity", 1)),
                renter.get("name", ""),
                renter.get("phone", ""),
                lease.get("end_date", ""),
                f"¥{total_rent:.2f}",
                f"¥{paid:.2f}",
                f"¥{unpaid:.2f}",
                overdue_days,
                st
            ))

        for vals in items:
            self.tree.insert("", tk.END, values=vals, tags=(vals[9],))
        for st, clr in self.STATUS_COLORS.items():
            self.tree.tag_configure(st, foreground=clr)

        # 更新分页信息
        self._update_pagination(total, start, end)

    def _update_pagination(self, total, start, end):
        """更新分页控件和状态"""
        # 清空旧的分页控件内容
        for w in self._page_frame.winfo_children():
            w.destroy()

        # 上一页按钮
        prev_btn = tk.Button(self._page_frame, text="◀ 上一页", font=DarkTheme.FONT_SMALL,
                            fg="white", bg=DarkTheme.ACCENT_BLUE if self._current_page > 0 else DarkTheme.BG_HOVER,
                            relief=tk.FLAT, cursor="hand2" if self._current_page > 0 else "arrow",
                            command=self._prev_page, padx=8, pady=3)
        prev_btn.pack(side=tk.LEFT, padx=2)
        if self._current_page > 0:
            DarkTheme.bind_hover(prev_btn, DarkTheme.darken(DarkTheme.ACCENT_BLUE, 15))

        # 页码信息
        page_info = f"第 {self._current_page + 1}/{self._total_pages} 页 (共 {total} 条，显示 {start+1}-{end})"
        tk.Label(self._page_frame, text=page_info, font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=10)

        # 下一页按钮
        next_btn = tk.Button(self._page_frame, text="下一页 ▶", font=DarkTheme.FONT_SMALL,
                            fg="white", bg=DarkTheme.ACCENT_BLUE if self._current_page < self._total_pages - 1 else DarkTheme.BG_HOVER,
                            relief=tk.FLAT, cursor="hand2" if self._current_page < self._total_pages - 1 else "arrow",
                            command=self._next_page, padx=8, pady=3)
        next_btn.pack(side=tk.LEFT, padx=2)
        if self._current_page < self._total_pages - 1:
            DarkTheme.bind_hover(next_btn, DarkTheme.darken(DarkTheme.ACCENT_BLUE, 15))

    def _prev_page(self):
        if self._current_page > 0:
            self._current_page -= 1
            self._render_tree()

    def _next_page(self):
        if self._current_page < self._total_pages - 1:
            self._current_page += 1
            self._render_tree()

    def _selected_id(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("提示", "请先选择一条记录")
            return None
        return self.tree.item(sel[0])["values"][0]


    def _advanced_filter(self):
        """在右侧面板显示高级筛选表单"""
        self._show_filter_panel()

    def _show_report(self):
        """在右侧面板显示报表"""
        self._show_report_panel()

    def add_new_record(self):
        """弹出新增租赁记录窗口"""
        self._show_add_form_dialog()

    def renew_lease(self):
        """切换到续租表单（优先使用选中记录）"""
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("提示", "请先选择一条记录")
            return
        rid = self.tree.item(sel[0])["values"][0]
        rec = self._find_record(rid)
        if rec:
            self._show_renew_form(rec)
        else:
            messagebox.showwarning("提示", "未找到该记录")

    def edit_record(self):
        """切换到编辑表单（优先使用选中记录）"""
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("提示", "请先选择一条记录")
            return
        rid = self.tree.item(sel[0])["values"][0]
        rec = self._find_record(rid)
        if rec:
            self._show_edit_form(rec)
        else:
            messagebox.showwarning("提示", "未找到该记录")

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
        """双击或选择记录时，在右侧面板显示详情"""
        sel = self.tree.selection()
        if not sel:
            return
        rid = self.tree.item(sel[0])["values"][0]
        rec = self._find_record(rid)
        if rec:
            self._show_detail_panel(rec)

    def export_rentals(self):
        if not self._all:
            messagebox.showwarning("提示", "没有可导出的记录")
            return
        fp = filedialog.asksaveasfilename(title="导出 CSV", defaultextension=".csv",
                                          filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
                                          initialfile=f"租赁清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        if not fp:
            return
        headers = ["记录ID", "数量", "租赁人", "联系电话", "身份证", "地址", "起租日期", "到期日期",
                   "月租", "总租金", "押金", "已付金额", "状态"]
        try:
            with open(fp, "w", newline="", encoding="utf-8-sig") as f:
                w = csv.writer(f)
                w.writerow(headers)
                for r in self._all:
                    renter, lease = r.get("renter", {}), r.get("lease_info", {})
                    w.writerow([r.get("id", ""), int(r.get("quantity", 1)), renter.get("name", ""), renter.get("phone", ""),
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
                    rid = row.get("记录ID", "").strip()
                    nm = row.get("租赁人", "").strip()
                    if not rid or not nm:
                        errs.append((idx, "记录ID和租赁人不能为空"))
                        continue
                    if rid in existing:
                        errs.append((idx, f"ID {rid} 已存在"))
                        continue
                    qty_str = (row.get("数量") or "1").strip() or "1"
                    rec = {
                        "id": rid,
                        "quantity": float(qty_str),
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
        """在右侧面板显示AI助手"""
        self._show_ai_panel()

    def _show_renew_history(self, rec):
        """在右侧面板显示续租历史"""
        self._show_renew_history_panel(rec)

    def _edit_hardware_in_record(self, rec):
        """从记录详情面板编辑硬件"""
        hardware_data = rec.get("hardware", {})
        dlg = HardwareDialog(self, hardware_data, data_manager=self.dm)
        result = dlg.show()
        if result is not None:
            rec["hardware"] = result
            self.dm.save()
            self._show_detail_panel(rec)
            self._refresh()

    def _edit_hardware_inline(self, hardware_dict):
        """从表单面板编辑硬件"""
        dlg = HardwareDialog(self, hardware_dict, data_manager=self.dm)
        result = dlg.show()
        if result is not None:
            hardware_dict.update(result)

    # ═══ 高级筛选面板 ═══

    def _show_filter_panel(self):
        """右侧显示高级筛选表单"""
        self._clear_right_panel()

        canvas = tk.Canvas(self._right_frame, bg=DarkTheme.BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self._right_frame, orient="vertical", command=canvas.yview)
        form = tk.Frame(canvas, bg=DarkTheme.BG_PRIMARY)
        form.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all"),
                                                             width=e.width, height=e.height))
        canvas_frame = canvas.create_window((0, 0), window=form, anchor="nw", width=600)
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        def _on_canvas_configure(event):
            canvas.itemconfig(canvas_frame, width=event.width)
        canvas.bind("<Configure>", _on_canvas_configure)

        # 标题
        hdr = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Label(hdr, text="🔍 高级筛选", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_PURPLE, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)
        tk.Button(hdr, text="✕", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                  bg=DarkTheme.BG_PRIMARY, relief=tk.FLAT, cursor="hand2",
                  command=self._show_right_placeholder).pack(side=tk.RIGHT)

        refs = {}

        tk.Label(form, text="日期格式：YYYY-MM-DD；金额可留空", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=12, pady=(0, 8))

        for label, key in [
            ("关键词(全字段)", "keyword"), ("起租日期从", "start_date_from"),
            ("起租日期到", "start_date_to"), ("到期日期从", "end_date_from"),
            ("到期日期到", "end_date_to"), ("总租金最小值", "total_rent_min"),
            ("总租金最大值", "total_rent_max"), ("已付金额最小值", "paid_min"),
            ("已付金额最大值", "paid_max"),
        ]:
            refs[key] = self._make_field(form, label, "", width=26)

        # 按钮
        btn = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Button(btn, text="🔍 应用筛选", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._apply_filter_inline(refs), padx=14, pady=8).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="🗑 清空条件", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_RED, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._clear_filter(refs), padx=14, pady=8).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=self._show_right_placeholder, padx=14, pady=8).pack(side=tk.LEFT)

    def _apply_filter_inline(self, refs):
        """应用筛选条件到左侧列表"""
        kw = refs.get("keyword", tk.StringVar()).get().strip().lower() if hasattr(refs.get("keyword"), 'get') else refs.get("keyword", "")
        start_from = refs.get("start_date_from", tk.StringVar()).get().strip() if hasattr(refs.get("start_date_from"), 'get') else refs.get("start_date_from", "")
        start_to = refs.get("start_date_to", tk.StringVar()).get().strip() if hasattr(refs.get("start_date_to"), 'get') else refs.get("start_date_to", "")
        end_from = refs.get("end_date_from", tk.StringVar()).get().strip() if hasattr(refs.get("end_date_from"), 'get') else refs.get("end_date_from", "")
        end_to = refs.get("end_date_to", tk.StringVar()).get().strip() if hasattr(refs.get("end_date_to"), 'get') else refs.get("end_date_to", "")
        rent_min_str = refs.get("total_rent_min", tk.StringVar()).get().strip() if hasattr(refs.get("total_rent_min"), 'get') else refs.get("total_rent_min", "")
        rent_max_str = refs.get("total_rent_max", tk.StringVar()).get().strip() if hasattr(refs.get("total_rent_max"), 'get') else refs.get("total_rent_max", "")
        paid_min_str = refs.get("paid_min", tk.StringVar()).get().strip() if hasattr(refs.get("paid_min"), 'get') else refs.get("paid_min", "")
        paid_max_str = refs.get("paid_max", tk.StringVar()).get().strip() if hasattr(refs.get("paid_max"), 'get') else refs.get("paid_max", "")

        rent_min = float(rent_min_str) if rent_min_str else 0
        rent_max = float(rent_max_str) if rent_max_str else float('inf')
        paid_min = float(paid_min_str) if paid_min_str else 0
        paid_max = float(paid_max_str) if paid_max_str else float('inf')

        filtered = []
        for r in self._all:
            if kw:
                renter = r.get("renter", {})
                haystack = (str(r.get("id", "")) + str(renter.get("name", "")) + str(renter.get("phone", ""))).lower()
                if kw not in haystack:
                    continue

            lease = r.get("lease_info", {})
            start_date = lease.get("start_date", "")
            end_date = lease.get("end_date", "")

            if start_from and start_date < start_from:
                continue
            if start_to and start_date > start_to:
                continue
            if end_from and end_date < end_from:
                continue
            if end_to and end_date > end_to:
                continue

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

    def _clear_filter(self, refs):
        """清空筛选条件"""
        for key, ent in refs.items():
            if hasattr(ent, 'delete'):
                ent.delete(0, tk.END)
        self._shown = list(self._all)
        self._render_tree()
        self.search_var.set("")

    # ═══ 报表面板 ═══

    def _show_report_panel(self):
        """右侧显示统计报表"""
        self._clear_right_panel()

        canvas = tk.Canvas(self._right_frame, bg=DarkTheme.BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self._right_frame, orient="vertical", command=canvas.yview)
        content = tk.Frame(canvas, bg=DarkTheme.BG_PRIMARY)
        content.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all"),
                                                                width=e.width, height=e.height))
        canvas_frame = canvas.create_window((0, 0), window=content, anchor="nw", width=600)
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        def _on_canvas_configure(event):
            canvas.itemconfig(canvas_frame, width=event.width)
        canvas.bind("<Configure>", _on_canvas_configure)

        stats = self.dm.get_stats()
        records = self.dm.get_records()
        total_rent = sum(float(r.get("lease_info", {}).get("total_rent", 0) or 0) for r in records)
        paid_amount = sum(float(r.get("paid_amount", 0) or 0) for r in records)
        unpaid_amount = total_rent - paid_amount

        # 标题
        hdr = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Label(hdr, text="📊 租赁统计报表", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)
        tk.Button(hdr, text="✕", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                  bg=DarkTheme.BG_PRIMARY, relief=tk.FLAT, cursor="hand2",
                  command=self._show_right_placeholder).pack(side=tk.RIGHT)

        # 状态卡片
        cards = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        cards.pack(fill=tk.X, padx=12, pady=(0, 12))
        card_items = [
            ("总记录数", stats["total"], DarkTheme.ACCENT_CYAN),
            ("在租中", stats["active"], DarkTheme.ACCENT_BLUE),
            ("已逾期", stats["expired"], DarkTheme.ACCENT_RED),
            ("已退租", stats["returned"], DarkTheme.ACCENT_GREEN),
            ("已丢失", stats["lost"], DarkTheme.ACCENT_YELLOW),
            ("已买断", stats["bought"], DarkTheme.ACCENT_PURPLE),
        ]
        for label, value, color in card_items:
            card = tk.Frame(cards, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
            card.pack(side=tk.LEFT, padx=3, fill=tk.BOTH, expand=True)
            tk.Label(card, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD).pack(pady=(8, 2))
            tk.Label(card, text=str(value), font=("微软雅黑", 18, "bold"), fg=color, bg=DarkTheme.BG_CARD).pack(pady=(2, 8))

        # 金额概览
        amount_box = tk.Frame(content, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        amount_box.pack(fill=tk.X, padx=12, pady=(0, 12))
        tk.Label(amount_box, text="💰 金额概览", font=("微软雅黑", 12, "bold"), fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=12, pady=(10, 6))
        for lbl, val, color in [
            ("总租金", total_rent, DarkTheme.ACCENT_BLUE),
            ("已收金额", paid_amount, DarkTheme.ACCENT_GREEN),
            ("未收金额", unpaid_amount, DarkTheme.ACCENT_RED),
        ]:
            row = tk.Frame(amount_box, bg=DarkTheme.BG_CARD)
            row.pack(fill=tk.X, padx=12, pady=2)
            tk.Label(row, text=f"{lbl}：", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD, width=12, anchor=tk.W).pack(side=tk.LEFT)
            tk.Label(row, text=f"¥{val:.2f}", font=("微软雅黑", 14, "bold"), fg=color, bg=DarkTheme.BG_CARD).pack(side=tk.LEFT)

        # 状态分布
        status_box = tk.Frame(content, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        status_box.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 12))
        tk.Label(status_box, text="📈 状态分布", font=("微软雅黑", 12, "bold"), fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=12, pady=(10, 6))
        total = max(1, stats["total"])
        for label, value, color in [
            ("在租", stats["active"], DarkTheme.STATUS_ACTIVE),
            ("逾期", stats["expired"], DarkTheme.STATUS_EXPIRED),
            ("退租", stats["returned"], DarkTheme.STATUS_RETURNED),
            ("丢失", stats["lost"], DarkTheme.STATUS_LOST),
            ("买断", stats["bought"], DarkTheme.STATUS_BOUGHT),
        ]:
            row = tk.Frame(status_box, bg=DarkTheme.BG_CARD)
            row.pack(fill=tk.X, padx=12, pady=3)
            tk.Label(row, text=f"{label}：{value}", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD, width=12, anchor=tk.W).pack(side=tk.LEFT)
            bar = tk.Frame(row, bg=DarkTheme.BG_INPUT, height=14)
            bar.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(4, 0))
            fill = tk.Frame(bar, bg=color, height=14, width=max(2, int((value / total) * 360)))
            fill.pack(side=tk.LEFT, fill=tk.Y)

        # 按钮
        btn = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, padx=12, pady=(0, 8))
        tk.Button(btn, text="📤 导出 CSV", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._export_report(stats, total_rent, paid_amount, unpaid_amount), padx=14, pady=8).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="关闭", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=self._show_right_placeholder, padx=14, pady=8).pack(side=tk.LEFT)

    def _export_report(self, stats, total_rent, paid_amount, unpaid_amount):
        fp = filedialog.asksaveasfilename(
            title="导出租赁报表", defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
            initialfile=f"租赁报表_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        if not fp:
            return
        try:
            with open(fp, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["项目", "值"])
                for k, v in stats.items():
                    writer.writerow([k, v])
                writer.writerow([])
                writer.writerow(["总租金", f"{total_rent:.2f}"])
                writer.writerow(["已收金额", f"{paid_amount:.2f}"])
                writer.writerow(["未收金额", f"{unpaid_amount:.2f}"])
            messagebox.showinfo("成功", f"报表已导出\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败：{e}")

    # ═══ 续租历史面板 ═══

    def _show_renew_history_panel(self, rec):
        """右侧显示续租历史"""
        self._clear_right_panel()

        rid = rec.get("id", "")
        renew_history = rec.get("renew_history", []) or []

        # 标题
        hdr = tk.Frame(self._right_frame, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Label(hdr, text=f"🔄 续租历史 — {rid}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_PURPLE, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)
        tk.Button(hdr, text="✕", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                  bg=DarkTheme.BG_PRIMARY, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._show_detail_panel(rec)).pack(side=tk.RIGHT)

        if not renew_history:
            tk.Label(self._right_frame, text="暂无续租记录", font=DarkTheme.FONT_NORMAL,
                     fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(pady=40)
        else:
            # 历史记录表格
            cols = ("续租时间", "时长", "单位", "金额", "原到期", "新到期", "操作人")
            tree = ttk.Treeview(self._right_frame, columns=cols, show="headings", height=min(len(renew_history), 15))
            widths = {"续租时间": 140, "时长": 50, "单位": 40, "金额": 80,
                      "原到期": 90, "新到期": 90, "操作人": 80}
            for c in cols:
                tree.heading(c, text=c)
                tree.column(c, width=widths.get(c, 80), anchor="center")

            vbar = ttk.Scrollbar(self._right_frame, orient="vertical", command=tree.yview)
            tree.configure(yscrollcommand=vbar.set)
            tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            vbar.pack(side=tk.RIGHT, fill=tk.Y)

            for item in renew_history:
                tree.insert("", tk.END, values=(
                    item.get("renew_date", ""),
                    item.get("renew_time", ""),
                    item.get("renew_unit", ""),
                    f"¥{float(item.get('renew_amount', 0) or 0):.2f}",
                    item.get("old_end_date", ""),
                    item.get("new_end_date", ""),
                    item.get("operator", ""),
                ))

        # 按钮
        btn = tk.Frame(self._right_frame, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, padx=12, pady=(8, 8))
        if renew_history:
            tk.Button(btn, text="📤 导出 CSV", font=DarkTheme.FONT_BUTTON, fg="white",
                      bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT, cursor="hand2",
                      command=lambda: self._export_renew_history(renew_history, rid), padx=14, pady=8).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="返回详情", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._show_detail_panel(rec), padx=14, pady=8).pack(side=tk.LEFT)

    def _export_renew_history(self, history, rid):
        fp = filedialog.asksaveasfilename(
            title="导出续租历史", defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
            initialfile=f"续租历史_{rid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        if not fp:
            return
        try:
            with open(fp, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["续租时间", "时长", "单位", "金额", "原到期", "新到期", "操作人"])
                for h in history:
                    writer.writerow([
                        h.get("renew_date", ""), h.get("renew_time", ""),
                        h.get("renew_unit", ""), h.get("renew_amount", ""),
                        h.get("old_end_date", ""), h.get("new_end_date", ""),
                        h.get("operator", ""),
                    ])
            messagebox.showinfo("成功", f"已导出续租历史\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败：{e}")

    # ═══ AI 助手面板 ═══

    def _show_ai_panel(self):
        """右侧显示 AI 助手面板"""
        self._clear_right_panel()
        
        from modules.ai_assistant_frame import AIAssistantFrame
        ai_frame = AIAssistantFrame(
            self._right_frame,
            self,
            self.dm,
            on_record_created=lambda rec: self._refresh(),
            on_navigate_to_record=lambda rid: self._navigate_to_record(rid)
        )
        ai_frame.pack(fill=tk.BOTH, expand=True)

    def _batch_operations(self):
        """批量操作对话框"""
        win = tk.Toplevel(self)
        win.title("⚡ 批量操作")
        win.geometry("500x450")
        win.transient(self)
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        win.update_idletasks()
        w, h = 500, 450
        x = (win.winfo_screenwidth() // 2) - (w // 2)
        y = (win.winfo_screenheight() // 2) - (h // 2)
        win.geometry(f"{w}x{h}+{x}+{y}")

        def _safe_close(w=win):
            try:
                w.grab_release()
            except Exception:
                pass
            w.destroy()

        win.protocol("WM_DELETE_WINDOW", _safe_close)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        tk.Label(main, text="⚡ 批量操作", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_YELLOW, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 10))

        # 筛选条件
        filter_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        filter_frame.pack(fill=tk.X, pady=(0, 10))

        tk.Label(filter_frame, text="操作范围：", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        
        scope_var = tk.StringVar(value="selected")
        for val, txt in [("selected", "已选中项"), ("current_filter", "当前筛选结果"), ("all", "全部记录")]:
            tk.Radiobutton(filter_frame, text=txt, variable=scope_var, value=val,
                          font=DarkTheme.FONT_NORMAL, bg=DarkTheme.BG_PRIMARY,
                          fg=DarkTheme.TEXT_PRIMARY, selectcolor=DarkTheme.ACCENT_BLUE).pack(anchor=tk.W)

        tk.Label(main, text="操作类型：", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(10, 4))

        action_var = tk.StringVar(value="status_change")
        action_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        action_frame.pack(fill=tk.X, pady=(0, 10))
        
        actions = [
            ("status_change", "📝 批量更改状态"),
            ("export", "📤 批量导出为 Excel"),
            ("renew", "🔄 批量续租（加 1 个月）"),
            ("delete", "🗑️ 批量删除"),
        ]
        for val, txt in actions:
            tk.Radiobutton(action_frame, text=txt, variable=action_var, value=val,
                          font=DarkTheme.FONT_NORMAL, bg=DarkTheme.BG_PRIMARY,
                          fg=DarkTheme.TEXT_PRIMARY, selectcolor=DarkTheme.ACCENT_BLUE).pack(anchor=tk.W)

        # 操作按钮
        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(16, 0))
        tk.Button(btn, text="✅ 执行操作", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._execute_batch(scope_var.get(), action_var.get(), win),
                  padx=14, pady=8).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=_safe_close, padx=14, pady=8).pack(side=tk.LEFT)

    def _execute_batch(self, scope, action, win):
        """执行批量操作"""
        # 获取目标记录
        if scope == "selected":
            selected = self.tree.selection()
            if not selected:
                messagebox.showwarning("提示", "请先在列表中选中记录")
                return
            target_ids = [self.tree.item(iid)["values"][0] for iid in selected]
            target_records = [self._find_record(rid) for rid in target_ids]
        elif scope == "current_filter":
            target_records = list(self._shown)
        else:  # all
            target_records = list(self._all)

        if not target_records:
            messagebox.showinfo("提示", "没有可操作的记录")
            return

        if action == "status_change":
            self._batch_status_change(target_records, win)
        elif action == "export":
            self._batch_export(target_records, win)
        elif action == "renew":
            self._batch_renew(target_records, win)
        elif action == "delete":
            self._batch_delete(target_records, win)

    def _batch_status_change(self, records, win):
        """批量更改状态"""
        status_win = tk.Toplevel(win)
        status_win.title("📝 批量更改状态")
        status_win.geometry("350x180")
        status_win.transient(win)
        status_win.grab_set()
        status_win.configure(bg=DarkTheme.BG_PRIMARY)

        def _safe_close(w=status_win):
            try:
                w.grab_release()
            except Exception:
                pass
            w.destroy()

        status_win.protocol("WM_DELETE_WINDOW", _safe_close)

        main = tk.Frame(status_win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        tk.Label(main, text=f"将 {len(records)} 条记录更改为：", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))

        status_var = tk.StringVar(value="在租")
        status_combo = ttk.Combobox(main, textvariable=status_var, state="readonly",
                                    values=["在租", "已退租", "已丢失", "已买断", "已逾期"], width=20)
        status_combo.pack(fill=tk.X, pady=(0, 12))

        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X)
        tk.Button(btn, text="✅ 确认", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._do_batch_status(records, status_var.get(), status_win, win),
                  padx=14, pady=6).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=_safe_close, padx=14, pady=6).pack(side=tk.LEFT)

    def _do_batch_status(self, records, new_status, status_win, batch_win):
        """执行批量状态更改"""
        if not messagebox.askyesno("确认", f"确定将 {len(records)} 条记录更改为「{new_status}」吗？"):
            return
        
        count = 0
        for rec in records:
            rec["status"] = new_status
            self.dm.refresh_record_business_fields(rec)
            count += 1
        
        self.dm.save()
        messagebox.showinfo("成功", f"已批量更改 {count} 条记录状态为「{new_status}」")
        status_win.destroy()
        batch_win.destroy()
        self._refresh()

    def _batch_export(self, records, win):
        """批量导出为 Excel"""
        fp = filedialog.asksaveasfilename(
            title="批量导出记录",
            defaultextension=".xlsx",
            filetypes=[("Excel 文件", "*.xlsx"), ("所有文件", "*.*")],
            initialfile=f"批量导出_{len(records)}条_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        )
        if not fp:
            return
        
        try:
            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "租赁记录"

            headers = ["记录ID", "数量", "租赁人", "联系电话", "身份证", "地址",
                      "起租日期", "到期日期", "月租", "总租金", "押金", "已付金额", "未付金额", "逾期天数", "状态"]
            for col, h in enumerate(headers, 1):
                ws.cell(row=1, column=col, value=h)

            for row_idx, rec in enumerate(records, 2):
                renter = rec.get("renter", {})
                lease = rec.get("lease_info", {})
                ws.cell(row=row_idx, column=1, value=rec.get("id", ""))
                ws.cell(row=row_idx, column=2, value=int(rec.get("quantity", 1)))
                ws.cell(row=row_idx, column=3, value=renter.get("name", ""))
                ws.cell(row=row_idx, column=4, value=renter.get("phone", ""))
                ws.cell(row=row_idx, column=5, value=renter.get("id_card", ""))
                ws.cell(row=row_idx, column=6, value=renter.get("address", ""))
                ws.cell(row=row_idx, column=7, value=lease.get("start_date", ""))
                ws.cell(row=row_idx, column=8, value=lease.get("end_date", ""))
                ws.cell(row=row_idx, column=9, value=float(lease.get("monthly_rent", 0) or 0))
                ws.cell(row=row_idx, column=10, value=float(lease.get("total_rent", 0) or 0))
                ws.cell(row=row_idx, column=11, value=float(lease.get("deposit", 0) or 0))
                ws.cell(row=row_idx, column=12, value=float(rec.get("paid_amount", 0) or 0))
                ws.cell(row=row_idx, column=13, value=float(rec.get("unpaid_amount", 0) or 0))
                ws.cell(row=row_idx, column=14, value=int(rec.get("overdue_days", 0) or 0))
                ws.cell(row=row_idx, column=15, value=rec.get("status", ""))

            wb.save(fp)
            messagebox.showinfo("成功", f"已导出 {len(records)} 条记录\n{fp}")
            win.destroy()
        except ImportError:
            messagebox.showerror("错误", "缺少 openpyxl 库，请先安装: pip install openpyxl")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败：{e}")

    def _batch_renew(self, records, win):
        """批量续租（加 1 个月）"""
        if not messagebox.askyesno("确认续租", f"确定将 {len(records)} 条在租记录续租 1 个月吗？"):
            return
        
        count = 0
        for rec in records:
            if rec.get("status") not in ("在租", "已逾期"):
                continue
            lease = rec.get("lease_info", {})
            end_str = lease.get("end_date", "")
            if not end_str:
                continue
            
            try:
                cur_end = datetime.strptime(end_str, "%Y-%m-%d")
                new_end = cur_end + timedelta(days=30)
                monthly_rent = float(lease.get("monthly_rent", 0) or 0)
                
                lease["end_date"] = new_end.strftime("%Y-%m-%d")
                lease["total_rent"] = float(lease.get("total_rent", 0) or 0) + monthly_rent
                
                rec.setdefault("renew_history", []).append({
                    "renew_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "renew_time": 1.0, "renew_unit": "月", "renew_amount": monthly_rent,
                    "old_end_date": cur_end.strftime("%Y-%m-%d"),
                    "new_end_date": new_end.strftime("%Y-%m-%d"),
                    "operator": self.app.username or "系统",
                })
                self.dm.refresh_record_business_fields(rec)
                count += 1
            except Exception:
                continue
        
        if count > 0:
            self.dm.save()
            messagebox.showinfo("成功", f"已批量续租 {count} 条记录")
        else:
            messagebox.showinfo("提示", "没有可续租的记录")
        
        win.destroy()
        self._refresh()

    def _batch_delete(self, records, win):
        """批量删除"""
        if not messagebox.askyesno("确认删除", f"确定删除 {len(records)} 条记录吗？此操作不可恢复！"):
            return
        
        count = 0
        for rec in records:
            rid = rec.get("id", "")
            if rid:
                self.dm.delete_record(rid)
                count += 1
        
        messagebox.showinfo("成功", f"已批量删除 {count} 条记录")
        win.destroy()
        self._refresh()

    def _clear_right_panel(self):
        """清空右侧面板"""
        self._current_form_refs = {}
        for w in self._right_frame.winfo_children():
            w.destroy()

    def _show_add_form_dialog(self):
        """弹出新增租赁记录窗口（内部保持卡片形式）"""
        win = tk.Toplevel(self)
        win.title("新增租赁记录")
        win.geometry("950x700")
        win.minsize(800, 600)
        win.configure(bg=DarkTheme.BG_PRIMARY)
        
        # 居中窗口
        def _center_window(w, h):
            win.update_idletasks()
            x = (win.winfo_screenwidth() // 2) - (w // 2)
            y = (win.winfo_screenheight() // 2) - (h // 2)
            win.geometry(f"{w}x{h}+{x}+{y}")
        
        _center_window(950, 700)
        
        # 在窗口内标题
        hdr = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=16, pady=(12, 8))
        tk.Label(hdr, text="➡️ 新增租赁记录", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)
        
        # 将表单整合到窗口中
        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=(0, 12))
        refs = {}
        
        # 步骤标签
        steps = ["① 客户信息", "② 租赁信息", "③ 金额与状态", "④ 硬件信息"]
        current_step = {"index": 0}
        step_bar = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        step_bar.pack(fill=tk.X, pady=(0, 8))
        step_buttons = []
        
        card_host = tk.Frame(main, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        card_host.pack(fill=tk.BOTH, expand=True)
        cards = []
        
        # ── 卡睇1：客户信息 ──
        card1 = tk.Frame(card_host, bg=DarkTheme.BG_PRIMARY)
        card1.pack(fill=tk.BOTH, expand=True)
        cards.append(card1)
        tk.Label(card1, text="客户基础信息", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(12, 8))
        refs['name_e'] = self._make_field(card1, "租赁人*", "")
        refs['phone_e'] = self._make_field(card1, "联系电话*", "")
        refs['id_e'] = self._make_field(card1, "身份证", "")
        refs['quantity_e'] = self._make_field(card1, "数量*", "1")
        addr_row = tk.Frame(card1, bg=DarkTheme.BG_PRIMARY)
        addr_row.pack(fill=tk.X, pady=3)
        tk.Label(addr_row, text="地址", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.NW).pack(side=tk.LEFT, padx=(0, 4))
        addr_t = tk.Text(addr_row, height=3, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                         bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, insertbackground=DarkTheme.TEXT_PRIMARY)
        addr_t.pack(side=tk.LEFT, fill=tk.X, expand=True)
        refs['addr_t'] = addr_t
        
        # ── 卡睇2：租赁信息 ──
        card2 = tk.Frame(card_host, bg=DarkTheme.BG_PRIMARY)
        cards.append(card2)
        tk.Label(card2, text="租赁周期与租金", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(12, 8))
        refs['start_e'] = self._make_field(card2, "起租日期*", datetime.now().strftime("%Y-%m-%d"))
        refs['months_e'] = self._make_field(card2, "月数*", "1")
        refs['monthly_e'] = self._make_field(card2, "月租*", "0")
        refs['total_e'] = self._make_field(card2, "总租金*", "0")
        refs['end_e'] = self._make_field(card2, "到期日期*", (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"))
        
        # ── 卡睇3：金额与状态 ──
        card3 = tk.Frame(card_host, bg=DarkTheme.BG_PRIMARY)
        cards.append(card3)
        tk.Label(card3, text="付款与状态", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_GREEN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(12, 8))
        refs['deposit_e'] = self._make_field(card3, "押金", "0")
        refs['paid_e'] = self._make_field(card3, "已付金额", "0")
        st_row = tk.Frame(card3, bg=DarkTheme.BG_PRIMARY)
        st_row.pack(fill=tk.X, pady=3)
        tk.Label(st_row, text="状态", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        refs['status_var'] = tk.StringVar(value="在租")
        st_combo = ttk.Combobox(st_row, textvariable=refs['status_var'], state="readonly",
                                values=["在租", "已退租", "已丢失", "已买断", "已逾期"], width=20)
        st_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # ── 卡睇4：硬件信息 ──
        card4 = tk.Frame(card_host, bg=DarkTheme.BG_PRIMARY)
        cards.append(card4)
        tk.Label(card4, text="硬件配置", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_PURPLE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(12, 8))
        refs['hardware_data'] = {}
        hw_row = tk.Frame(card4, bg=DarkTheme.BG_PRIMARY)
        hw_row.pack(fill=tk.X, pady=6)
        tk.Label(hw_row, text="硬件信息", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        hw_btn = tk.Button(hw_row, text="⚙️ 编辑", font=DarkTheme.FONT_SMALL, fg="white",
                           bg=DarkTheme.ACCENT_PURPLE, relief=tk.FLAT, cursor="hand2",
                           command=lambda: self._edit_hardware_inline(refs['hardware_data']), padx=10, pady=4)
        hw_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(hw_btn, DarkTheme.ACCENT_PURPLE)
        tk.Label(card4, text="提示：切换卡片不会丢失已输入内容，点击\u2018创建\u2019统一提交。",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(10, 0))
        
        # 自动计算（与右侧面板逻辑一样）
        def _auto_calc(*_):
            try:
                m_rent = float(refs['monthly_e'].get().strip() or 0)
                months = float(refs['months_e'].get().strip() or 0)
                start_str = refs['start_e'].get().strip()
                total = m_rent * months
                refs['total_e'].delete(0, tk.END)
                refs['total_e'].insert(0, f"{total:.2f}")
                if start_str and months > 0:
                    try:
                        ds = datetime.strptime(start_str, "%Y-%m-%d")
                        de = ds + timedelta(days=int(months * 30))
                        refs['end_e'].delete(0, tk.END)
                        refs['end_e'].insert(0, de.strftime("%Y-%m-%d"))
                    except Exception:
                        pass
            except Exception:
                pass
        
        refs['monthly_e'].bind("<KeyRelease>", _auto_calc)
        refs['months_e'].bind("<KeyRelease>", _auto_calc)
        refs['start_e'].bind("<KeyRelease>", _auto_calc)
        
        # 卡片切换函数
        def _switch_card(index):
            current_step["index"] = index
            for i, card in enumerate(cards):
                card.pack_forget() if i != index else card.pack(fill=tk.BOTH, expand=True)
            # 更新按钮様式
            for i, btn in enumerate(step_buttons):
                if i == index:
                    btn.configure(bg=DarkTheme.ACCENT_BLUE, fg="white")
                else:
                    btn.configure(bg=DarkTheme.BG_CARD, fg=DarkTheme.TEXT_SECONDARY)
        
        # 创建步骤按钮
        for i, step_text in enumerate(steps):
            btn = tk.Button(step_bar, text=step_text, font=DarkTheme.FONT_LABEL,
                           bg=DarkTheme.BG_CARD if i > 0 else DarkTheme.ACCENT_BLUE,
                           fg="white" if i == 0 else DarkTheme.TEXT_SECONDARY,
                           relief=tk.FLAT, cursor="hand2",
                           command=lambda idx=i: _switch_card(idx), padx=12, pady=6)
            btn.pack(side=tk.LEFT, padx=2)
            step_buttons.append(btn)
        
        # 仅打一个卡片（默认第一个）
        for i, card in enumerate(cards):
            if i > 0:
                card.pack_forget()
        
        # 右下角按钮（上一步 / 下一步 / 创建）
        btn_frame = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        btn_frame.pack(fill=tk.X, padx=16, pady=(0, 12))
        
        def _prev_card():
            if current_step["index"] > 0:
                _switch_card(current_step["index"] - 1)
        
        def _next_card():
            if current_step["index"] < len(cards) - 1:
                _switch_card(current_step["index"] + 1)
        
        def _save_and_close():
            self._save_new_record_from_dialog(refs, win)
        
        prev_btn = tk.Button(btn_frame, text="⬅️ 上一步", font=DarkTheme.FONT_BUTTON,
                            fg="white", bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                            command=_prev_card, padx=14, pady=8)
        prev_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(prev_btn, DarkTheme.ACCENT_BLUE)
        
        next_btn = tk.Button(btn_frame, text="下一步 ➡️", font=DarkTheme.FONT_BUTTON,
                            fg="white", bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                            command=_next_card, padx=14, pady=8)
        next_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(next_btn, DarkTheme.ACCENT_BLUE)
        
        tk.Frame(btn_frame, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, expand=True)
        
        create_btn = tk.Button(btn_frame, text="✔️ 创建", font=DarkTheme.FONT_BUTTON,
                              fg="white", bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT, cursor="hand2",
                              command=_save_and_close, padx=14, pady=8)
        create_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(create_btn, DarkTheme.ACCENT_GREEN)
        
        cancel_btn = tk.Button(btn_frame, text="✗ 取消", font=DarkTheme.FONT_BUTTON,
                              fg="white", bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                              command=win.destroy, padx=14, pady=8)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)
    
    def _save_new_record_from_dialog(self, refs, win):
        """介于弹窗表单保存租赁记录"""
        try:
            # 验证必填项
            name = refs['name_e'].get().strip()
            phone = refs['phone_e'].get().strip()
            qty_str = refs['quantity_e'].get().strip()
            if not name or not phone:
                messagebox.showwarning("提示", "租赁人、联系电话必填")
                return
            
            qty = float(qty_str or 1)
            if qty <= 0:
                messagebox.showwarning("提示", "数量必须大于0")
                return
            
            start_str = refs['start_e'].get().strip()
            end_str = refs['end_e'].get().strip()
            monthly_str = refs['monthly_e'].get().strip()
            total_str = refs['total_e'].get().strip()
            
            if not start_str or not end_str or not monthly_str or not total_str:
                messagebox.showwarning("提示", "租赁信息中的待填项有空")
                return
            
            # 构造记录
            rec = {
                "id": self.dm.generate_unique_id(),
                "quantity": qty,
                "renter": {
                    "name": name,
                    "phone": phone,
                    "id_card": refs['id_e'].get().strip(),
                    "address": refs['addr_t'].get("1.0", "end").strip(),
                },
                "lease_info": {
                    "start_date": start_str,
                    "end_date": end_str,
                    "monthly_rent": float(monthly_str or 0),
                    "total_rent": float(total_str or 0),
                    "deposit": float(refs['deposit_e'].get().strip() or 0),
                },
                "paid_amount": float(refs['paid_e'].get().strip() or 0),
                "status": refs['status_var'].get(),
                "hardware": refs['hardware_data'],
            }
            
            # 保存
            ok = self.dm.add_record(rec)
            if ok:
                messagebox.showinfo("成功", f"已创建记录 {rec['id']}")
                win.destroy()
                self._refresh()
            else:
                messagebox.showerror("错误", "池存失败")
        except ValueError as e:
            messagebox.showerror("错误", f"数值错误: {e}")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {e}")
    
    def _make_field(self, parent, label, default="", width=26):
        """创建紧技输入行，返回 Entry 控件"""
        row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=3)
        tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        ent = ttk.Entry(row, width=width, font=DarkTheme.FONT_NORMAL)
        ent.pack(side=tk.LEFT, fill=tk.X, expand=True)
        if default is not None:
            ent.insert(0, str(default))
        return ent

    def _show_add_form(self):
        """右侧显示新增表单"""
        self._clear_right_panel()

        # 标题
        hdr = tk.Frame(self._right_frame, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Label(hdr, text="➕ 新增租赁记录", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)
        tk.Button(hdr, text="✕", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                  bg=DarkTheme.BG_PRIMARY, relief=tk.FLAT, cursor="hand2",
                  command=self._show_right_placeholder).pack(side=tk.RIGHT)

        # 卡片式分步容器
        main = tk.Frame(self._right_frame, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 10))
        refs = {}

        # 步骤标签
        steps = ["① 客户信息", "② 租赁信息", "③ 金额与状态", "④ 硬件信息"]
        current_step = {"index": 0}
        step_bar = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        step_bar.pack(fill=tk.X, pady=(0, 8))
        step_buttons = []

        card_host = tk.Frame(main, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        card_host.pack(fill=tk.BOTH, expand=True)
        cards = []

        # ── 卡片1：客户信息 ──
        card1 = tk.Frame(card_host, bg=DarkTheme.BG_PRIMARY)
        card1.pack(fill=tk.BOTH, expand=True)
        cards.append(card1)
        tk.Label(card1, text="客户基础信息", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(12, 8))
        refs['name_e'] = self._make_field(card1, "租赁人*", "")
        refs['phone_e'] = self._make_field(card1, "联系电话*", "")
        refs['id_e'] = self._make_field(card1, "身份证", "")
        refs['quantity_e'] = self._make_field(card1, "数量*", "1")
        addr_row = tk.Frame(card1, bg=DarkTheme.BG_PRIMARY)
        addr_row.pack(fill=tk.X, pady=3)
        tk.Label(addr_row, text="地址", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.NW).pack(side=tk.LEFT, padx=(0, 4))
        addr_t = tk.Text(addr_row, height=3, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                         bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, insertbackground=DarkTheme.TEXT_PRIMARY)
        addr_t.pack(side=tk.LEFT, fill=tk.X, expand=True)
        refs['addr_t'] = addr_t

        # ── 卡片2：租赁信息 ──
        card2 = tk.Frame(card_host, bg=DarkTheme.BG_PRIMARY)
        cards.append(card2)
        tk.Label(card2, text="租赁周期与租金", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(12, 8))
        refs['start_e'] = self._make_field(card2, "起租日期*", datetime.now().strftime("%Y-%m-%d"))
        refs['months_e'] = self._make_field(card2, "月数*", "1")
        refs['monthly_e'] = self._make_field(card2, "月租*", "0")
        refs['total_e'] = self._make_field(card2, "总租金*", "0")
        refs['end_e'] = self._make_field(card2, "到期日期*", (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"))

        # ── 卡片3：金额与状态 ──
        card3 = tk.Frame(card_host, bg=DarkTheme.BG_PRIMARY)
        cards.append(card3)
        tk.Label(card3, text="付款与状态", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_GREEN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(12, 8))
        refs['deposit_e'] = self._make_field(card3, "押金", "0")
        refs['paid_e'] = self._make_field(card3, "已付金额", "0")
        st_row = tk.Frame(card3, bg=DarkTheme.BG_PRIMARY)
        st_row.pack(fill=tk.X, pady=3)
        tk.Label(st_row, text="状态", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        refs['status_var'] = tk.StringVar(value="在租")
        st_combo = ttk.Combobox(st_row, textvariable=refs['status_var'], state="readonly",
                                values=["在租", "已退租", "已丢失", "已买断", "已逾期"], width=20)
        st_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # ── 卡片4：硬件信息 ──
        card4 = tk.Frame(card_host, bg=DarkTheme.BG_PRIMARY)
        cards.append(card4)
        tk.Label(card4, text="硬件配置", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_PURPLE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(12, 8))
        refs['hardware_data'] = {}
        hw_row = tk.Frame(card4, bg=DarkTheme.BG_PRIMARY)
        hw_row.pack(fill=tk.X, pady=6)
        tk.Label(hw_row, text="硬件信息", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        hw_btn = tk.Button(hw_row, text="⚙️ 编辑", font=DarkTheme.FONT_SMALL, fg="white",
                           bg=DarkTheme.ACCENT_PURPLE, relief=tk.FLAT, cursor="hand2",
                           command=lambda: self._edit_hardware_inline(refs['hardware_data']), padx=10, pady=4)
        hw_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(hw_btn, DarkTheme.ACCENT_PURPLE)
        tk.Label(card4, text="提示：切换卡片不会丢失已输入内容，点击“创建”统一提交。",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, padx=14, pady=(10, 0))

        # 自动计算（保持原逻辑）
        def _auto_calc(*_):
            try:
                m_rent = float(refs['monthly_e'].get().strip() or 0)
                months = float(refs['months_e'].get().strip() or 0)
                start_str = refs['start_e'].get().strip()
                total = m_rent * months
                refs['total_e'].delete(0, tk.END)
                refs['total_e'].insert(0, f"{total:.2f}")
                if start_str and months > 0:
                    try:
                        ds = datetime.strptime(start_str, "%Y-%m-%d")
                        de = ds + timedelta(days=int(months * 30))
                        refs['end_e'].delete(0, tk.END)
                        refs['end_e'].insert(0, de.strftime("%Y-%m-%d"))
                    except ValueError:
                        pass
            except ValueError:
                pass

        for w in (refs['monthly_e'], refs['months_e'], refs['start_e']):
            w.bind("<KeyRelease>", _auto_calc)
            w.bind("<FocusOut>", _auto_calc)
        _auto_calc()

        # 卡片切换控制
        nav = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        nav.pack(fill=tk.X, pady=(8, 0))
        prev_btn = tk.Button(nav, text="◀ 上一步", font=DarkTheme.FONT_BUTTON, fg="white",
                             bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2", padx=12, pady=7)
        prev_btn.pack(side=tk.LEFT)
        next_btn = tk.Button(nav, text="下一步 ▶", font=DarkTheme.FONT_BUTTON, fg="white",
                             bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2", padx=12, pady=7)
        next_btn.pack(side=tk.LEFT, padx=(8, 0))
        create_btn = tk.Button(nav, text="💾 创建", font=DarkTheme.FONT_BUTTON, fg="white",
                               bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                               command=lambda: self._save_new_record(refs), padx=14, pady=8)
        create_btn.pack(side=tk.RIGHT)
        DarkTheme.bind_hover(create_btn, DarkTheme.ACCENT_BLUE)
        cancel_btn = tk.Button(nav, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                               bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                               command=self._show_right_placeholder, padx=14, pady=8)
        cancel_btn.pack(side=tk.RIGHT, padx=(0, 8))
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

        def _show_step(index: int):
            index = max(0, min(index, len(cards) - 1))
            current_step["index"] = index
            for i, c in enumerate(cards):
                if i == index:
                    c.pack(fill=tk.BOTH, expand=True)
                else:
                    c.pack_forget()
            for i, b in enumerate(step_buttons):
                if i == index:
                    b.configure(bg=DarkTheme.ACCENT_BLUE, fg="white")
                else:
                    b.configure(bg=DarkTheme.BG_HOVER, fg=DarkTheme.TEXT_SECONDARY)
            prev_btn.configure(state=(tk.NORMAL if index > 0 else tk.DISABLED))
            next_btn.configure(state=(tk.NORMAL if index < len(cards) - 1 else tk.DISABLED))

        for i, title in enumerate(steps):
            btn = tk.Button(step_bar, text=title, font=DarkTheme.FONT_SMALL, relief=tk.FLAT, cursor="hand2",
                            command=lambda idx=i: _show_step(idx), padx=8, pady=5)
            btn.pack(side=tk.LEFT, padx=(0, 6))
            step_buttons.append(btn)

        prev_btn.configure(command=lambda: _show_step(current_step["index"] - 1))
        next_btn.configure(command=lambda: _show_step(current_step["index"] + 1))
        DarkTheme.bind_hover(prev_btn, DarkTheme.BG_HOVER)
        DarkTheme.bind_hover(next_btn, DarkTheme.ACCENT_BLUE)
        _show_step(0)

        self._current_form_refs = refs

    def _save_new_record(self, refs):
        """保存新增记录"""
        try:
            name = refs['name_e'].get().strip()
            phone = refs['phone_e'].get().strip()
            if not name:
                messagebox.showwarning("提示", "租赁人不能为空")
                return
            if not phone:
                messagebox.showwarning("提示", "联系电话不能为空")
                return
            if not phone.isdigit() or len(phone) != 11:
                messagebox.showwarning("提示", "联系电话应为11位数字")
                return

            start = refs['start_e'].get().strip()
            end = refs['end_e'].get().strip()

            def check_date(label, text):
                if not text:
                    raise ValueError(f"{label}不能为空")
                return datetime.strptime(text, "%Y-%m-%d")

            def parse_num(label, text):
                if text == "":
                    return 0.0
                val = float(text)
                if val < 0:
                    raise ValueError(f"{label}不能为负数")
                return val

            start_dt = check_date("起租日期", start)
            end_dt = check_date("到期日期", end)
            if start_dt > end_dt:
                messagebox.showwarning("提示", "起租日期不能晚于到期日期")
                return

            monthly = parse_num("月租", refs['monthly_e'].get().strip())
            total = parse_num("总租金", refs['total_e'].get().strip())
            deposit = parse_num("押金", refs['deposit_e'].get().strip())
            paid = parse_num("已付金额", refs['paid_e'].get().strip())
            if paid > total:
                messagebox.showwarning("提示", "已付金额不能大于总租金")
                return

            rec = {
                "renter": {
                    "name": name,
                    "phone": phone,
                    "id_card": refs['id_e'].get().strip(),
                    "address": refs['addr_t'].get("1.0", tk.END).strip()
                },
                "quantity": parse_num("数量", refs['quantity_e'].get().strip()),
                "lease_info": {
                    "start_date": start,
                    "end_date": end,
                    "monthly_rent": monthly,
                    "total_rent": total,
                    "deposit": deposit,
                    "lease_months": (end_dt - start_dt).days / 30.0
                },
                "status": refs['status_var'].get(),
                "paid_amount": paid,
                "renew_history": [],
                "hardware": refs['hardware_data']
            }
            ok = self.dm.add_record(rec)
            if not ok:
                messagebox.showerror("错误", "记录保存失败，请稍后重试")
                return
            messagebox.showinfo("成功", f"新记录已创建\nID: {rec['id']}")
            self._refresh()
            self._navigate_to_record(rec["id"])
        except Exception as e:
            messagebox.showerror("错误", f"保存失败：{e}")

    def _show_edit_form(self, rec):
        """右侧显示编辑表单"""
        self._clear_right_panel()
        rid = rec.get("id", "")
        renter = rec.get("renter", {})
        lease = rec.get("lease_info", {})

        # 标题
        hdr = tk.Frame(self._right_frame, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Label(hdr, text=f"✏️ 编辑 {rid}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_YELLOW, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)
        tk.Button(hdr, text="✕", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                  bg=DarkTheme.BG_PRIMARY, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._show_detail_panel(rec)).pack(side=tk.RIGHT)

        # 滚动表单
        canvas = tk.Canvas(self._right_frame, bg=DarkTheme.BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self._right_frame, orient="vertical", command=canvas.yview)
        form = tk.Frame(canvas, bg=DarkTheme.BG_PRIMARY)
        form.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all"),
                                                             width=e.width, height=e.height))
        canvas_frame = canvas.create_window((0, 0), window=form, anchor="nw", width=600)
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # 绑定鼠标滚轮
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        # 窗口大小变化时自适应
        def _on_canvas_configure(event):
            canvas.itemconfig(canvas_frame, width=event.width)
        canvas.bind("<Configure>", _on_canvas_configure)

        refs = {'record': rec}
        refs['name_e'] = self._make_field(form, "租赁人*", renter.get("name", ""))
        refs['phone_e'] = self._make_field(form, "联系电话*", renter.get("phone", ""))
        refs['id_e'] = self._make_field(form, "身份证", renter.get("id_card", ""))
        refs['quantity_e'] = self._make_field(form, "数量", str(rec.get("quantity", 1)))

        # 地址
        addr_row = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        addr_row.pack(fill=tk.X, pady=3)
        tk.Label(addr_row, text="地址", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.NW).pack(side=tk.LEFT, padx=(0, 4))
        addr_t = tk.Text(addr_row, height=2, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                         bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, insertbackground=DarkTheme.TEXT_PRIMARY)
        addr_t.pack(side=tk.LEFT, fill=tk.X, expand=True)
        addr_t.insert("1.0", renter.get("address", ""))
        refs['addr_t'] = addr_t

        refs['start_e'] = self._make_field(form, "起租日期", lease.get("start_date", "") or datetime.now().strftime("%Y-%m-%d"))
        refs['months_e'] = self._make_field(form, "月数", str(lease.get("lease_months", "1")))
        refs['monthly_e'] = self._make_field(form, "月租", lease.get("monthly_rent", "0"))
        refs['total_e'] = self._make_field(form, "总租金", lease.get("total_rent", "0"))
        refs['end_e'] = self._make_field(form, "到期日期", lease.get("end_date", ""))
        refs['deposit_e'] = self._make_field(form, "押金", lease.get("deposit", "0"))
        refs['paid_e'] = self._make_field(form, "已付金额", rec.get("paid_amount", "0"))
        refs['settle_e'] = self._make_field(form, "结算金额", rec.get("settlement_amount", ""))

        # 状态
        st_row = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        st_row.pack(fill=tk.X, pady=3)
        tk.Label(st_row, text="状态", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        refs['status_var'] = tk.StringVar(value=rec.get("status", "在租"))
        st_combo = ttk.Combobox(st_row, textvariable=refs['status_var'], state="readonly",
                                values=["在租", "已退租", "已丢失", "已买断", "已逾期"], width=20)
        st_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 硬件信息
        hw_row = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        hw_row.pack(fill=tk.X, pady=3)
        tk.Label(hw_row, text="硬件信息", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        refs['hardware_data'] = dict(rec.get("hardware", {}))
        hw_btn = tk.Button(hw_row, text="⚙️ 编辑", font=DarkTheme.FONT_SMALL, fg="white",
                          bg=DarkTheme.ACCENT_PURPLE, relief=tk.FLAT, cursor="hand2",
                          command=lambda: self._edit_hardware_inline(refs['hardware_data']), padx=8, pady=3)
        hw_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(hw_btn, DarkTheme.ACCENT_PURPLE)

        # 自动计算（仅当用户修改月租或月数时触发，不覆盖手动输入）
        def _auto_calc(*_):
            try:
                m_rent = float(refs['monthly_e'].get().strip() or 0)
                months = float(refs['months_e'].get().strip() or 0)
                if months <= 0 or m_rent <= 0:
                    return
                start_str = refs['start_e'].get().strip()
                total = m_rent * months
                # 仅当总租金为0或为空时才自动计算，避免覆盖手动修改
                current_total = refs['total_e'].get().strip()
                if not current_total or current_total == "0.00" or current_total == "0":
                    refs['total_e'].delete(0, tk.END)
                    refs['total_e'].insert(0, f"{total:.2f}")
                if start_str and months > 0:
                    try:
                        ds = datetime.strptime(start_str, "%Y-%m-%d")
                        de = ds + timedelta(days=int(months * 30))
                        # 仅当到期日期为空或为默认值时才自动计算
                        current_end = refs['end_e'].get().strip()
                        if not current_end:
                            refs['end_e'].delete(0, tk.END)
                            refs['end_e'].insert(0, de.strftime("%Y-%m-%d"))
                    except ValueError:
                        pass
            except ValueError:
                pass

        for w in (refs['monthly_e'], refs['months_e']):
            w.bind("<KeyRelease>", _auto_calc)
            w.bind("<FocusOut>", _auto_calc)

        # 按钮
        btn = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(12, 8))
        save_btn = tk.Button(btn, text="💾 保存", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._save_edit_record(refs), padx=14, pady=8)
        save_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(save_btn, DarkTheme.ACCENT_BLUE)
        cancel_btn = tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._show_detail_panel(rec), padx=14, pady=8)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

        self._current_form_refs = refs

    def _save_edit_record(self, refs):
        """保存编辑记录"""
        try:
            rec = refs['record']
            name = refs['name_e'].get().strip()
            phone = refs['phone_e'].get().strip()
            if not name:
                messagebox.showwarning("提示", "租赁人不能为空")
                return
            if not phone:
                messagebox.showwarning("提示", "联系电话不能为空")
                return
            if not phone.isdigit() or len(phone) != 11:
                messagebox.showwarning("提示", "联系电话应为11位数字")
                return

            start = refs['start_e'].get().strip()
            end = refs['end_e'].get().strip()

            def parse_num(label, text):
                if text == "":
                    return 0.0
                val = float(text)
                if val < 0:
                    raise ValueError(f"{label}不能为负数")
                return val

            def check_date(label, text):
                if not text:
                    return None
                return datetime.strptime(text, "%Y-%m-%d")

            start_dt = check_date("起租日期", start)
            end_dt = check_date("到期日期", end)
            if start_dt and end_dt and start_dt > end_dt:
                messagebox.showwarning("提示", "起租日期不能晚于到期日期")
                return

            monthly = parse_num("月租", refs['monthly_e'].get().strip())
            total = parse_num("总租金", refs['total_e'].get().strip())
            deposit = parse_num("押金", refs['deposit_e'].get().strip())
            paid = parse_num("已付金额", refs['paid_e'].get().strip())
            if paid > total:
                messagebox.showwarning("提示", "已付金额不能大于总租金")
                return

            rec.setdefault("renter", {})
            rec.setdefault("lease_info", {})
            rec["renter"]["name"] = name
            rec["renter"]["phone"] = phone
            rec["renter"]["id_card"] = refs['id_e'].get().strip()
            rec["renter"]["address"] = refs['addr_t'].get("1.0", tk.END).strip()
            rec["quantity"] = parse_num("数量", refs['quantity_e'].get().strip())
            rec["lease_info"]["start_date"] = start
            rec["lease_info"]["end_date"] = end
            rec["lease_info"]["monthly_rent"] = monthly
            rec["lease_info"]["total_rent"] = total
            rec["lease_info"]["deposit"] = deposit
            rec["hardware"] = refs['hardware_data']

            old_paid = rec.get("paid_amount", 0) or 0
            rec["paid_amount"] = paid
            if paid != old_paid:
                paid_change = paid - old_paid
                if paid_change > 0:
                    self.dm.append_payment_history(
                        rec, paid_change, operator=self.app.username or "系统",
                        method="编辑付款", note="编辑记录时更新字段"
                    )
            rec["status"] = refs['status_var'].get()

            settle_text = refs['settle_e'].get().strip()
            if settle_text:
                rec["settlement_amount"] = parse_num("结算金额", settle_text)
                rec["settlement_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            else:
                rec.pop("settlement_amount", None)
                rec.pop("settlement_date", None)

            self.dm.refresh_record_business_fields(rec)
            self.dm.save()
            messagebox.showinfo("成功", "记录已更新")
            self._show_detail_panel(rec)
            self._refresh()
        except Exception as e:
            messagebox.showerror("错误", f"保存失败：{e}")

    def _show_renew_form(self, rec):
        """右侧显示续租表单"""
        self._clear_right_panel()
        rid = rec.get("id", "")
        lease = rec.get("lease_info", {})
        end_str = lease.get("end_date", "")
        total = float(lease.get("total_rent", 0))
        renter = rec.get("renter", {})

        if not end_str:
            messagebox.showerror("错误", "该记录缺少到期时间")
            return
        if rec.get("status") in ("已退租", "已丢失", "已买断"):
            messagebox.showwarning("提示", f"状态为'{rec['status']}'，无法续租")
            return

        # 滚动表单
        canvas = tk.Canvas(self._right_frame, bg=DarkTheme.BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self._right_frame, orient="vertical", command=canvas.yview)
        form = tk.Frame(canvas, bg=DarkTheme.BG_PRIMARY)
        form.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all"),
                                                             width=e.width, height=e.height))
        canvas_frame = canvas.create_window((0, 0), window=form, anchor="nw", width=600)
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        def _on_canvas_configure(event):
            canvas.itemconfig(canvas_frame, width=event.width)
        canvas.bind("<Configure>", _on_canvas_configure)

        # 标题
        hdr = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Label(hdr, text=f"🔄 续租 — {rid}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, fill=tk.X, expand=True)
        tk.Button(hdr, text="✕", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                  bg=DarkTheme.BG_PRIMARY, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._show_detail_panel(rec)).pack(side=tk.RIGHT)

        # 信息区
        info = tk.Frame(form, bg=DarkTheme.BG_PRIMARY)
        info.pack(fill=tk.X, padx=12, pady=(0, 8))
        for txt in [f"租赁人：{renter.get('name', '')}", f"当前到期：{end_str}",
                    f"当前租金总额：¥{total:.2f}"]:
            tk.Label(info, text=txt, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=2)

        # 单位选择
        unit_row = tk.Frame(info, bg=DarkTheme.BG_PRIMARY)
        unit_row.pack(fill=tk.X, pady=6)
        tk.Label(unit_row, text="时间单位：", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 8))
        refs = {'record': rec, 'lease': lease, 'cur_total': total}
        refs['unit_var'] = tk.StringVar(value="月")
        for val, txt in [("天", "天"), ("月", "月")]:
            tk.Radiobutton(unit_row, text=txt, variable=refs['unit_var'], value=val, font=DarkTheme.FONT_NORMAL,
                           bg=DarkTheme.BG_PRIMARY, fg=DarkTheme.TEXT_PRIMARY,
                           selectcolor=DarkTheme.ACCENT_BLUE).pack(side=tk.LEFT, padx=6)

        refs['time_e'] = self._make_field(info, "续租时间：", "")
        refs['amt_e'] = self._make_field(info, "续租金额(¥)：", "")
        refs['paid_e'] = self._make_field(info, "已付金额(¥)：", str(rec.get("paid_amount", 0)))

        # 按钮
        btn = tk.Frame(info, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(12, 0))
        renew_btn = tk.Button(btn, text="✅ 确认续租", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._do_renew_inline(refs), padx=14, pady=8)
        renew_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(renew_btn, DarkTheme.ACCENT_BLUE)
        cancel_btn = tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._show_detail_panel(rec), padx=14, pady=8)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

        self._current_form_refs = refs

    def _do_renew_inline(self, refs):
        """执行续租操作"""
        try:
            rec = refs['record']
            lease = refs['lease']
            cur_total = refs['cur_total']
            unit_var = refs['unit_var']

            t_str = refs['time_e'].get().strip()
            if not t_str:
                messagebox.showwarning("提示", "请输入续租时间")
                return
            t_val = float(t_str)
            if t_val <= 0:
                messagebox.showwarning("提示", "时间必须 > 0")
                return

            a_str = refs['amt_e'].get().strip()
            if not a_str:
                messagebox.showwarning("提示", "请输入续租金额")
                return
            amt = float(a_str)
            if amt < 0:
                messagebox.showwarning("提示", "金额不能为负")
                return

            p_str = refs['paid_e'].get().strip()
            new_paid = float(p_str) if p_str else rec.get("paid_amount", 0)
            if new_paid < 0:
                messagebox.showwarning("提示", "已付金额不能为负")
                return
            # 修复：比较新已付金额与新总租金（当前总租金 + 续租金额）
            new_total = cur_total + amt
            if new_paid > new_total:
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

            # 计算准确的总租赁月数
            old_start = lease.get("start_date", "")
            if old_start:
                old_start_dt = datetime.strptime(old_start, "%Y-%m-%d")
                total_months = (new_end - old_start_dt).days / 30.0
            else:
                total_months = float(lease.get("lease_months", 0) or 0) + add_months

            lease["end_date"] = new_end_str
            lease["total_rent"] = new_total
            lease["lease_months"] = round(total_months, 2)

            rec.setdefault("renew_history", []).append({
                "renew_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "renew_time": t_val, "renew_unit": unit_var.get(), "renew_amount": amt,
                "old_end_date": cur_end.strftime("%Y-%m-%d"), "new_end_date": new_end_str,
                "operator": self.app.username or "系统",
            })
            if new_paid != rec.get("paid_amount", 0):
                paid_change = new_paid - (rec.get("paid_amount", 0) or 0)
                if paid_change > 0:
                    self.dm.append_payment_history(
                        rec, paid_change, operator=self.app.username or "系统",
                        method="续租时支付", note=f"续租{t_val}{unit_var.get()}"
                    )
            rec["paid_amount"] = new_paid
            self.dm.refresh_record_business_fields(rec)
            self.dm.save()
            messagebox.showinfo("成功", f"续租成功！\n时间：{t_val}{unit_var.get()}\n金额：¥{amt:.2f}\n新到期：{new_end_str}")
            self._show_detail_panel(rec)
            self._refresh()
        except Exception as e:
            messagebox.showerror("错误", f"续租失败：{e}")

    def _show_payment_form(self, rec):
        """收款记录弹窗"""
        from tkinter import simpledialog
        rid = rec.get("id", "")
        renter = rec.get("renter", {})
        name = renter.get("name", "")
        paid = float(rec.get("paid_amount", 0) or 0)
        total = float(rec.get("lease_info", {}).get("total_rent", 0) or 0)
        unpaid = total - paid

        # 弹出收款对话框
        win = tk.Toplevel(self)
        win.title(f"💰 收款 - {rid}")
        win.geometry("400x350")
        win.transient(self)
        win.grab_set()
        win.configure(bg=DarkTheme.BG_PRIMARY)
        win.update_idletasks()
        x = (win.winfo_screenwidth() // 2) - 200
        y = (win.winfo_screenheight() // 2) - 175
        win.geometry(f"400x350+{x}+{y}")

        def _safe_close(w=win):
            try:
                w.grab_release()
            except Exception:
                pass
            w.destroy()

        win.protocol("WM_DELETE_WINDOW", _safe_close)

        main = tk.Frame(win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        tk.Label(main, text=f"租赁人: {name}", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 4))
        tk.Label(main, text=f"总租金: ¥{total:.2f}", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 4))
        tk.Label(main, text=f"已付: ¥{paid:.2f}", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.ACCENT_GREEN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 4))
        tk.Label(main, text=f"未付: ¥{unpaid:.2f}", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.ACCENT_RED if unpaid > 0 else DarkTheme.ACCENT_GREEN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        refs = {}
        refs['amount_e'] = self._make_field(main, "收款金额", str(unpaid) if unpaid > 0 else "")
        refs['method_e'] = self._make_field(main, "收款方式", "现金")
        refs['note_e'] = self._make_field(main, "备注", "")

        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(12, 0))
        tk.Button(btn, text="✅ 确认收款", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT, cursor="hand2",
                  command=lambda: self._process_payment(rec, refs, win), padx=14, pady=8).pack(side=tk.LEFT, padx=(0, 8))
        tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=_safe_close, padx=14, pady=8).pack(side=tk.LEFT)

    def _process_payment(self, rec, refs, win):
        """处理收款记录"""
        try:
            amount_str = refs['amount_e'].get().strip()
            if not amount_str:
                messagebox.showwarning("提示", "请输入收款金额")
                return
            amount = float(amount_str)
            if amount <= 0:
                messagebox.showwarning("提示", "金额必须大于 0")
                return

            method = refs['method_e'].get().strip() or "现金"
            note = refs['note_e'].get().strip()

            old_paid = float(rec.get("paid_amount", 0) or 0)
            rec["paid_amount"] = old_paid + amount

            # 记录付款历史
            self.dm.append_payment_history(
                rec, amount, operator=self.app.username or "系统",
                method=method, note=note
            )

            self.dm.refresh_record_business_fields(rec)
            self.dm.save()

            new_unpaid = float(rec.get("lease_info", {}).get("total_rent", 0) or 0) - rec["paid_amount"]
            messagebox.showinfo("成功", f"收款 ¥{amount:.2f} 已记录\n剩余未付: ¥{max(0, new_unpaid):.2f}")
            win.destroy()
            self._show_detail_panel(rec)
            self._refresh()
        except ValueError:
            messagebox.showerror("错误", "金额格式不正确")
        except Exception as e:
            messagebox.showerror("错误", f"收款失败: {e}")

    def _navigate_to_record(self, rid):
        """从AI助手导航到指定记录"""
        rec = self._find_record(rid)
        if rec:
            # 清除搜索过滤以显示完整列表
            self.search_var.set("")
            self.status_var.set("全部")
            self._shown = list(self._all)
            target_idx = next((i for i, r in enumerate(self._shown) if r.get("id") == rid), -1)
            if target_idx >= 0:
                self._current_page = target_idx // self._page_size
            self._render_tree()
            # 选中对应记录并显示详情
            for item in self.tree.get_children():
                if self.tree.item(item)["values"][0] == rid:
                    self.tree.selection_set(item)
                    self.tree.focus(item)
                    self.tree.see(item)
                    break
            self._show_detail_panel(rec)
        else:
            messagebox.showinfo("提示", f"未找到记录 {rid}")

    def _export_contract(self, rec):
        """导出租赁合同为文本文件"""
        from tkinter import filedialog
        rid = rec.get("id", "")
        renter = rec.get("renter", {})
        lease = rec.get("lease_info", {})
        name = renter.get("name", "")
        phone = renter.get("phone", "")
        id_card = renter.get("id_card", "")
        address = renter.get("address", "")
        start_date = lease.get("start_date", "")
        end_date = lease.get("end_date", "")
        monthly_rent = float(lease.get("monthly_rent", 0) or 0)
        total_rent = float(lease.get("total_rent", 0) or 0)
        deposit = float(lease.get("deposit", 0) or 0)
        quantity = int(rec.get("quantity", 1) or 1)
        status = rec.get("status", "")
        paid_amount = float(rec.get("paid_amount", 0) or 0)
        hardware = rec.get("hardware", {})
        hardware_summary = self.dm.summarize_hardware(rec)

        contract_text = f"""========================================
        速维电脑租赁合同
========================================

合同编号: {rid}
签订日期: {start_date}

【出租方】
名称: 速维电脑租赁
联系电话: 13800138000
地址: XX市XX区XX路XX号

【承租方】
姓名: {name}
联系电话: {phone}
身份证号: {id_card}
联系地址: {address}

【租赁物品清单】
数量: {quantity} 套
{hardware_summary}

【租赁期限】
起租日期: {start_date}
到期日期: {end_date}

【租金及押金】
月租金: ¥{monthly_rent:.2f}
总租金: ¥{total_rent:.2f}
押金: ¥{deposit:.2f}
已付金额: ¥{paid_amount:.2f}
未付金额: ¥{max(0, total_rent - paid_amount):.2f}

【合同状态】
当前状态: {status}

【备注】
{rec.get("notes", "无")}

========================================
出租方签字: ______________    日期: ____________
承租方签字: ______________    日期: ____________
========================================
"""

        fp = filedialog.asksaveasfilename(
            title="导出租赁合同",
            defaultextension=".txt",
            filetypes=[("文本文件", "*.txt"), ("所有文件", "*.*")],
            initialfile=f"租赁合同_{rid}_{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        )
        if not fp:
            return

        try:
            with open(fp, "w", encoding="utf-8") as f:
                f.write(contract_text)
            messagebox.showinfo("成功", f"合同已导出\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")

