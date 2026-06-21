#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""设备库存管理模块。"""

import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime

from theme.colors import DarkTheme


class InventoryManagementFrame(ttk.Frame):
    """设备库存管理页面。"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)
        self.data_manager = data_manager
        self.configure(style="Main.TFrame")
        self.search_var = tk.StringVar()
        self.status_var = tk.StringVar(value="就绪")
        self.summary_var = tk.StringVar(value="")
        self._build()
        self._refresh()

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        header = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        header.pack(fill=tk.X, pady=(0, 16))
        tk.Label(header, text="📦 设备库存管理", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.TEXT_PRIMARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        tk.Label(header, text="查看型号库存、借出数量与库存流水", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(4, 0))

        top = tk.Frame(main, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        top.pack(fill=tk.X, pady=(0, 12))
        tk.Label(top, textvariable=self.summary_var, font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=16, pady=12)

        search = tk.Frame(main, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        search.pack(fill=tk.X, pady=(0, 12))
        row = tk.Frame(search, bg=DarkTheme.BG_CARD)
        row.pack(fill=tk.X, padx=16, pady=12)
        tk.Label(row, text="搜索", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD).pack(side=tk.LEFT)
        ttk.Entry(row, textvariable=self.search_var, width=24).pack(side=tk.LEFT, padx=(8, 10))
        tk.Button(row, text="查询", font=DarkTheme.FONT_BUTTON, fg="white", bg=DarkTheme.ACCENT_BLUE,
                  relief=tk.FLAT, cursor="hand2", command=self._refresh, padx=14, pady=7).pack(side=tk.LEFT)
        tk.Button(row, text="刷新", font=DarkTheme.FONT_BUTTON, fg="white", bg=DarkTheme.ACCENT_GREEN,
                  relief=tk.FLAT, cursor="hand2", command=self._refresh, padx=14, pady=7).pack(side=tk.LEFT, padx=(8, 0))
        tk.Button(row, text="补录库存", font=DarkTheme.FONT_BUTTON, fg="white", bg=DarkTheme.ACCENT_YELLOW,
                  relief=tk.FLAT, cursor="hand2", command=self._adjust_stock, padx=14, pady=7).pack(side=tk.RIGHT)

        body = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        body.pack(fill=tk.BOTH, expand=True)
        left = tk.Frame(body, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 8))
        right = tk.Frame(body, bg=DarkTheme.BG_CARD, highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        right.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(8, 0))

        tk.Label(left, text="库存型号列表", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_GREEN, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=16, pady=(12, 8))
        cols = ("ID", "分类", "品牌", "型号", "总库存", "已借出", "可用", "成本", "月租")
        self.tree = ttk.Treeview(left, columns=cols, show="headings", height=12)
        widths = {"ID": 60, "分类": 70, "品牌": 90, "型号": 170, "总库存": 70, "已借出": 70, "可用": 70, "成本": 80, "月租": 80}
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 100), anchor="center")
        self.tree.pack(fill=tk.BOTH, expand=True, padx=16, pady=(0, 12))
        self.tree.bind("<<TreeviewSelect>>", lambda *_: self._load_selected())

        tk.Label(right, text="库存流水", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_PURPLE, bg=DarkTheme.BG_CARD).pack(anchor=tk.W, padx=16, pady=(12, 8))
        self.detail_text = tk.Text(right, height=16, wrap=tk.WORD, font=DarkTheme.FONT_NORMAL,
                                   bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, insertbackground=DarkTheme.TEXT_PRIMARY)
        self.detail_text.pack(fill=tk.BOTH, expand=True, padx=16, pady=(0, 12))
        self.detail_text.configure(state="disabled")

        footer = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        footer.pack(fill=tk.X, pady=(10, 0))
        tk.Label(footer, textvariable=self.status_var, font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)

    def _get_models(self):
        q = self.search_var.get().strip()
        rows = self.data_manager.search_models(q) if q else self.data_manager.get_models_by_category("cpu")
        if q:
            return rows
        rows += self.data_manager.get_models_by_category("mb")
        rows += self.data_manager.get_models_by_category("ram")
        rows += self.data_manager.get_models_by_category("disk")
        rows += self.data_manager.get_models_by_category("gpu")
        rows += self.data_manager.get_models_by_category("psu")
        rows += self.data_manager.get_models_by_category("case")
        rows += self.data_manager.get_models_by_category("cooler")
        rows += self.data_manager.get_models_by_category("monitor")
        return rows

    def _refresh(self):
        models = self._get_models()
        for item in self.tree.get_children():
            self.tree.delete(item)
        for model in models:
            total = int(model.get("stock_total") or 0)
            rented = int(model.get("stock_rented") or 0)
            available = max(total - rented, 0)
            self.tree.insert("", tk.END, values=(
                model.get("id", ""),
                model.get("category", ""),
                model.get("brand", ""),
                model.get("model_name", ""),
                total,
                rented,
                available,
                f"¥{model.get('reference_cost', 0) or 0}",
                f"¥{model.get('reference_rent', 0) or 0}",
            ))
        total_stock = sum(int(m.get("stock_total") or 0) for m in models)
        total_rented = sum(int(m.get("stock_rented") or 0) for m in models)
        total_available = sum(max(int(m.get("stock_total") or 0) - int(m.get("stock_rented") or 0), 0) for m in models)
        self.summary_var.set(f"共 {len(models)} 个型号；总库存 {total_stock}；已借出 {total_rented}；可用 {total_available}")
        self.status_var.set(f"最后刷新：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self._show_empty_detail()

    def _selected_model_id(self):
        sel = self.tree.selection()
        if not sel:
            return None
        values = self.tree.item(sel[0], "values")
        return int(values[0]) if values and values[0] else None

    def _load_selected(self):
        model_id = self._selected_model_id()
        if not model_id:
            self._show_empty_detail()
            return
        model = self.data_manager.get_model_by_id(model_id)
        if not model:
            self._show_empty_detail()
            return
        txs = self.data_manager.get_inventory_transactions(model_id=model_id)
        lines = [
            f"型号：{model.get('brand', '')} {model.get('model_name', '')}",
            f"分类：{model.get('category', '')}",
            f"总库存：{int(model.get('stock_total') or 0)}",
            f"已借出：{int(model.get('stock_rented') or 0)}",
            f"可用库存：{max(int(model.get('stock_total') or 0) - int(model.get('stock_rented') or 0), 0)}",
            f"参考成本：{model.get('reference_cost', '')}",
            f"参考月租：{model.get('reference_rent', '')}",
            "",
            "库存流水：",
        ]
        if txs:
            for tx in txs[:30]:
                lines.append(f"- {tx.get('created_at', '')} | {tx.get('trans_type', '')} | 数量 {tx.get('quantity', '')} | {tx.get('note', '')}")
        else:
            lines.append("- 暂无流水")
        self._set_detail("\n".join(lines))

    def _show_empty_detail(self):
        self._set_detail("请选择左侧一条型号查看库存详情与流水。")

    def _set_detail(self, text):
        self.detail_text.configure(state="normal")
        self.detail_text.delete("1.0", tk.END)
        self.detail_text.insert("1.0", text)
        self.detail_text.configure(state="disabled")

    def _adjust_stock(self):
        model_id = self._selected_model_id()
        if not model_id:
            messagebox.showwarning("提示", "请先选择一个型号")
            return
        model = self.data_manager.get_model_by_id(model_id)
        if not model:
            messagebox.showerror("错误", "未找到型号信息")
            return

        dlg = _StockAdjustDialog(self, model)
        result = dlg.show()
        if not result:
            return

        total = int(model.get("stock_total") or 0)
        rented = int(model.get("stock_rented") or 0)
        trans_type = result["trans_type"]
        qty = int(result["quantity"])
        if trans_type == "入库":
            total += qty
        elif trans_type == "出库":
            if total - qty < rented:
                messagebox.showerror("错误", "出库数量不能小于已借出数量")
                return
            total -= qty
        elif trans_type == "借出":
            if total - rented < qty:
                messagebox.showerror("错误", "可用库存不足")
                return
            rented += qty
        elif trans_type == "归还":
            if rented < qty:
                messagebox.showerror("错误", "已借出数量不足")
                return
            rented -= qty
        else:
            return

        self.data_manager.update_model(model_id, stock_total=total, stock_rented=rented)
        self.data_manager.add_inventory_transaction(
            model_id=model_id,
            trans_type=trans_type,
            quantity=qty,
            operator=result.get("operator", "系统"),
            note=result.get("note", ""),
        )
        self._refresh()
        messagebox.showinfo("成功", "库存已更新")


class _StockAdjustDialog:
    def __init__(self, parent, model):
        self.parent = parent
        self.model = model
        self.result = None
        self.win = tk.Toplevel(parent)
        self.win.title("库存调整")
        self.win.geometry("420x280")
        self.win.transient(parent)
        self.win.grab_set()
        self.win.configure(bg=DarkTheme.BG_PRIMARY)
        self.quantity_var = tk.StringVar(value="1")
        self.trans_var = tk.StringVar(value="入库")
        self.operator_var = tk.StringVar(value="系统")
        self.note_var = tk.StringVar(value="")
        self._build()

    def _build(self):
        box = tk.Frame(self.win, bg=DarkTheme.BG_PRIMARY)
        box.pack(fill=tk.BOTH, expand=True, padx=18, pady=18)
        tk.Label(box, text=f"{self.model.get('brand', '')} {self.model.get('model_name', '')}", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 10))
        for label, var, values in [
            ("类型", self.trans_var, ["入库", "出库", "借出", "归还"]),
            ("数量", self.quantity_var, None),
            ("操作人", self.operator_var, None),
            ("备注", self.note_var, None),
        ]:
            row = tk.Frame(box, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=4)
            tk.Label(row, text=label, width=8, anchor=tk.E, bg=DarkTheme.BG_PRIMARY, fg=DarkTheme.TEXT_SECONDARY).pack(side=tk.LEFT)
            if values:
                ttk.Combobox(row, textvariable=var, values=values, state="readonly").pack(side=tk.LEFT, fill=tk.X, expand=True)
            else:
                ttk.Entry(row, textvariable=var).pack(side=tk.LEFT, fill=tk.X, expand=True)
        btn = tk.Frame(box, bg=DarkTheme.BG_PRIMARY)
        btn.pack(fill=tk.X, pady=(14, 0))
        tk.Button(btn, text="确定", command=self._ok, bg=DarkTheme.ACCENT_BLUE, fg="white", relief=tk.FLAT).pack(side=tk.RIGHT, padx=(8, 0))
        tk.Button(btn, text="取消", command=self._cancel, bg=DarkTheme.BG_HOVER, fg="white", relief=tk.FLAT).pack(side=tk.RIGHT)

    def _ok(self):
        try:
            qty = int(float(self.quantity_var.get().strip() or 0))
        except ValueError:
            messagebox.showerror("错误", "数量必须为数字")
            return
        if qty <= 0:
            messagebox.showerror("错误", "数量必须大于 0")
            return
        self.result = {
            "trans_type": self.trans_var.get(),
            "quantity": qty,
            "operator": self.operator_var.get().strip() or "系统",
            "note": self.note_var.get().strip(),
        }
        self.win.destroy()

    def _cancel(self):
        self.win.destroy()

    def show(self):
        self.win.wait_window()
        return self.result
