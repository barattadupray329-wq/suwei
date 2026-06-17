#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新版租赁管理（v2）UI 集成模块
支持合同列表展示、合同详情查看、新版合同创建向导等
此模块为独立组件，与现有租赁管理模块分离，降低耦合度
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime, timedelta
from theme.colors import DarkTheme
from modules.rental_mgmt_v2_forms import LineItemsListFrame, AddLineItemDialog


class RentalContractsV2Frame(ttk.Frame):
    """新版租赁合同管理框架"""

    STATUS_COLORS = {
        "在租": DarkTheme.STATUS_ACTIVE, "已逾期": DarkTheme.STATUS_EXPIRED,
        "已终止": DarkTheme.STATUS_RETURNED, "已买断": DarkTheme.STATUS_BOUGHT,
    }

    def __init__(self, parent, app):
        super().__init__(parent)
        self.app = app
        self.dm = app.data_manager
        self._all_contracts = []
        self._shown_contracts = []
        self._current_page = 0
        self._page_size = 50
        self._total_pages = 0
        self._right_frame = None
        self._current_view = "list"  # list | detail | create
        self._build()
        self._refresh()

    def _build(self):
        """构建主界面布局"""
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        # 标题
        tk.Label(main, text="📋 新版租赁合同（v2）", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        # 双栏布局
        self._paned = tk.PanedWindow(main, orient=tk.HORIZONTAL, bg=DarkTheme.BG_PRIMARY, sashwidth=6)
        self._paned.pack(fill=tk.BOTH, expand=True)

        # ── 左侧面板 ──
        left = tk.Frame(self._paned, bg=DarkTheme.BG_PRIMARY)
        self._paned.add(left, minsize=400)

        # 搜索和过滤栏
        ctrl = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        ctrl.pack(fill=tk.X, pady=(0, 8))

        tk.Label(ctrl, text="搜索:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._apply_filter())
        ttk.Entry(ctrl, textvariable=self.search_var, width=28, font=DarkTheme.FONT_NORMAL).pack(
            side=tk.LEFT, padx=(0, 10), ipady=2)

        tk.Label(ctrl, text="类型:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 4))
        self.type_var = tk.StringVar(value="全部")
        type_combo = ttk.Combobox(ctrl, textvariable=self.type_var, width=12,
                                  state="readonly", values=["全部", "纯租赁", "租赁+购买", "预付款+按次"])
        type_combo.pack(side=tk.LEFT, padx=(0, 8))
        type_combo.bind("<<ComboboxSelected>>", lambda *_: self._apply_filter())

        # 按钮行
        btn_row = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, pady=(0, 8))

        for txt, cmd, clr in [
            ("➕ 新增合同", self._show_create_wizard, DarkTheme.ACCENT_CYAN),
            ("✏️ 编辑", self._edit_contract, DarkTheme.ACCENT_YELLOW),
            ("🗑️ 删除", self._delete_contract, DarkTheme.ACCENT_RED),
            ("💰 收款", self._add_payment, DarkTheme.ACCENT_GREEN),
            ("📤 导出", self._export_contracts, DarkTheme.ACCENT_BLUE),
        ]:
            b = tk.Button(btn_row, text=txt, font=DarkTheme.FONT_SMALL, fg="white", bg=clr,
                           relief=tk.FLAT, cursor="hand2", command=cmd, padx=8, pady=4)
            b.pack(side=tk.LEFT, padx=2)
            DarkTheme.bind_hover(b, clr)

        # 分页容器
        self._page_frame = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        self._page_frame.pack(fill=tk.X, pady=(4, 0))

        # 列表
        table_frame = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        table_frame.pack(fill=tk.BOTH, expand=True)

        cols = ("合同ID", "客户名称", "合同类型", "状态", "总租金", "已收", "未收", "起租日期", "到期日期")
        self.tree = ttk.Treeview(table_frame, columns=cols, show="headings", height=14)
        widths = {
            "合同ID": 120, "客户名称": 100, "合同类型": 80, "状态": 60,
            "总租金": 80, "已收": 80, "未收": 80, "起租日期": 100, "到期日期": 100
        }
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 80), anchor="center")

        vbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.bind("<Double-1>", lambda e: self._show_detail())
        self.tree.bind("<<TreeviewSelect>>", lambda *_: self._on_select())

        # ── 右侧面板 ──
        self._right_frame = tk.Frame(self._paned, bg=DarkTheme.BG_PRIMARY)
        self._paned.add(self._right_frame, minsize=300)
        self._show_right_placeholder()

    def _show_right_placeholder(self):
        """显示右侧占位符"""
        for w in self._right_frame.winfo_children():
            w.destroy()
        tk.Label(self._right_frame, text="📄 选择合同查看详情\\n或点击按钮进行操作",
                 font=DarkTheme.FONT_SUBTITLE, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_PRIMARY, justify=tk.CENTER).pack(expand=True)

    def _refresh(self):
        """刷新合同列表"""
        self._all_contracts = self.dm.get_contracts()
        self._current_page = 0
        self._apply_filter()

    def _apply_filter(self):
        """应用过滤器"""
        q = self.search_var.get().strip().lower()
        t = self.type_var.get()
        self._shown_contracts = []

        for c in self._all_contracts:
            # 状态过滤
            if t != "全部":
                contract_type = c.get("rental_mode", "")
                if contract_type != t:
                    continue
            # 搜索过滤
            if q:
                haystack = (str(c.get("contract_id", "")) + str(c.get("customer_name", "")) +
                           str(c.get("customer_phone", ""))).lower()
                if q not in haystack:
                    continue
            self._shown_contracts.append(c)

        self._current_page = 0
        self._render_tree()

    def _render_tree(self):
        """渲染树视图"""
        total = len(self._shown_contracts)
        if total == 0:
            for i in self.tree.get_children():
                self.tree.delete(i)
            self._update_pagination(0, 0, 0)
            return

        self._total_pages = max(1, (total + self._page_size - 1) // self._page_size)
        self._current_page = min(self._current_page, self._total_pages - 1)

        start = self._current_page * self._page_size
        end = min(start + self._page_size, total)
        page_data = self._shown_contracts[start:end]

        for i in self.tree.get_children():
            self.tree.delete(i)

        for c in page_data:
            status = c.get("status", "")
            values = (
                c.get("contract_id", ""),
                c.get("customer_name", ""),
                c.get("rental_mode", ""),
                status,
                f"¥{float(c.get('total_rent', 0)):.2f}",
                f"¥{float(c.get('paid_amount', 0)):.2f}",
                f"¥{float(c.get('unpaid_amount', 0)):.2f}",
                c.get("contract_start_date", ""),
                c.get("contract_end_date", ""),
            )
            self.tree.insert("", tk.END, values=values, tags=(status,))

        for st, clr in self.STATUS_COLORS.items():
            self.tree.tag_configure(st, foreground=clr)

        self._update_pagination(total, start, end)

    def _update_pagination(self, total, start, end):
        """更新分页信息"""
        for w in self._page_frame.winfo_children():
            w.destroy()

        if total == 0:
            tk.Label(self._page_frame, text="无合同数据", font=DarkTheme.FONT_LABEL,
                     fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=10)
            return

        # 上一页
        prev_btn = tk.Button(self._page_frame, text="◀ 上一页", font=DarkTheme.FONT_SMALL,
                            fg="white", bg=DarkTheme.ACCENT_BLUE if self._current_page > 0 else DarkTheme.BG_HOVER,
                            relief=tk.FLAT, cursor="hand2" if self._current_page > 0 else "arrow",
                            command=self._prev_page, padx=8, pady=3)
        prev_btn.pack(side=tk.LEFT, padx=2)

        # 页码信息
        page_info = f"第 {self._current_page + 1}/{self._total_pages} 页 (共 {total} 条，显示 {start + 1}-{end})"
        tk.Label(self._page_frame, text=page_info, font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=10)

        # 下一页
        next_btn = tk.Button(self._page_frame, text="下一页 ▶", font=DarkTheme.FONT_SMALL,
                            fg="white", bg=DarkTheme.ACCENT_BLUE if self._current_page < self._total_pages - 1 else DarkTheme.BG_HOVER,
                            relief=tk.FLAT, cursor="hand2" if self._current_page < self._total_pages - 1 else "arrow",
                            command=self._next_page, padx=8, pady=3)
        next_btn.pack(side=tk.LEFT, padx=2)

    def _prev_page(self):
        if self._current_page > 0:
            self._current_page -= 1
            self._render_tree()

    def _next_page(self):
        if self._current_page < self._total_pages - 1:
            self._current_page += 1
            self._render_tree()

    def _on_select(self):
        """选择列表项时显示概览"""
        sel = self.tree.selection()
        if sel:
            contract_id = self.tree.item(sel[0])["values"][0]
            contract = self.dm.get_contract(contract_id)
            if contract:
                self._show_contract_overview(contract)

    def _show_contract_overview(self, contract):
        """显示合同概览"""
        for w in self._right_frame.winfo_children():
            w.destroy()

        canvas = tk.Canvas(self._right_frame, bg=DarkTheme.BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self._right_frame, orient="vertical", command=canvas.yview)
        content = tk.Frame(canvas, bg=DarkTheme.BG_PRIMARY)
        content.bind("<<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas_frame = canvas.create_window((0, 0), window=content, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        def _on_canvas_config(event):
            canvas.itemconfig(canvas_frame, width=event.width)
        canvas.bind("<Configure>", _on_canvas_config)

        # 标题
        hdr = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        hdr.pack(fill=tk.X, padx=12, pady=(12, 8))
        tk.Label(hdr, text=f"📋 {contract.get('contract_id', '')}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 基础信息
        details = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        details.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 8))

        info_items = [
            ("客户名称", contract.get("customer_name", ""), DarkTheme.TEXT_PRIMARY),
            ("客户电话", contract.get("customer_phone", ""), DarkTheme.TEXT_PRIMARY),
            ("合同类型", contract.get("rental_mode", ""), DarkTheme.ACCENT_BLUE),
            ("状态", contract.get("status", ""), self.STATUS_COLORS.get(contract.get("status", ""), DarkTheme.TEXT_PRIMARY)),
            ("总租金", f"¥{float(contract.get('total_rent', 0)):.2f}", DarkTheme.ACCENT_CYAN),
            ("已收金额", f"¥{float(contract.get('paid_amount', 0)):.2f}", DarkTheme.ACCENT_GREEN),
            ("未收金额", f"¥{float(contract.get('unpaid_amount', 0)):.2f}", DarkTheme.ACCENT_YELLOW),
            ("起租日期", contract.get("contract_start_date", ""), DarkTheme.TEXT_PRIMARY),
            ("到期日期", contract.get("contract_end_date", ""), DarkTheme.TEXT_PRIMARY),
            ("押金", f"¥{float(contract.get('deposit', 0)):.2f}", DarkTheme.TEXT_SECONDARY),
        ]

        for lbl, val, color in info_items:
            row = tk.Frame(details, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=f"{lbl}:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, width=10, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 6))
            tk.Label(row, text=str(val), font=DarkTheme.FONT_NORMAL, fg=color,
                     bg=DarkTheme.BG_PRIMARY, wraplength=240, justify=tk.LEFT).pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 项目明细
        if contract.get("line_items"):
            items_frame = tk.Frame(details, bg=DarkTheme.BG_PRIMARY)
            items_frame.pack(fill=tk.X, pady=(8, 0))
            tk.Label(items_frame, text="项目明细:", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, anchor=tk.E).pack(anchor=tk.W)

            for item in contract.get("line_items", []):
                item_txt = (f"  {item.get('item_name', '')} × {item.get('quantity', 1)} "
                           f"¥{float(item.get('unit_monthly_rent', 0)):.2f}/月 = "
                           f"¥{float(item.get('total_rent', 0)):.2f}")
                tk.Label(items_frame, text=item_txt, font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_SECONDARY,
                        bg=DarkTheme.BG_PRIMARY, wraplength=240, justify=tk.LEFT).pack(anchor=tk.W, pady=1)

        # 操作按钮
        btn_row = tk.Frame(content, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, padx=12, pady=(12, 8))

        for txt, cmd, clr in [
            ("✏️ 编辑项目", lambda: self._edit_items(contract), DarkTheme.ACCENT_YELLOW),
            ("💰 记录收款", lambda: self._show_payment_form(contract), DarkTheme.ACCENT_GREEN),
            ("📋 审计日志", lambda: self._show_audit_log(contract), DarkTheme.ACCENT_PURPLE),
        ]:
            b = tk.Button(btn_row, text=txt, font=DarkTheme.FONT_SMALL, fg="white", bg=clr,
                          relief=tk.FLAT, cursor="hand2", command=cmd, padx=8, pady=4)
            b.pack(side=tk.LEFT, padx=3)
            DarkTheme.bind_hover(b, clr)

    def _show_detail(self):
        """显示合同详情"""
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("提示", "请先选择一条合同")
            return
        contract_id = self.tree.item(sel[0])["values"][0]
        contract = self.dm.get_contract(contract_id)
        if contract:
            self._show_contract_overview(contract)

    def _show_create_wizard(self):
        """显示创建向导对话框"""
        dlg = CreateContractWizard(self, self.app)
        result = dlg.show()
        if result:
            messagebox.showinfo("成功", f"合同 {result} 已创建")
            self._refresh()

    def _edit_contract(self):
        """编辑合同（暂未实现）"""
        messagebox.showinfo("提示", "合同编辑功能开发中...")

    def _delete_contract(self):
        """删除合同（暂未实现）"""
        messagebox.showinfo("提示", "合同删除功能开发中...")

    def _edit_items(self, contract):
        """编辑项目明细"""
        messagebox.showinfo("提示", "项目编辑功能开发中...")

    def _add_payment(self):
        """添加收款"""
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("提示", "请先选择一条合同")
            return
        contract_id = self.tree.item(sel[0])["values"][0]
        contract = self.dm.get_contract(contract_id)
        if contract:
            self._show_payment_form(contract)

    def _show_payment_form(self, contract):
        """显示收款表单"""
        dlg = AddPaymentDialog(self, self.dm, contract)
        result = dlg.show()
        if result:
            messagebox.showinfo("成功", "收款已记录")
            self._refresh()

    def _show_audit_log(self, contract):
        """显示审计日志"""
        messagebox.showinfo("提示", "审计日志查看功能开发中...")

    def _export_contracts(self):
        """导出合同列表"""
        messagebox.showinfo("提示", "合同导出功能开发中...")


class CreateContractWizard:
    """创建合同向导（6步）"""

    def __init__(self, parent, app):
        self.parent = parent
        self.app = app
        self.dm = app.data_manager
        self.window = tk.Toplevel(parent)
        self.window.title("➕ 新建租赁合同")
        self.window.geometry("700x600")
        self.window.transient(parent)
        self.window.grab_set()
        self.window.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window()
        
        self.current_step = 0
        self.steps = ["客户信息", "租赁模式", "模式参数", "项目明细", "硬件配置", "确认提交"]
        self.contract_data = {}
        self.line_items = []
        self.result = None
        
        self._build()
        self._show_step(0)

    def _center_window(self):
        self.window.update_idletasks()
        x = (self.window.winfo_screenwidth() // 2) - 350
        y = (self.window.winfo_screenheight() // 2) - 300
        self.window.geometry(f"700x600+{x}+{y}")

    def _build(self):
        """构建向导框架"""
        main = tk.Frame(self.window, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        # 步骤指示器
        steps_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        steps_frame.pack(fill=tk.X, pady=(0, 16))
        
        for i, step in enumerate(self.steps):
            step_label = tk.Label(steps_frame, text=f"{i+1}. {step}", 
                                 font=DarkTheme.FONT_SMALL if i != self.current_step else DarkTheme.FONT_LABEL,
                                 fg=DarkTheme.ACCENT_CYAN if i == self.current_step else DarkTheme.TEXT_SECONDARY,
                                 bg=DarkTheme.BG_PRIMARY)
            step_label.pack(side=tk.LEFT, padx=8)

        # 内容区域
        self.content_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        self.content_frame.pack(fill=tk.BOTH, expand=True)

        # 按钮区域
        btn_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_frame.pack(fill=tk.X, pady=(16, 0))

        self.prev_btn = tk.Button(btn_frame, text="◀ 上一步", font=DarkTheme.FONT_BUTTON,
                                 fg="white", bg=DarkTheme.BG_HOVER, relief=tk.FLAT,
                                 cursor="arrow", command=self._prev_step, padx=12, pady=6)
        self.prev_btn.pack(side=tk.LEFT, padx=4)

        self.next_btn = tk.Button(btn_frame, text="下一步 ▶", font=DarkTheme.FONT_BUTTON,
                                 fg="white", bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT,
                                 cursor="hand2", command=self._next_step, padx=12, pady=6)
        self.next_btn.pack(side=tk.LEFT, padx=4)

        cancel_btn = tk.Button(btn_frame, text="取消", font=DarkTheme.FONT_BUTTON,
                              fg="white", bg=DarkTheme.BG_HOVER, relief=tk.FLAT,
                              cursor="hand2", command=self.window.destroy, padx=12, pady=6)
        cancel_btn.pack(side=tk.RIGHT, padx=4)

    def _show_step(self, step_idx):
        """显示指定步骤"""
        for w in self.content_frame.winfo_children():
            w.destroy()

        self.current_step = step_idx
        self.prev_btn.config(state=tk.NORMAL if step_idx > 0 else tk.DISABLED,
                            bg=DarkTheme.ACCENT_BLUE if step_idx > 0 else DarkTheme.BG_HOVER)
        self.next_btn.config(text="完成提交" if step_idx == len(self.steps) - 1 else "下一步 ▶")

        if step_idx == 0:
            self._build_step_customer_info()
        elif step_idx == 1:
            self._build_step_rental_mode()
        elif step_idx == 2:
            self._build_step_mode_params()
        elif step_idx == 3:
            self._build_step_line_items()
        elif step_idx == 4:
            self._build_step_hardware()
        elif step_idx == 5:
            self._build_step_confirm()

    def _build_step_customer_info(self):
        """步骤 1：客户信息"""
        tk.Label(self.content_frame, text="客户信息", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        self.refs = {}
        fields = [("客户名称 *", "customer_name"), ("客户电话 *", "customer_phone"),
                 ("身份证号", "customer_id_card"), ("地址", "customer_address")]

        for label, key in fields:
            row = tk.Frame(self.content_frame, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=4)
            tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 8))
            entry = ttk.Entry(row, width=40, font=DarkTheme.FONT_NORMAL)
            entry.insert(0, self.contract_data.get(key, ""))
            entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
            self.refs[key] = entry

    def _build_step_rental_mode(self):
        """步骤 2：租赁模式"""
        tk.Label(self.content_frame, text="选择租赁模式", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        self.mode_var = tk.StringVar(value=self.contract_data.get("rental_mode", "纯租赁"))
        
        modes = ["纯租赁", "租赁+购买", "预付款+按次"]
        for mode in modes:
            rb = tk.Radiobutton(self.content_frame, text=mode, variable=self.mode_var, value=mode,
                               font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_PRIMARY,
                               bg=DarkTheme.BG_PRIMARY, selectcolor=DarkTheme.ACCENT_BLUE,
                               activebackground=DarkTheme.BG_PRIMARY)
            rb.pack(anchor=tk.W, pady=6)

    def _build_step_mode_params(self):
        """步骤 3：模式参数"""
        tk.Label(self.content_frame, text="设置模式参数", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        mode = self.contract_data.get("rental_mode", "纯租赁")
        
        self.refs = {}
        row = tk.Frame(self.content_frame, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=4)
        tk.Label(row, text="起租日期 *", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 8))
        self.refs["start_date"] = ttk.Entry(row, width=40, font=DarkTheme.FONT_NORMAL)
        self.refs["start_date"].insert(0, self.contract_data.get("start_date", datetime.now().strftime("%Y-%m-%d")))
        self.refs["start_date"].pack(side=tk.LEFT, fill=tk.X, expand=True)

        row = tk.Frame(self.content_frame, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=4)
        tk.Label(row, text="到期日期 *", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 8))
        self.refs["end_date"] = ttk.Entry(row, width=40, font=DarkTheme.FONT_NORMAL)
        self.refs["end_date"].insert(0, self.contract_data.get("end_date", (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")))
        self.refs["end_date"].pack(side=tk.LEFT, fill=tk.X, expand=True)

        row = tk.Frame(self.content_frame, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=4)
        tk.Label(row, text="押金", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 8))
        self.refs["deposit"] = ttk.Entry(row, width=40, font=DarkTheme.FONT_NORMAL)
        self.refs["deposit"].insert(0, str(self.contract_data.get("deposit", "0")))
        self.refs["deposit"].pack(side=tk.LEFT, fill=tk.X, expand=True)

    def _build_step_line_items(self):
        """步骤 4：项目明细"""
        tk.Label(self.content_frame, text="添加租赁项目", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        btn = tk.Button(self.content_frame, text="➕ 添加项目", font=DarkTheme.FONT_BUTTON,
                       fg="white", bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT,
                       cursor="hand2", command=self._add_line_item, padx=12, pady=6)
        btn.pack(anchor=tk.W, pady=(0, 12))
        DarkTheme.bind_hover(btn, DarkTheme.ACCENT_GREEN)

        # 项目列表
        if self.line_items:
            for i, item in enumerate(self.line_items):
                item_txt = f"{i+1}. {item.get('item_name', '')} × {item.get('quantity', 1)} ¥{float(item.get('unit_monthly_rent', 0)):.2f}/月"
                tk.Label(self.content_frame, text=item_txt, font=DarkTheme.FONT_NORMAL,
                        fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=2)
        else:
            tk.Label(self.content_frame, text="(暂无项目，请点击\"添加项目\")",
                    font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_MUTED,
                    bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(8, 0))

    def _add_line_item(self):
        """添加项目项目"""
        dlg = AddLineItemDialog(self.window, data_manager=self.dm, contract_id=None,
                               on_save=self._save_line_item)

    def _save_line_item(self, item_data):
        """保存项目项目"""
        # 计算月租小计和总租金
        qty = item_data.get("quantity", 1)
        unit_rent = item_data.get("unit_monthly_rent", 0)
        monthly_rent = qty * unit_rent
        
        try:
            start = datetime.strptime(item_data.get("start_date", ""), "%Y-%m-%d")
            end = datetime.strptime(item_data.get("end_date", ""), "%Y-%m-%d")
            months = max((end - start).days / 30.0, 1)
            total_rent = monthly_rent * months
        except ValueError:
            total_rent = monthly_rent
        
        item_data["monthly_rent"] = monthly_rent
        item_data["total_rent"] = total_rent
        self.line_items.append(item_data)
        self._show_step(self.current_step)

    def _build_step_hardware(self):
        """步骤 5：硬件配置"""
        tk.Label(self.content_frame, text="硬件配置（可选）", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))
        tk.Label(self.content_frame, text="硬件配置在项目明细中添加",
                font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_MUTED,
                bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)

    def _build_step_confirm(self):
        """步骤 6：确认提交"""
        tk.Label(self.content_frame, text="确认合同信息", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        summary = f"""
客户名称：{self.contract_data.get('customer_name', '')}
客户电话：{self.contract_data.get('customer_phone', '')}
租赁模式：{self.contract_data.get('rental_mode', '')}
起租日期：{self.contract_data.get('start_date', '')}
到期日期：{self.contract_data.get('end_date', '')}

项目数量：{len(self.line_items)} 个
总租金：¥{sum(float(i.get('total_rent', 0)) for i in self.line_items):.2f}
        """

        tk.Label(self.content_frame, text=summary, font=DarkTheme.FONT_NORMAL,
                fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY, justify=tk.LEFT).pack(anchor=tk.NW, pady=(0, 12))

    def _prev_step(self):
        """上一步"""
        if self.current_step > 0:
            self._collect_step_data()
            self._show_step(self.current_step - 1)

    def _next_step(self):
        """下一步或提交"""
        if not self._collect_step_data():
            return

        if self.current_step < len(self.steps) - 1:
            self._show_step(self.current_step + 1)
        else:
            self._submit()

    def _collect_step_data(self) -> bool:
        """收集当前步骤数据"""
        if self.current_step == 0:
            # 验证客户信息
            name = self.refs.get("customer_name", "").get().strip() if "customer_name" in self.refs else ""
            phone = self.refs.get("customer_phone", "").get().strip() if "customer_phone" in self.refs else ""
            if not name or not phone:
                messagebox.showwarning("提示", "客户名称和电话不能为空")
                return False
            self.contract_data["customer_name"] = name
            self.contract_data["customer_phone"] = phone
            self.contract_data["customer_id_card"] = self.refs.get("customer_id_card", "").get().strip() if "customer_id_card" in self.refs else ""
            self.contract_data["customer_address"] = self.refs.get("customer_address", "").get().strip() if "customer_address" in self.refs else ""
        elif self.current_step == 1:
            self.contract_data["rental_mode"] = self.mode_var.get()
        elif self.current_step == 2:
            start = self.refs.get("start_date", "").get().strip() if "start_date" in self.refs else ""
            end = self.refs.get("end_date", "").get().strip() if "end_date" in self.refs else ""
            if not start or not end:
                messagebox.showwarning("提示", "起租日期和到期日期不能为空")
                return False
            self.contract_data["start_date"] = start
            self.contract_data["end_date"] = end
            try:
                self.contract_data["deposit"] = float(self.refs.get("deposit", "").get().strip() or "0")
            except ValueError:
                messagebox.showwarning("提示", "押金必须是数字")
                return False
        elif self.current_step == 3:
            if not self.line_items:
                messagebox.showwarning("提示", "至少需要添加一个项目")
                return False
        return True

    def _submit(self):
        """提交创建合同"""
        try:
            # 创建合同
            contract_id = self.dm.create_contract(
                customer_name=self.contract_data.get("customer_name", ""),
                customer_phone=self.contract_data.get("customer_phone", ""),
                customer_id_card=self.contract_data.get("customer_id_card", ""),
                customer_address=self.contract_data.get("customer_address", ""),
                start_date=self.contract_data.get("start_date", ""),
                end_date=self.contract_data.get("end_date", ""),
                deposit=self.contract_data.get("deposit", 0),
            )

            # 添加项目
            for item in self.line_items:
                self.dm.add_line_item(
                    contract_id=contract_id,
                    item_name=item.get("item_name", ""),
                    item_type=item.get("item_type", "电脑"),
                    quantity=item.get("quantity", 1),
                    unit_monthly_rent=item.get("unit_monthly_rent", 0),
                    start_date=item.get("start_date", ""),
                    end_date=item.get("end_date", ""),
                )

            self.result = contract_id
            messagebox.showinfo("成功", f"合同 {contract_id} 已创建")
            self.window.destroy()
        except Exception as e:
            messagebox.showerror("错误", f"创建合同失败：{e}")

    def show(self):
        """显示向导并返回结果"""
        self.window.wait_window()
        return self.result


class AddPaymentDialog(tk.Toplevel):
    """添加收款对话框"""

    def __init__(self, parent, data_manager, contract):
        super().__init__(parent)
        self.data_manager = data_manager
        self.contract = contract
        self.title("💰 记录收款")
        self.geometry("500x400")
        self.transient(parent)
        self.grab_set()
        self.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window()
        self.result = None
        self._build()

    def _center_window(self):
        self.update_idletasks()
        x = (self.winfo_screenwidth() // 2) - 250
        y = (self.winfo_screenheight() // 2) - 200
        self.geometry(f"500x400+{x}+{y}")

    def _build(self):
        """构建表单"""
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        tk.Label(main, text="💰 记录收款", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        # 合同信息
        info_txt = f"合同：{self.contract.get('contract_id', '')}\n客户：{self.contract.get('customer_name', '')}\n未收金额：¥{float(self.contract.get('unpaid_amount', 0)):.2f}"
        tk.Label(main, text=info_txt, font=DarkTheme.FONT_NORMAL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, justify=tk.LEFT).pack(anchor=tk.W, pady=(0, 12))

        # 金额
        row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=6)
        tk.Label(row, text="收款金额 *", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 8))
        self.amount_entry = ttk.Entry(row, width=30, font=DarkTheme.FONT_NORMAL)
        self.amount_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 日期
        row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=6)
        tk.Label(row, text="收款日期 *", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 8))
        self.date_entry = ttk.Entry(row, width=30, font=DarkTheme.FONT_NORMAL)
        self.date_entry.insert(0, datetime.now().strftime("%Y-%m-%d"))
        self.date_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # 备注
        row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=6)
        tk.Label(row, text="备注", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.NE).pack(side=tk.LEFT, padx=(0, 8))
        self.notes_entry = tk.Text(row, height=3, font=DarkTheme.FONT_NORMAL,
                                  bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY)
        self.notes_entry.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 按钮
        btn_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, pady=(12, 0))

        save_btn = tk.Button(btn_row, text="💾 保存", font=DarkTheme.FONT_BUTTON,
                            fg="white", bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT,
                            cursor="hand2", command=self._save, padx=12, pady=6)
        save_btn.pack(side=tk.LEFT, padx=4)
        DarkTheme.bind_hover(save_btn, DarkTheme.ACCENT_BLUE)

        cancel_btn = tk.Button(btn_row, text="取消", font=DarkTheme.FONT_BUTTON,
                              fg="white", bg=DarkTheme.BG_HOVER, relief=tk.FLAT,
                              cursor="hand2", command=self.destroy, padx=12, pady=6)
        cancel_btn.pack(side=tk.LEFT, padx=4)

    def _save(self):
        """保存收款记录"""
        try:
            amount = float(self.amount_entry.get().strip())
            if amount <= 0:
                messagebox.showwarning("提示", "收款金额必须大于 0")
                return
            
            payment_date = self.date_entry.get().strip()
            notes = self.notes_entry.get("1.0", tk.END).strip()

            self.data_manager.add_payment(
                contract_id=self.contract.get("contract_id", ""),
                amount=amount,
                payment_date=payment_date,
                notes=notes,
            )

            self.result = True
            messagebox.showinfo("成功", "收款已记录")
            self.destroy()
        except ValueError:
            messagebox.showerror("错误", "收款金额必须是有效的数字")

    def show(self):
        """显示对话框并返回结果"""
        self.wait_window()
        return self.result
