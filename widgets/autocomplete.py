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
        
        self._var.trace_add("write", self._on_entry_change)
        self.bind("<FocusOut>", self._on_focus_out)
        self.bind("<Down>", self._on_key_down)
        self.bind("<Up>", self._on_key_up)
        self.bind("<Return>", self._on_key_select)
        self.bind("<Escape>", self._on_key_escape)
        
        self._selected_index = -1
        self._current_results = []

    def _on_entry_change(self, *args):
        """输入变化时查询并显示候选项"""
        query = self._var.get().strip()
        if len(query) < 1:
            self._hide_popup()
            return
        
        # 查询数据库
        self._current_results = self._data_manager.search_models(
            query, self._category, limit=20
        )
        
        if self._current_results:
            self._show_popup()
            self._selected_index = -1
        else:
            self._hide_popup()

    def _show_popup(self):
        """显示候选列表"""
        if self._popup and self._popup.winfo_exists():
            self._update_popup_content()
            return
        
        # 创建弹出窗口
        x = self.winfo_rootx()
        y = self.winfo_rooty() + self.winfo_height()
        w = self.winfo_width() or 300
        
        self._popup = tk.Toplevel(self)
        self._popup.wm_overrideredirect(True)
        self._popup.geometry(f"{w}x180+{x}+{y}")
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
        
        self._update_popup_content()
        self._popup.deiconify()
        self._popup.lift()
        self._popup.focus_set()

    def _update_popup_content(self):
        """更新弹出窗口内容"""
        if not self._listbox:
            return
            
        self._listbox.delete(0, tk.END)
        for item in self._current_results:
            display = f"{item['brand']} {item['model_name']}"
            if item.get('specs'):
                specs = item['specs']
                if isinstance(specs, str):
                    try:
                        specs = json.loads(specs)
                    except:
                        specs = {}
                
                spec_parts = []
                if 'capacity' in specs:
                    spec_parts.append(str(specs['capacity']))
                if 'socket' in specs:
                    spec_parts.append(str(specs['socket']))
                if 'cores' in specs:
                    spec_parts.append(f"{specs['cores']}核")
                if 'type' in specs and specs['type'] in ('风冷', '水冷'):
                    spec_parts.append(str(specs['type']))
                    
                if spec_parts:
                    display += f" ({', '.join(spec_parts)})"
            
            if item.get('reference_cost'):
                display += f" ¥{item['reference_cost']}"
                
            self._listbox.insert(tk.END, display)

    def _hide_popup(self):
        """隐藏弹出窗口"""
        if self._popup and self._popup.winfo_exists():
            self._popup.destroy()
            self._popup = None
            self._listbox = None
            self._selected_index = -1

    def _on_focus_out(self, event):
        """失去焦点时隐藏"""
        self.after(100, self._hide_popup)

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
