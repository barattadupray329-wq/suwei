#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动补全控件
基于 Tkinter Entry + Listbox 实现，支持从数据库查询硬件型号进行智能补全
"""

import tkinter as tk
from tkinter import ttk
import json
from theme.colors import DarkTheme


class AutocompleteEntry(ttk.Entry):
    """支持数据库查询的自动补全输入框"""

    def __init__(self, parent, data_manager, category=None, width=None, **kwargs):
        self._data_manager = data_manager
        self._category = category
        self._var = tk.StringVar()
        self._listbox = None
        self._popup = None
        self._on_select_callback = kwargs.pop('on_select', None)
        
        super().__init__(parent, textvariable=self._var, width=width or 30, **kwargs)
        
        self._trace_id = self._var.trace_add("write", self._on_entry_change)
        self.bind("<FocusIn>", self._on_focus_in)
        self.bind("<FocusOut>", self._on_focus_out)
        self.bind("<Double-1>", self._on_double_click)
        self.bind("<Down>", self._on_key_down)
        self.bind("<Up>", self._on_key_up)
        self.bind("<Return>", self._on_key_select)
        self.bind("<Escape>", self._on_key_escape)
        
        self._selected_index = -1
        self._current_results = []
        self._popup_hovering = False  # 鼠标是否在弹出窗口内
        self._typing_timer = None  # 打字延迟计时器
        self._user_typed = False  # 标记用户是否手动输入过

    def _on_entry_change(self, *args):
        """输入变化时查询并显示候选项"""
        # 取消之前的计时器
        if self._typing_timer:
            self.after_cancel(self._typing_timer)
        
        self._user_typed = True
        # 设置延迟查询（300ms），给用户留出打字时间
        self._typing_timer = self.after(300, self._delayed_query)
    
    def _is_user_input(self, text):
        """判断是否为真实用户输入而非程序填充"""
        # 如果文本格式为 "品牌 型号" 且与某个结果完全一致，则可能是程序填充
        for item in self._current_results:
            display = f"{item['brand']} {item['model_name']}"
            if text == display:
                return False
        return True
    
    def _delayed_query(self):
        """延迟查询，避免每次击键都触发数据库查询"""
        self._typing_timer = None
        query = self._var.get().strip()
        if len(query) < 1:  # 允许单字符就开始查询，便于快速选现有型号
            self._hide_popup()
            return
        
        # 查询数据库
        self._current_results = self._data_manager.search_models(
            query, self._category, limit=20
        )
        
        if len(self._current_results) == 0:
            self._hide_popup()
        elif len(self._current_results) == 1 and not self._user_typed:
            # 只有一个匹配项且用户没有手动输入过时自动填充
            self._hide_popup()
            self._select_single_item(self._current_results[0])
        else:
            # 多个匹配项或用户手动输入时显示弹窗
            self._show_popup()
            self._selected_index = -1

    def _select_single_item(self, item):
        """选中唯一匹配项并填充价格"""
        display_text = f"{item['brand']} {item['model_name']}"
        # 临时移除 trace 防止递归调用
        self._var.trace_remove("write", self._trace_id)
        self._var.set(display_text)
        self._trace_id = self._var.trace_add("write", self._on_entry_change)
        
        if self._on_select_callback:
            self._on_select_callback(item)

    def _on_focus_in(self, event=None):
        """获得焦点时直接展开候选列表"""
        query = self._var.get().strip()
        self._current_results = self._data_manager.search_models(query, self._category, limit=20)
        if self._current_results:
            self._user_typed = True
            self._show_popup()
            self._selected_index = -1
        return None

    def _on_double_click(self, event=None):
        """双击直接展开候选列表"""
        query = self._var.get().strip()
        self._current_results = self._data_manager.search_models(query, self._category, limit=20)
        if self._current_results:
            self._user_typed = True
            self._show_popup()
            self._selected_index = -1
        return "break"

    def _show_popup(self):
        """显示候选列表"""
        if self._popup and self._popup.winfo_exists():
            self._update_popup_content()
            return
        
        # 创建弹出窗口，默认贴在输入框下方；若空间不足则向上弹出
        x = self.winfo_rootx()
        y = self.winfo_rooty() + self.winfo_height() + 2
        w = max(self.winfo_width(), 320)
        screen_h = self.winfo_screenheight()
        h = min(220, max(140, len(self._current_results) * 24 + 12))
        if y + h > screen_h:
            y = max(4, self.winfo_rooty() - h - 2)
        
        self._popup = tk.Toplevel(self)
        self._popup.wm_overrideredirect(True)
        self._popup.geometry(f"{w}x{h}+{x}+{y}")
        self._popup.configure(bg=DarkTheme.BG_PRIMARY)
        self._popup.withdraw()
        
        # 创建 Listbox
        self._listbox = tk.Listbox(
            self._popup, 
            bg=DarkTheme.BG_INPUT,
            fg=DarkTheme.TEXT_PRIMARY,
            font=DarkTheme.FONT_NORMAL,
            selectbackground=DarkTheme.ACCENT_BLUE,
            selectforeground="white",
            borderwidth=1,
            relief=tk.SOLID,
            highlightthickness=0,
        )
        self._listbox.pack(fill=tk.BOTH, expand=True)
        self._listbox.bind("<Button-1>", self._on_listbox_select)
        self._listbox.bind("<Motion>", self._on_listbox_hover)
        self._listbox.bind("<Leave>", self._on_listbox_leave)
        self._popup.bind("<Enter>", self._on_popup_enter)
        self._popup.bind("<Leave>", self._on_popup_leave)
        
        self._update_popup_content()
        self._popup.deiconify()
        self._popup.lift()

    def _update_popup_content(self):
        """更新弹出窗口内容"""
        if not self._listbox:
            return
            
        self._listbox.delete(0, tk.END)
        for item in self._current_results:
            display = f"{item['brand']} {item['model_name']}"
            specs = item.get('specs')
            if specs:
                if isinstance(specs, str):
                    try:
                        specs = json.loads(specs)
                    except:
                        specs = {}
                if isinstance(specs, dict) and specs:
                    spec_parts = []
                    for key in ('capacity', 'socket', 'cores', 'type', 'screen_size', 'resolution', 'refresh_rate'):
                        if key in specs and specs[key] not in (None, ""):
                            val = specs[key]
                            if key == 'cores':
                                spec_parts.append(f"{val}核")
                            else:
                                spec_parts.append(str(val))
                    if spec_parts:
                        display += f" ({', '.join(spec_parts)})"
            if item.get('reference_cost') is not None:
                display += f" ¥{item['reference_cost']}"
            self._listbox.insert(tk.END, display)

    def _hide_popup(self):
        """隐藏弹出窗口"""
        self._popup_hovering = False
        if self._popup and self._popup.winfo_exists():
            self._popup.destroy()
            self._popup = None
            self._listbox = None
            self._selected_index = -1

    def _on_popup_enter(self, event=None):
        """鼠标进入弹出窗口"""
        self._popup_hovering = True

    def _on_popup_leave(self, event=None):
        """鼠标离开弹出窗口"""
        self._popup_hovering = False

    def _on_listbox_leave(self, event=None):
        """鼠标离开列表"""
        self._popup_hovering = False

    def _on_focus_out(self, event):
        """失去焦点时隐藏，但如果鼠标还在弹出窗口内则不隐藏"""
        def check_hide():
            if not self._popup_hovering:
                self._hide_popup()
        self.after(100, check_hide)

    def _on_key_down(self, event):
        """下箭头选择下一项"""
        if not self._popup or not self._popup.winfo_exists():
            return
        self._selected_index = min(
            self._selected_index + 1, 
            self._listbox.size() - 1
        )
        self._listbox.selection_clear(0, tk.END)
        self._listbox.selection_set(self._selected_index)
        self._listbox.see(self._selected_index)
        return "break"

    def _on_key_up(self, event):
        """上箭头选择上一项"""
        if not self._popup or not self._popup.winfo_exists():
            return
        self._selected_index = max(self._selected_index - 1, 0)
        self._listbox.selection_clear(0, tk.END)
        self._listbox.selection_set(self._selected_index)
        self._listbox.see(self._selected_index)
        return "break"

    def _on_key_select(self, event):
        """回车选择当前项"""
        if not self._popup or not self._popup.winfo_exists():
            return
        if 0 <= self._selected_index < len(self._current_results):
            self._select_item(self._selected_index)
            return "break"

    def _on_key_escape(self, event):
        """Esc 隐藏"""
        self._hide_popup()
        return "break"

    def _on_listbox_select(self, event):
        """点击选择"""
        sel = self._listbox.curselection()
        if sel:
            self._select_item(sel[0])

    def _on_listbox_hover(self, event):
        """鼠标悬停高亮"""
        idx = self._listbox.nearest(event.y)
        if 0 <= idx < self._listbox.size():
            self._selected_index = idx
            self._listbox.selection_clear(0, tk.END)
            self._listbox.selection_set(idx)

    def _select_item(self, index):
        """选择候选项"""
        if 0 <= index < len(self._current_results):
            item = self._current_results[index]
            display_text = f"{item['brand']} {item['model_name']}"
            self._var.set(display_text)
            self._hide_popup()
            
            if self._on_select_callback:
                self._on_select_callback(item)

    def get_value(self):
        """获取当前输入值"""
        return self._var.get().strip()

    def set_value(self, value):
        """设置输入值"""
        self._var.set(value)

    def destroy(self):
        """清理资源"""
        self._hide_popup()
        super().destroy()
