#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
租赁管理 v2 表单组件
新版支持租赁项目清单、硬件变更、租金变更、收款记录和审计日志
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime, timedelta
import json
from theme.colors import DarkTheme


class LineItemsListFrame(ttk.Frame):
    """租赁项目清单可复用组件"""

    def __init__(self, parent, data_manager=None, contract_id=None, editable=True):
        super().__init__(parent)
        self.data_manager = data_manager
        self.contract_id = contract_id
        self.editable = editable
        self.items = []
        self._build()

    def _build(self):
        """构建项目清单表格"""
        cols = ("项目名称", "类型", "数量", "单价/月", "月租小计", "项目总租金", "状态", "操作")
        widths = {"项目名称": 120, "类型": 60, "数量": 50, "单价/月": 80,
                  "月租小计": 100, "项目总租金": 100, "状态": 60, "操作": 100}

        self.tree = ttk.Treeview(self, columns=cols, show="headings", height=8)
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 80), anchor="center")

        vbar = ttk.Scrollbar(self, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)

    def load_items(self):
        """从 contract 加载项目清单"""
        if not self.contract_id or not self.data_manager:
            return
        contract = self.data_manager.get_contract(self.contract_id)
        if not contract:
            return
        self.items = contract.get("line_items", [])
        self._refresh_tree()

    def _refresh_tree(self):
        """刷新树视图"""
        for item in self.tree.get_children():
            self.tree.delete(item)
        for item in self.items:
            self.tree.insert("", tk.END, values=(
                item.get("item_name", ""),
                item.get("item_type", ""),
                item.get("quantity", 1),
                f"¥{float(item.get('unit_monthly_rent', 0)):.2f}",
                f"¥{float(item.get('monthly_rent', 0)):.2f}",
                f"¥{float(item.get('total_rent', 0)):.2f}",
                item.get("status", ""),
                "编辑" if self.editable else "查看",
            ))

    def get_selected_item(self):
        """获取选中的项目"""
        sel = self.tree.selection()
        if not sel:
            return None
        idx = self.tree.index(sel[0])
        return self.items[idx] if idx < len(self.items) else None


class AddLineItemDialog(tk.Toplevel):
    """添加/编辑租赁项目对话框"""

    def __init__(self, parent, data_manager=None, contract_id=None, item=None, on_save=None):
        super().__init__(parent)
        self.data_manager = data_manager
        self.contract_id = contract_id
        self.item = item or {}
        self.on_save = on_save
        self.title("➕ 新增租赁项目" if not item else "✏️ 编辑租赁项目")
        self.geometry("600x700")
        self.transient(parent)
        self.grab_set()
        self.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window()
        self._build()

    def _center_window(self):
        self.update_idletasks()
        w, h = 600, 700
        parent = self.master if isinstance(self.master, tk.Misc) else None
        if parent is not None:
            parent.update_idletasks()
            x = parent.winfo_rootx() + max((parent.winfo_width() - w) // 2, 0)
            y = parent.winfo_rooty() + max((parent.winfo_height() - h) // 2, 0)
        else:
            x = (self.winfo_screenwidth() // 2) - (w // 2)
            y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    def _build(self):
        """构建表单"""
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        # 标题
        tk.Label(main, text="➕ 新增租赁项目" if not self.item else "✏️ 编辑项目",
                 font=DarkTheme.FONT_SUBTITLE, fg=DarkTheme.ACCENT_CYAN,
                 bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        # 基础信息
        self.refs = {}
        self.refs['name'] = self._make_field(main, "项目名称 *", self.item.get("item_name", ""))
        self.refs['type'] = self._make_field(main, "设备类型 *", self.item.get("item_type", "电脑"))
        self.refs['qty'] = self._make_field(main, "数量 *", str(self.item.get("quantity", 1)))
        self.refs['unit_rent'] = self._make_field(main, "单台月租 *", 
                                                    f"{float(self.item.get('unit_monthly_rent', 0)):.2f}")
        self.refs['start_date'] = self._make_field(main, "起租日期 *",
                                                     self.item.get("start_date", datetime.now().strftime("%Y-%m-%d")))
        self.refs['end_date'] = self._make_field(main, "到期日期 *",
                                                   self.item.get("end_date", (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")))

        # 自动计算
        def _auto_calc(*_):
            try:
                qty = int(self.refs['qty'].get().strip() or 1)
                unit = float(self.refs['unit_rent'].get().strip() or 0)
                monthly = qty * unit
                start_str = self.refs['start_date'].get().strip()
                end_str = self.refs['end_date'].get().strip()
                if start_str and end_str:
                    start = datetime.strptime(start_str, "%Y-%m-%d")
                    end = datetime.strptime(end_str, "%Y-%m-%d")
                    months = max((end - start).days / 30.0, 1)
                    total = monthly * months
                    # 更新显示（如果有的话）
            except ValueError:
                pass

        for w in (self.refs['qty'], self.refs['unit_rent'], self.refs['start_date'], self.refs['end_date']):
            w.bind("<KeyRelease>", _auto_calc)

        # 按钮
        btn_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, pady=(12, 0))
        save_btn = tk.Button(btn_row, text="💾 保存", font=DarkTheme.FONT_BUTTON,
                            fg="white", bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT,
                            cursor="hand2", command=self._on_save, padx=14, pady=8)
        save_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(save_btn, DarkTheme.ACCENT_BLUE)

        cancel_btn = tk.Button(btn_row, text="取消", font=DarkTheme.FONT_BUTTON,
                              fg="white", bg=DarkTheme.BG_HOVER, relief=tk.FLAT,
                              cursor="hand2", command=self.destroy, padx=14, pady=8)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

    def _make_field(self, parent, label, value):
        """创建输入字段"""
        row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=3)
        tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        entry = ttk.Entry(row, width=30, font=DarkTheme.FONT_NORMAL)
        entry.insert(0, str(value))
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        return entry

    def _on_save(self):
        """保存项目"""
        try:
            name = self.refs['name'].get().strip()
            if not name:
                messagebox.showwarning("提示", "项目名称不能为空")
                return
            qty = int(self.refs['qty'].get().strip() or 1)
            if qty <= 0:
                messagebox.showwarning("提示", "数量必须大于 0")
                return
            unit_rent = float(self.refs['unit_rent'].get().strip() or 0)
            if unit_rent < 0:
                messagebox.showwarning("提示", "单台月租不能为负数")
                return

            item_data = {
                "item_name": name,
                "item_type": self.refs['type'].get().strip() or "电脑",
                "quantity": qty,
                "unit_monthly_rent": unit_rent,
                "start_date": self.refs['start_date'].get().strip(),
                "end_date": self.refs['end_date'].get().strip(),
            }
            if self.on_save:
                try:
                    self.on_save(item_data)
                except Exception as e:
                    messagebox.showerror("错误", f"保存失败：{e}")
                    return
            messagebox.showinfo("成功", "项目已保存")
            self.destroy()
        except ValueError as e:
            messagebox.showerror("错误", f"输入错误：{e}")


class PaymentDialog(tk.Toplevel):
    """添加收款对话框"""

    def __init__(self, parent, contract_id=None, on_save=None):
        super().__init__(parent)
        self.contract_id = contract_id
        self.on_save = on_save
        self.title("➕ 添加收款")
        self.geometry("500x400")
        self.transient(parent)
        self.grab_set()
        self.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window()
        self._build()

    def _center_window(self):
        self.update_idletasks()
        w, h = 500, 400
        parent = self.master if isinstance(self.master, tk.Misc) else None
        if parent is not None:
            parent.update_idletasks()
            x = parent.winfo_rootx() + max((parent.winfo_width() - w) // 2, 0)
            y = parent.winfo_rooty() + max((parent.winfo_height() - h) // 2, 0)
        else:
            x = (self.winfo_screenwidth() // 2) - (w // 2)
            y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    def _build(self):
        """构建表单"""
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        tk.Label(main, text="➕ 添加收款", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_GREEN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        self.refs = {}
        self.refs['date'] = self._make_field(main, "收款日期 *", datetime.now().strftime("%Y-%m-%d"))
        self.refs['amount'] = self._make_field(main, "收款金额 *", "0.00")
        self.refs['method'] = self._make_field(main, "收款方式", "银行转账")
        self.refs['receipt'] = self._make_field(main, "凭证号", "")
        self.refs['notes'] = self._make_field(main, "备注", "")

        # 按钮
        btn_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, pady=(12, 0))
        save_btn = tk.Button(btn_row, text="💾 保存", font=DarkTheme.FONT_BUTTON,
                            fg="white", bg=DarkTheme.ACCENT_GREEN, relief=tk.FLAT,
                            cursor="hand2", command=self._on_save, padx=14, pady=8)
        save_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(save_btn, DarkTheme.ACCENT_GREEN)

        cancel_btn = tk.Button(btn_row, text="取消", font=DarkTheme.FONT_BUTTON,
                              fg="white", bg=DarkTheme.BG_HOVER, relief=tk.FLAT,
                              cursor="hand2", command=self.destroy, padx=14, pady=8)
        cancel_btn.pack(side=tk.LEFT)

    def _make_field(self, parent, label, value):
        """创建输入字段"""
        row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
        row.pack(fill=tk.X, pady=3)
        tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.E).pack(side=tk.LEFT, padx=(0, 4))
        entry = ttk.Entry(row, width=30, font=DarkTheme.FONT_NORMAL)
        entry.insert(0, str(value))
        entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        return entry

    def _on_save(self):
        """保存收款"""
        try:
            amount = float(self.refs['amount'].get().strip() or 0)
            if amount <= 0:
                messagebox.showwarning("提示", "收款金额必须大于 0")
                return
            payment_data = {
                "payment_date": self.refs['date'].get().strip(),
                "amount": amount,
                "payment_method": self.refs['method'].get().strip(),
                "receipt_no": self.refs['receipt'].get().strip(),
                "notes": self.refs['notes'].get().strip(),
            }
            if self.on_save:
                try:
                    self.on_save(payment_data)
                except Exception as e:
                    messagebox.showerror("错误", f"保存失败：{e}")
                    return
            messagebox.showinfo("成功", "收款已记录")
            self.destroy()
        except ValueError as e:
            messagebox.showerror("错误", f"输入错误：{e}")
