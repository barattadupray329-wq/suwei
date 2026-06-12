#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬件品牌库管理页面
支持按分类查看、添加、删除、搜索、导入导出品牌条目
"""

import csv
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
from theme.colors import DarkTheme
from modules.hardware_brands import HardwareBrandManager


class HardwareBrandFrame(ttk.Frame):
    """硬件品牌库管理页面"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)
        self.dm = data_manager
        self.manager = HardwareBrandManager(data_manager)
        self.current_category = None
        self.configure(style="Main.TFrame")
        self._build()

    # ── 界面构建 ─────────────────────────────────────────────────────

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)

        # 标题行
        head = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        head.pack(fill=tk.X, pady=(0, 14))
        tk.Label(head, text="💻 硬件品牌库", font=DarkTheme.FONT_TITLE,
                 fg=DarkTheme.ACCENT_PRIMARY, bg=DarkTheme.BG_PRIMARY).pack(side=tk.LEFT)

        # 分类选项卡区域
        cat_frame = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        cat_frame.pack(fill=tk.X, pady=(0, 10))
        self._build_category_tabs(cat_frame)

        # 主体：左右分栏
        body = tk.Frame(main, bg=DarkTheme.BG_PRIMARY)
        body.pack(fill=tk.BOTH, expand=True)

        # 左侧：品牌列表
        left = tk.Frame(body, bg=DarkTheme.BG_CARD,
                        highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self._build_search_bar(left)
        self._build_table(left)

        # 右侧：操作面板
        right = tk.Frame(body, bg=DarkTheme.BG_PRIMARY, width=200)
        right.pack(side=tk.RIGHT, fill=tk.Y, padx=(10, 0))
        right.pack_propagate(False)
        self._build_action_panel(right)

        # 默认选中第一个分类
        cats = self.manager.get_categories()
        if cats:
            self._switch_category(cats[0][0])

    def _build_category_tabs(self, parent):
        """分类标签栏"""
        self.cat_buttons = {}
        cats = self.manager.get_categories()
        # 单行内平铺，包不下的换到下一行
        row_frame = None
        col = 0
        for key, label, _ in cats:
            if col % 4 == 0:
                row_frame = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
                row_frame.pack(fill=tk.X, pady=2)
            btn = tk.Button(row_frame, text=label, font=DarkTheme.FONT_SMALL,
                            fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_TERTIARY,
                            relief=tk.FLAT, cursor="hand2", padx=12, pady=6,
                            command=lambda k=key: self._switch_category(k))
            btn.pack(side=tk.LEFT, padx=2)
            DarkTheme.bind_hover(btn, DarkTheme.BG_TERTIARY, DarkTheme.ACCENT_BLUE)
            self.cat_buttons[key] = btn
            col += 1

    def _build_search_bar(self, parent):
        """搜索栏"""
        bar = tk.Frame(parent, bg=DarkTheme.BG_CARD)
        bar.pack(fill=tk.X, padx=10, pady=(10, 6))

        tk.Label(bar, text="🔍", font=DarkTheme.FONT_NORMAL,
                 fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_CARD).pack(side=tk.LEFT, padx=(0, 4))

        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._do_search())
        search_entry = ttk.Entry(bar, textvariable=self.search_var, width=36,
                                 font=DarkTheme.FONT_NORMAL)
        search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)

        clear_btn = tk.Button(bar, text="✕", font=DarkTheme.FONT_SMALL,
                              fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_CARD,
                              relief=tk.FLAT, cursor="hand2",
                              command=lambda: self.search_var.set(""))
        clear_btn.pack(side=tk.RIGHT, padx=4)

        self.count_label = tk.Label(bar, text="", font=DarkTheme.FONT_SMALL,
                                    fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_CARD)
        self.count_label.pack(side=tk.RIGHT, padx=8)

    def _build_table(self, parent):
        """品牌列表表格"""
        cols = ("#", "品牌名称")
        self.tree = ttk.Treeview(parent, columns=cols, show="headings", height=16)
        self.tree.heading("#", text="#")
        self.tree.heading("品牌名称", text="品牌名称")
        self.tree.column("#", width=50, anchor="center")
        self.tree.column("品牌名称", width=280, anchor="w")

        vbar = ttk.Scrollbar(parent, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))
        vbar.pack(side=tk.RIGHT, fill=tk.Y, pady=(0, 10))

        # 右键菜单
        self.context_menu = tk.Menu(self.tree, tearoff=0, bg=DarkTheme.BG_SECONDARY,
                                    fg=DarkTheme.TEXT_PRIMARY,
                                    activebackground=DarkTheme.ACCENT_BLUE,
                                    activeforeground="white")
        self.context_menu.add_command(label="🗑 删除选中", command=self._delete_selected)
        self.context_menu.add_command(label="✏️ 编辑名称", command=self._rename_selected)
        self.tree.bind("<Button-3>", self._show_context_menu)

        # 双击编辑
        self.tree.bind("<Double-1>", lambda e: self._rename_selected())

        # 键盘删除
        self.tree.bind("<Delete>", lambda e: self._delete_selected())

    def _build_action_panel(self, parent):
        """右侧操作按钮面板"""
        # 统计卡片
        card = tk.Frame(parent, bg=DarkTheme.BG_CARD,
                        highlightbackground=DarkTheme.BORDER_COLOR, highlightthickness=1)
        card.pack(fill=tk.X, pady=(0, 10))
        tk.Label(card, text="📊 统计", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_CARD).pack(pady=(8, 2))
        self.stat_total = tk.Label(card, text="0", font=DarkTheme.FONT_CARD_VALUE,
                                   fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_CARD)
        self.stat_total.pack(pady=(0, 8))

        # 操作按钮
        btn_opts = [
            ("➕ 添加品牌", self._add_brand, DarkTheme.ACCENT_PRIMARY),
            ("🗑 删除选中", self._delete_selected, DarkTheme.ACCENT_RED),
            ("📥 从文本导入", self._import_from_text, DarkTheme.ACCENT_GREEN),
            ("📄 从 CSV 导入", self._import_csv, DarkTheme.ACCENT_GREEN),
            ("📤 导出 CSV", self._export_csv, DarkTheme.ACCENT_PURPLE),
            ("🔄 恢复默认", self._reset_defaults, DarkTheme.BG_HOVER),
        ]
        for text, cmd, color in btn_opts:
            btn = tk.Button(parent, text=text, font=DarkTheme.FONT_BUTTON, fg="white",
                            bg=color, relief=tk.FLAT, cursor="hand2",
                            command=cmd, padx=10, pady=8)
            btn.pack(fill=tk.X, pady=2)
            DarkTheme.bind_hover(btn, color)

    # ── 分类切换 ─────────────────────────────────────────────────────

    def _switch_category(self, category_key):
        self.current_category = category_key
        # 高亮当前分类按钮
        for key, btn in self.cat_buttons.items():
            if key == category_key:
                btn.config(bg=DarkTheme.ACCENT_PRIMARY, fg="white")
            else:
                btn.config(bg=DarkTheme.BG_TERTIARY, fg=DarkTheme.TEXT_SECONDARY)
        self._load_brands()

    # ── 品牌数据加载 ─────────────────────────────────────────────────

    def _load_brands(self):
        brands = self.manager.get_brands(self.current_category)
        self._refresh_table(brands)

    def _refresh_table(self, brands):
        self.tree.delete(*self.tree.get_children())
        for i, name in enumerate(brands, 1):
            self.tree.insert("", tk.END, iid=str(i), values=(i, name))
        self.stat_total.config(text=str(len(brands)))

    def _do_search(self):
        query = self.search_var.get().strip().lower()
        brands = self.manager.get_brands(self.current_category)
        if query:
            brands = [b for b in brands if query in b.lower()]
        self._refresh_table(brands)

    # ── 增删改 ───────────────────────────────────────────────────────

    def _add_brand(self):
        name = simpledialog.askstring("添加品牌", "请输入新品牌名称：", parent=self)
        if not name or not name.strip():
            return
        if self.manager.add_brand(self.current_category, name.strip()):
            self._load_brands()
            self.count_label.config(text=f"✅ 已添加「{name.strip()}」")
        else:
            messagebox.showwarning("重复", f"品牌「{name.strip()}」已存在")

    def _delete_selected(self):
        selected = self.tree.selection()
        if not selected:
            messagebox.showinfo("提示", "请先选中要删除的行")
            return
        names = [self.tree.item(iid, "values")[1] for iid in selected]
        if not messagebox.askyesno("确认删除",
                                   f"确定删除以下 {len(names)} 个品牌吗？\n\n" +
                                   "\n".join(f"  · {n}" for n in names)):
            return
        deleted = 0
        for name in names:
            if self.manager.delete_brand(self.current_category, name):
                deleted += 1
        self._load_brands()
        self.count_label.config(text=f"✅ 已删除 {deleted} 个品牌")

    def _rename_selected(self):
        selected = self.tree.selection()
        if not selected:
            return
        iid = selected[0]
        old_name = self.tree.item(iid, "values")[1]
        new_name = simpledialog.askstring("编辑品牌", "修改品牌名称：",
                                          initialvalue=old_name, parent=self)
        if not new_name or not new_name.strip() or new_name.strip() == old_name:
            return
        new_name = new_name.strip()
        # 原子操作：先加新的再删旧的
        if self.manager.add_brand(self.current_category, new_name):
            self.manager.delete_brand(self.current_category, old_name)
            self._load_brands()
            self.count_label.config(text=f"✅ 已重命名「{old_name}」→「{new_name}」")

    # ── 右键菜单 ─────────────────────────────────────────────────────

    def _show_context_menu(self, event):
        iid = self.tree.identify_row(event.y)
        if iid:
            self.tree.selection_set(iid)
            self.context_menu.post(event.x_root, event.y_root)

    # ── 导入导出 ─────────────────────────────────────────────────────

    def _import_from_text(self):
        """从多行文本导入品牌（一行一个）"""
        text = simpledialog.askstring(
            "从文本导入", "请输入品牌名称（每行一个）：\n\n例如：\n技嘉 B850M\n华硕 X870\n微星 MAG",
            parent=self)
        if not text or not text.strip():
            return
        names = [line.strip() for line in text.strip().split("\n") if line.strip()]
        added = self.manager.import_brands(self.current_category, names)
        self._load_brands()
        self.count_label.config(text=f"✅ 导入成功，新增 {added} 个品牌" +
                                (f"，{len(names) - added} 个已跳过" if added < len(names) else ""))

    def _import_csv(self):
        fp = filedialog.askopenfilename(
            title="从 CSV 导入品牌",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")])
        if not fp:
            return
        try:
            with open(fp, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                next(reader, None)  # 跳过表头
                names = [row[0].strip() for row in reader if row and row[0].strip()]
        except Exception as e:
            messagebox.showerror("错误", f"读取 CSV 失败：{e}")
            return
        if not names:
            messagebox.showinfo("提示", "CSV 文件中无有效数据")
            return
        added = self.manager.import_brands(self.current_category, names)
        self._load_brands()
        self.count_label.config(text=f"✅ 从 CSV 导入 {added} 个品牌")

    def _export_csv(self):
        brands = self.manager.get_brands(self.current_category)
        if not brands:
            messagebox.showinfo("提示", "当前分类无品牌可导出")
            return
        fp = filedialog.asksaveasfilename(
            title="导出品牌 CSV",
            defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv")],
            initialfile=f"品牌库_{self.current_category}.csv")
        if not fp:
            return
        try:
            with open(fp, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["品牌名称"])
                for name in brands:
                    writer.writerow([name])
            messagebox.showinfo("成功", f"已导出 {len(brands)} 个品牌\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败：{e}")

    def _reset_defaults(self):
        if not messagebox.askyesno("确认", "将用默认品牌库替换当前分类的所有品牌，确定吗？"):
            return
        self.dm._init_brand_defaults(force=True)
        self._load_brands()
        self.count_label.config(text="✅ 已恢复默认品牌库")
