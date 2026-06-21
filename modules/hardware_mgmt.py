#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""硬件管理模块 - 支持一条租赁记录包含多种设备配置"""

import tkinter as tk
from tkinter import ttk, messagebox
from theme.colors import DarkTheme
from widgets.autocomplete import AutocompleteEntry


class HardwareDialog:
    """多设备硬件清单编辑对话框"""

    def __init__(self, parent, hardware_data=None, data_manager=None):
        self.hardware = hardware_data or {}
        self.items = self._load_items(self.hardware)
        self.result = None
        self.win = None
        self.tree = None
        self._data_manager = data_manager
        self._create_window(parent)

    def _load_items(self, hardware):
        """兼容旧硬件结构，统一转为 items 列表。"""
        if isinstance(hardware, dict) and isinstance(hardware.get("items"), list):
            return [dict(i) for i in hardware.get("items", [])]
        if isinstance(hardware, dict) and any(hardware.values()):
            item = dict(hardware)
            item.setdefault("quantity", 1)
            item.setdefault("device_type", item.get("pc_type", "台式机"))
            item.setdefault("unit_rent", "")
            return [item]
        return []

    def _create_window(self, parent):
        self.win = tk.Toplevel(parent)
        self.win.title("硬件信息管理（多设备）")
        self.win.geometry("900x620")
        self.win.transient(parent)
        self.win.grab_set()
        self.win.configure(bg=DarkTheme.BG_PRIMARY)
        self.win.protocol("WM_DELETE_WINDOW", self._on_close)
        self._center_window(900, 620)
        self._build_ui()

    def _on_close(self):
        """安全关闭窗口，释放 grab"""
        try:
            self.win.grab_release()
        except Exception:
            pass
        self.win.destroy()

    def _center_window(self, w, h):
        self.win.update_idletasks()
        x = (self.win.winfo_screenwidth() // 2) - (w // 2)
        y = (self.win.winfo_screenheight() // 2) - (h // 2)
        self.win.geometry(f"{w}x{h}+{x}+{y}")

    def _action_button(self, parent, text, command, color, padx=12, pady=7):
        btn = tk.Button(parent, text=text, font=DarkTheme.FONT_BUTTON, fg="white", bg=color,
                        relief=tk.FLAT, cursor="hand2", command=command, padx=padx, pady=pady)
        btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(btn, color)
        return btn

    def _panel_label(self, parent, text, color):
        return tk.Label(parent, text=text, font=DarkTheme.FONT_SUBTITLE,
                        fg=color, bg=DarkTheme.BG_PRIMARY)

    def _build_ui(self):
        main = tk.Frame(self.win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=18, pady=16)

        header = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        header.pack(fill=tk.X, pady=(0, 8))
        self._panel_label(header, "💻 硬件清单（可添加多种不同配置）", DarkTheme.ACCENT_CYAN).pack(side=tk.LEFT)
        tk.Label(header, text="双击行可直接编辑，右键可删除", font=DarkTheme.FONT_SMALL,
                 fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY).pack(side=tk.RIGHT)

        cols = ("类型", "数量", "CPU/型号", "内存", "硬盘", "显卡", "机箱", "电源", "风扇", "显示器", "成本", "估值", "月租", "备注")
        self.tree = ttk.Treeview(main, columns=cols, show="headings", height=13)
        widths = {"类型": 70, "数量": 40, "CPU/型号": 120, "内存": 70, "硬盘": 80,
                  "显卡": 80, "机箱": 70, "电源": 60, "风扇": 50, "显示器": 70, "成本": 60, "估值": 60, "月租": 60, "备注": 100}
        for c in cols:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=widths.get(c, 100), anchor="center")
        self.tree.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        self.tree.bind("<Double-1>", lambda *_: self._edit_item())

        btn_row = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn_row.pack(fill=tk.X, pady=(0, 8))
        tk.Label(btn_row, text="模板", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT, padx=(0, 6))
        self.template_var = tk.StringVar(value="")
        self.template_combo = ttk.Combobox(
            btn_row,
            textvariable=self.template_var,
            state="readonly",
            values=list(self.CONFIG_TEMPLATES.keys()),
            width=14,
            font=DarkTheme.FONT_NORMAL,
        )
        self.template_combo.pack(side=tk.LEFT, padx=(0, 8))
        self.template_combo.bind("<<ComboboxSelected>>", lambda e: self._apply_template(self.template_var.get()))
        self._action_button(btn_row, "➕ 添加设备", self._add_item, DarkTheme.ACCENT_GREEN, padx=14, pady=8)
        self._action_button(btn_row, "✏️ 编辑设备", self._edit_item, DarkTheme.ACCENT_YELLOW, padx=14, pady=8)
        self._action_button(btn_row, "🗑️ 删除设备", self._delete_item, DarkTheme.ACCENT_RED, padx=14, pady=8)

        self.summary_label = tk.Label(main, text="", font=DarkTheme.FONT_LABEL,
                                      fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY)
        self.summary_label.pack(anchor=tk.W, pady=(0, 8))

        save_row = tk.Frame(self.win, bg=DarkTheme.BG_PRIMARY)
        save_row.pack(fill=tk.X, padx=16, pady=(0, 14))
        self._action_button(save_row, "💾 保存清单", self._save, DarkTheme.ACCENT_BLUE, padx=16, pady=9)
        self._action_button(save_row, "取消", self._cancel, DarkTheme.BG_HOVER, padx=16, pady=9)
        self._refresh_tree()

    def _safe_float(self, value, default=0.0):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _refresh_tree(self):
        for row_id in self.tree.get_children():
            self.tree.delete(row_id)
        for idx, item in enumerate(self.items):
            cost = item.get("unit_cost", "")
            cost_str = f"¥{cost}" if cost else ""
            est_value = item.get("estimated_value", "")
            est_value_str = f"¥{est_value}" if est_value else ""
            self.tree.insert("", tk.END, iid=str(idx), values=(
                item.get("device_type", ""),
                item.get("quantity", 1),
                item.get("cpu", "") or item.get("laptop", "") or item.get("model", ""),
                item.get("ram", ""),
                item.get("disk", ""),
                item.get("gpu", ""),
                item.get("case", ""),
                item.get("psu", ""),
                item.get("fan", ""),
                item.get("monitor", ""),
                cost_str,
                est_value_str,
                item.get("unit_rent", ""),
                item.get("notes", ""),
            ))
        total_qty = sum(self._safe_float(i.get("quantity")) for i in self.items)
        total_cost = sum(self._safe_float(i.get("quantity")) * self._safe_float(i.get("unit_cost")) for i in self.items)
        total_value = sum(self._safe_float(i.get("quantity")) * self._safe_float(i.get("estimated_value")) for i in self.items if i.get("estimated_value"))
        total_rent = sum(self._safe_float(i.get("quantity")) * self._safe_float(i.get("unit_rent")) for i in self.items if str(i.get("unit_rent", "")).strip() != "")
        self.summary_label.config(text=f"合计：{total_qty:g} 台/套设备；总成本：¥{total_cost:.0f}；总估值：¥{total_value:.0f}；月租金合计：¥{total_rent:.2f}/月")

    def _selected_index(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("提示", "请先选择一条设备")
            return None
        return int(sel[0])

    def _apply_template(self, name=None):
        if not name:
            return
        tpl = self.CONFIG_TEMPLATES.get(name)
        if not tpl:
            messagebox.showwarning("提示", "未找到该模板")
            return
        self.type_var.set(tpl.get("device_type", self.type_var.get()))
        self._on_type_change()
        for key, val in tpl.items():
            if key == "device_type":
                continue
            if key in self.config_entries:
                ent = self.config_entries[key]
                if hasattr(ent, 'set_value'):
                    ent.set_value(val)
                else:
                    ent.delete(0, tk.END)
                    ent.insert(0, val)
        messagebox.showinfo("成功", f"已套用模板：{name}")

    def _add_item(self):
        dlg = HardwareItemDialog(self.win, data_manager=self._data_manager)
        item = dlg.show()
        if item:
            self.items.append(item)
            self._refresh_tree()

    def _edit_item(self):
        idx = self._selected_index()
        if idx is None:
            return
        dlg = HardwareItemDialog(self.win, self.items[idx], data_manager=self._data_manager)
        item = dlg.show()
        if item:
            self.items[idx] = item
            self._refresh_tree()

    def _delete_item(self):
        idx = self._selected_index()
        if idx is None:
            return
        if messagebox.askyesno("确认", "确定删除这条设备配置？"):
            self.items.pop(idx)
            self._refresh_tree()

    def _save(self):
        self.result = {
            "items": self.items,
            "total_quantity": sum(float(i.get("quantity", 0) or 0) for i in self.items),
        }
        self.win.destroy()

    def _cancel(self):
        self.result = None
        self.win.destroy()

    def show(self):
        self.win.wait_window()
        return self.result


class HardwareItemDialog:
    """单条设备配置编辑 - 根据类型动态显示字段"""

    CONFIG_TEMPLATES = {
        "办公台式机": {
            "device_type": "台式机",
            "cpu": "Intel i5-12400",
            "motherboard": "B660",
            "ram": "16GB",
            "disk": "512GB SSD",
            "gpu": "集显",
            "case": "标准机箱",
            "psu": "500W",
            "fan": "原装散热",
        },
        "高配台式机": {
            "device_type": "台式机",
            "cpu": "Intel i7-12700",
            "motherboard": "Z690",
            "ram": "32GB",
            "disk": "1TB SSD",
            "gpu": "RTX 4060",
            "case": "游戏机箱",
            "psu": "650W",
            "fan": "塔式散热",
        },
        "入门笔记本": {
            "device_type": "笔记本",
            "brand_model": "轻薄本",
            "screen_size": "14",
            "cpu": "Intel i5-1235U",
            "ram": "16GB",
            "disk": "512GB SSD",
        },
        "高配笔记本": {
            "device_type": "笔记本",
            "brand_model": "游戏本",
            "screen_size": "15.6",
            "cpu": "Intel i7-13700H",
            "ram": "32GB",
            "disk": "1TB SSD",
        },
        "显示器套餐": {
            "device_type": "显示器",
            "monitor_brand": "AOC",
            "monitor_model": "24B2XH",
            "screen_size": "24",
            "resolution": "1920x1080",
            "refresh_rate": "75",
            "condition": "良好",
        },
    }

    # 字段配置：(键名, 标签)
    TYPE_FIELDS = {
        "显示器": [
            ("monitor_brand", "品牌"),
            ("monitor_model", "型号"),
            ("screen_size", "尺寸(寸)"),
            ("resolution", "分辨率"),
            ("refresh_rate", "刷新率(Hz)"),
            ("condition", "新旧程度"),
        ],
        "笔记本": [
            ("brand_model", "品牌型号"),
            ("screen_size", "屏幕尺寸(寸)"),
            ("cpu", "CPU"),
            ("ram", "内存"),
            ("disk", "硬盘"),
        ],
        "台式机": [
            ("cpu", "CPU"),
            ("motherboard", "主板"),
            ("ram", "内存"),
            ("disk", "硬盘"),
            ("gpu", "显卡"),
            ("case", "机箱"),
            ("psu", "电源"),
            ("fan", "风扇/散热"),
        ],
        "外设": [
            ("device_name", "设备名称"),
            ("brand", "品牌"),
            ("model", "型号"),
        ],
        "其他": [
            ("name", "名称"),
            ("specs", "规格"),
        ],
    }

    def __init__(self, parent, item=None, data_manager=None):
        self.item = item or {}
        self.result = None
        self.config_entries = {}
        self.config_autocomplete = {}  # 自动补全控件引用
        self.config_frame = None
        self.data_manager = data_manager
        self.selected_hardware_model = None  # 当前选中的型号数据
        self._selected_models = {}  # 跟踪各字段选中的型号 {field_key: model_data}
        self._model_fields = {"cpu", "motherboard", "ram", "disk", "gpu", "psu", "case", "fan", "brand", "model", "brand_model", "monitor_brand", "monitor_model", "device_name"}
        self.win = tk.Toplevel(parent)
        self.win.title("设备配置")
        self.win.geometry("750x600")
        self.win.minsize(720, 560)
        self.win.transient(parent)
        self.win.grab_set()
        self.win.configure(bg=DarkTheme.BG_PRIMARY)
        self.win.protocol("WM_DELETE_WINDOW", self._on_close)
        self._center(820, 660)
        self._build()

    def _on_close(self):
        """安全关闭窗口，释放 grab"""
        try:
            self.win.grab_release()
        except Exception:
            pass
        self.win.destroy()

    def _center(self, w, h):
        self.win.update_idletasks()
        x = (self.win.winfo_screenwidth() // 2) - (w // 2)
        y = (self.win.winfo_screenheight() // 2) - (h // 2)
        self.win.geometry(f"{w}x{h}+{x}+{y}")

    def _make_field(self, parent, label, default="", col=0, row=0, category=None, field_key=None):
        """创建紧凑输入行，支持自动补全。"""
        lbl = tk.Label(parent, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                       bg=DarkTheme.BG_PRIMARY, anchor=tk.E)
        lbl.grid(row=row, column=col * 2, sticky=tk.E, padx=(8, 4), pady=3)
        
        if category and self.data_manager:
            ent = AutocompleteEntry(
                parent,
                self.data_manager,
                category=category,
                width=25,
                on_select=lambda model, key=field_key or category: self._on_hardware_model_selected(model, key)
            )
            ent.grid(row=row, column=col * 2 + 1, sticky=tk.EW, padx=(0, 8), pady=3)
            if default is not None:
                ent.set_value(str(default))
            self.config_autocomplete[field_key or category] = ent
        else:
            ent = ttk.Entry(parent, font=DarkTheme.FONT_NORMAL)
            ent.grid(row=row, column=col * 2 + 1, sticky=tk.EW, padx=(0, 8), pady=3)
            if default is not None:
                ent.insert(0, str(default))
        
        return ent

    def _build(self):
        main = tk.Frame(self.win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)
        main.columnconfigure(1, weight=1)
        main.columnconfigure(3, weight=1)

        tk.Label(main, text="设备配置", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).grid(row=0, column=0, columnspan=4, sticky=tk.W, pady=(0, 8))

        # 设备类型
        self.type_var = tk.StringVar(value=self.item.get("device_type", self.item.get("pc_type", "台式机")))
        tk.Label(main, text="设备类型", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, anchor=tk.E).grid(row=1, column=0, sticky=tk.E, padx=(8, 4), pady=3)
        type_combo = ttk.Combobox(main, textvariable=self.type_var, state="readonly",
                                  values=["台式机", "笔记本", "显示器", "外设", "其他"], font=DarkTheme.FONT_NORMAL)
        type_combo.grid(row=1, column=1, columnspan=3, sticky=tk.EW, padx=(0, 8), pady=3)
        type_combo.bind("<<ComboboxSelected>>", self._on_type_change)
        self.type_var.trace_add("write", lambda *_: self._sync_model_category())

        # 基本信息
        self.qty_e = self._make_field(main, "数量*", self.item.get("quantity", 1), col=0, row=2)
        self.unit_cost_e = ttk.Entry(main, font=DarkTheme.FONT_NORMAL, state="readonly")
        self.unit_cost_e.grid(row=2, column=3, sticky=tk.EW, padx=(0, 8), pady=3)
        tk.Label(main, text="单台成本", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, anchor=tk.E).grid(row=2, column=2, sticky=tk.E, padx=(8, 4), pady=3)
        self.unit_rent_e = self._make_field(main, "单台月租", self.item.get("unit_rent", ""), col=0, row=3)
        tk.Label(main, text="CPU型号", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, anchor=tk.E).grid(row=3, column=2, sticky=tk.E, padx=(8, 4), pady=3)
        self.model_e = AutocompleteEntry(
            main,
            self.data_manager,
            category="cpu",
            width=25,
            on_select=lambda model: self._on_hardware_model_selected(model, "cpu")
        )
        self.model_e.grid(row=3, column=3, sticky=tk.EW, padx=(0, 8), pady=3)
        self.model_e.set_value(self.item.get("model", self.item.get("serial_number", "")))
        
        # 成本明细标签
        self.cost_detail_label = tk.Label(main, text="", font=("Consolas", 8),
                                          fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY, anchor=tk.W)
        self.cost_detail_label.grid(row=4, column=0, columnspan=4, sticky=tk.W, padx=(8, 8), pady=(0, 2))

        # 分隔线
        sep = tk.Frame(main, bg=DarkTheme.BG_HOVER, height=2)
        sep.grid(row=5, column=0, columnspan=4, sticky=tk.EW, pady=6)

        # 动态配置区
        self.config_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        self.config_frame.grid(row=6, column=0, columnspan=4, sticky=tk.EW, pady=(0, 6))
        self.config_frame.columnconfigure(1, weight=1)
        self.config_frame.columnconfigure(3, weight=1)
        self._build_config_fields()

        # 分隔线
        sep2 = tk.Frame(main, bg=DarkTheme.BG_HOVER, height=2)
        sep2.grid(row=7, column=0, columnspan=4, sticky=tk.EW, pady=6)

        # 配件/估值/备注
        tk.Label(main, text="配件", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, anchor=tk.NW).grid(row=8, column=0, sticky=tk.NW, padx=(8, 4), pady=3)
        self.accessories_t = tk.Text(main, height=2, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                                     bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, insertbackground=DarkTheme.TEXT_PRIMARY)
        self.accessories_t.grid(row=8, column=1, columnspan=3, sticky=tk.EW, padx=(0, 8), pady=3)
        if self.item.get("accessories"):
            self.accessories_t.insert("1.0", self.item["accessories"])

        tk.Label(main, text="当前估值", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, anchor=tk.E).grid(row=9, column=0, sticky=tk.E, padx=(8, 4), pady=3)
        self.estimated_value_e = ttk.Entry(main, font=DarkTheme.FONT_NORMAL)
        self.estimated_value_e.grid(row=9, column=1, columnspan=3, sticky=tk.EW, padx=(0, 8), pady=3)
        if self.item.get("estimated_value"):
            self.estimated_value_e.insert(0, str(self.item["estimated_value"]))

        tk.Label(main, text="备注", font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                 bg=DarkTheme.BG_PRIMARY, anchor=tk.NW).grid(row=10, column=0, sticky=tk.NW, padx=(8, 4), pady=3)
        self.notes_t = tk.Text(main, height=2, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                               bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY, insertbackground=DarkTheme.TEXT_PRIMARY)
        self.notes_t.grid(row=10, column=1, columnspan=3, sticky=tk.EW, padx=(0, 8), pady=3)
        if self.item.get("notes"):
            self.notes_t.insert("1.0", self.item["notes"])

        # 按钮
        btn = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        btn.grid(row=11, column=0, columnspan=4, sticky=tk.E, pady=(12, 0))
        save_btn = tk.Button(btn, text="保存", font=DarkTheme.FONT_BUTTON, fg="white",
                             bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                             command=self._save, padx=16, pady=8)
        save_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(save_btn, DarkTheme.ACCENT_BLUE)
        cancel_btn = tk.Button(btn, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                               bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                               command=self.win.destroy, padx=16, pady=8)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

    def _on_type_change(self, event=None):
        self._build_config_fields()
        try:
            if hasattr(self, 'model_e') and self.model_e:
                self.model_e._category = self.type_var.get()
        except Exception:
            pass

    def _build_config_fields(self):
        """根据设备类型动态构建配置字段"""
        for widget in self.config_frame.winfo_children():
            widget.destroy()
        self.config_entries = {}
        self.config_autocomplete = {}
        self.selected_hardware_model = None
        self._model_fields = {"cpu", "motherboard", "ram", "disk", "gpu", "psu", "case", "fan", "monitor_brand", "monitor_model", "screen_size", "resolution", "refresh_rate", "brand", "model"}

        dev_type = self.type_var.get()
        fields = self.TYPE_FIELDS.get(dev_type, [])
        
        # 字段类型到数据库分类的映射
        FIELD_CATEGORY_MAP = {
            "cpu": "cpu",
            "motherboard": "mb",
            "ram": "ram",
            "disk": "disk",
            "gpu": "gpu",
            "psu": "psu",
            "case": "case",
            "fan": "cooler",
            "monitor_brand": "monitor",
            "monitor_model": "monitor",
            "screen_size": "monitor",
            "resolution": "monitor",
            "refresh_rate": "monitor",
        }

        for row, (key, label) in enumerate(fields):
            col = row % 2
            r = row // 2
            default = self.item.get(key, "")
            category = FIELD_CATEGORY_MAP.get(key)
            ent = self._make_field(self.config_frame, label, default, col=col, row=r, category=category, field_key=key)
            self.config_entries[key] = ent

    def _on_hardware_model_selected(self, model_data, field_key):
        """选择硬件型号后的回调，自动联动常用字段并累加总成本。"""
        if field_key not in self._model_fields:
            return

        def _set_entry(key, value):
            ent = self.config_entries.get(key)
            if not ent or value in (None, ""):
                return
            try:
                ent.delete(0, tk.END)
                ent.insert(0, str(value))
            except Exception:
                pass

        if model_data:
            self._selected_models[field_key] = model_data
            self.config_entries.setdefault("model_id", tk.StringVar())
            self.config_entries["model_id"].set(str(model_data.get("id", "")))

            brand = model_data.get("brand", "")
            model_name = model_data.get("model_name", "")
            spec_text = f"{brand} {model_name}".strip()
            if field_key == "cpu" and hasattr(self, "model_e"):
                self.model_e.set_value(spec_text)

            # 将型号库中的关键信息同步到对应表单字段，减少重复录入
            if field_key in {"cpu", "motherboard", "ram", "disk", "gpu", "psu", "case", "fan", "brand", "model", "brand_model", "monitor_brand", "monitor_model", "device_name"}:
                if field_key in self.config_entries:
                    _set_entry(field_key, spec_text or model_name or brand)

            specs = model_data.get("specs") or {}
            if isinstance(specs, str):
                try:
                    specs = json.loads(specs)
                except Exception:
                    specs = {}
            if isinstance(specs, dict):
                for key in ("cpu", "motherboard", "ram", "disk", "gpu", "psu", "case", "fan", "monitor_brand", "monitor_model", "screen_size", "resolution", "refresh_rate", "brand", "model"):
                    if key in specs and key in self.config_entries:
                        _set_entry(key, specs.get(key))

        elif field_key in self._selected_models:
            del self._selected_models[field_key]

        total_cost = sum(
            m.get('reference_cost', 0)
            for m in self._selected_models.values()
            if m and m.get('reference_cost') is not None
        )
        self.unit_cost_e.config(state="normal")
        self.unit_cost_e.delete(0, tk.END)
        if total_cost > 0:
            self.unit_cost_e.insert(0, f"{total_cost:.0f}")
        self.unit_cost_e.config(state="readonly")

        if self._selected_models:
            details = []
            for key, model in self._selected_models.items():
                if model:
                    label = self._get_field_label(key)
                    cost = model.get('reference_cost', 0)
                    details.append(f"{label}:¥{cost:.0f}")
            self.cost_detail_label.config(text="成本构成: " + " | ".join(details))
        else:
            self.cost_detail_label.config(text="")

        total_rent = sum(
            m.get('reference_rent', 0)
            for m in self._selected_models.values()
            if m and m.get('reference_rent') is not None
        )
        if total_rent > 0:
            self.unit_rent_e.delete(0, tk.END)
            self.unit_rent_e.insert(0, f"{total_rent:.2f}")

    def _get_field_label(self, field_key):
        """获取字段的中文标签"""
        labels = {
            'cpu': 'CPU',
            'motherboard': '主板',
            'mb': '主板',
            'ram': '内存',
            'disk': '硬盘',
            'gpu': '显卡',
            'psu': '电源',
            'case': '机箱',
            'fan': '风扇',
            'cooler': '风扇',
            'monitor': '显示器',
            'monitor_brand': '显示器品牌',
            'monitor_model': '显示器型号',
            'screen_size': '屏幕尺寸',
            'resolution': '分辨率',
            'refresh_rate': '刷新率',
            'brand': '品牌',
            'model': '型号',
        }
        return labels.get(field_key, field_key)

    def _save(self):
        try:
            qty = float(self.qty_e.get().strip() or 0)
            if qty <= 0:
                messagebox.showwarning("提示", "数量必须大于0")
                return
            unit_rent_text = self.unit_rent_e.get().strip()
            unit_rent = float(unit_rent_text) if unit_rent_text else None
            unit_cost_text = self.unit_cost_e.get().strip()
            unit_cost = float(unit_cost_text) if unit_cost_text else None

            # 收集动态配置字段
            config_data = {}
            for key, ent in self.config_entries.items():
                # 区分自动补全控件和普通控件
                if hasattr(ent, 'get_value'):
                    val = ent.get_value()
                else:
                    val = ent.get().strip()
                if val:
                    config_data[key] = val

            result = {
                "device_type": self.type_var.get(),
                "quantity": qty,
                "unit_cost": unit_cost,
                "unit_rent": unit_rent,
                "model": self.model_e.get().strip(),
            }
            selected_cpu = self._selected_models.get("cpu")
            if selected_cpu and selected_cpu.get("id"):
                result["model_id"] = int(selected_cpu.get("id"))
            result.update(config_data)
            result = {k: v for k, v in result.items() if v != "" and v is not None}

            acc = self.accessories_t.get("1.0", tk.END).strip()
            if acc:
                result["accessories"] = acc
            est_value = self.estimated_value_e.get().strip()
            if est_value:
                try:
                    result["estimated_value"] = float(est_value)
                except ValueError:
                    pass
            notes = self.notes_t.get("1.0", tk.END).strip()
            if notes:
                result["notes"] = notes

            self.result = result
            self.win.destroy()
        except ValueError:
            messagebox.showerror("错误", "数量和金额必须是数字")

    def show(self):
        self.win.wait_window()
        return self.result


def format_hardware_display(hardware):
    if not hardware:
        return "未添加硬件信息"
    items = hardware.get("items") if isinstance(hardware, dict) else None
    if not items:
        items = [hardware] if isinstance(hardware, dict) else []
    if not items:
        return "未添加硬件信息"
    lines = []
    for idx, item in enumerate(items, 1):
        parts = []
        for key, label in [
            ("model", "型号"),
            ("cpu", "CPU"),
            ("motherboard", "主板"),
            ("ram", "内存"),
            ("disk", "硬盘"),
            ("gpu", "显卡"),
            ("case", "机箱"),
            ("psu", "电源"),
            ("fan", "风扇"),
            ("monitor", "显示器"),
            ("laptop", "笔记本"),
        ]:
            if item.get(key):
                parts.append(f"{label}:{item[key]}")
        if item.get("unit_cost"):
            parts.append(f"成本:¥{item['unit_cost']}")
        if item.get("estimated_value"):
            parts.append(f"估值:¥{item['estimated_value']}")
        if item.get("accessories"):
            parts.append(f"配件:{item['accessories']}")
        if item.get("notes"):
            parts.append(f"备注:{item['notes']}")
        qty = item.get("quantity", 1)
        rent = item.get("unit_rent", "")
        rent_text = f"，单台月租¥{rent}" if rent != "" else ""
        detail = " / ".join(parts) if parts else "未填写配置"
        lines.append(f"{idx}. {item.get('device_type', '设备')} × {qty:g}{rent_text}：{detail}")
    return "\n".join(lines)
