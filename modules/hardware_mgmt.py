#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬件管理模块
管理电脑租赁记录的硬件信息（品牌、型号、配置等）
"""

import tkinter as tk
from tkinter import ttk, messagebox
from theme.colors import DarkTheme
from modules.hardware_brands import CPU_BRANDS, GPU_BRANDS, RAM_BRANDS, DISK_BRANDS, OS_OPTIONS


class HardwareDialog:
    """硬件信息编辑对话框"""

    def __init__(self, parent, hardware_data=None):
        """
        初始化硬件编辑对话框
        
        Args:
            parent: 父窗口
            hardware_data: 现有硬件数据字典，如果为 None 则创建新数据
        """
        self.hardware = hardware_data or {}
        self.result = None
        self.win = None
        self._create_window(parent)

    def _create_window(self, parent):
        """创建对话框窗口"""
        self.win = tk.Toplevel(parent)
        self.win.title("硬件信息管理")
        self.win.geometry("600x700")
        self.win.transient(parent)
        self.win.grab_set()
        self.win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center_window()
        self._build_ui()

    def _center_window(self):
        """窗口居中"""
        self.win.update_idletasks()
        w, h = 600, 700
        x = (self.win.winfo_screenwidth() // 2) - (w // 2)
        y = (self.win.winfo_screenheight() // 2) - (h // 2)
        self.win.geometry(f"{w}x{h}+{x}+{y}")

    def _build_ui(self):
        """构建界面"""
        main = tk.Frame(self.win, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True, padx=16, pady=14)

        # 标题
        tk.Label(main, text="💻 硬件信息", font=DarkTheme.FONT_SUBTITLE,
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 12))

        # 可滚动框架
        canvas = tk.Canvas(main, bg=DarkTheme.BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(main, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=DarkTheme.BG_PRIMARY)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # 表单字段
        def make_row(parent, label, default="", width=30):
            """创建输入行"""
            row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=3)
            
            tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.W).pack(side=tk.LEFT)
            
            ent = ttk.Entry(row, width=width, font=DarkTheme.FONT_NORMAL)
            ent.pack(side=tk.LEFT, fill=tk.X, expand=True)
            
            if default is not None:
                ent.insert(0, str(default))
            
            return ent

        def make_text(parent, label, default="", height=3):
            """创建文本框"""
            row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.BOTH, pady=3)
            
            tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, anchor=tk.NW).pack(anchor=tk.W)
            
            txt = tk.Text(row, height=height, font=DarkTheme.FONT_NORMAL, wrap=tk.WORD,
                         bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY,
                         insertbackground=DarkTheme.TEXT_PRIMARY)
            txt.pack(fill=tk.BOTH, expand=True)
            
            if default:
                txt.insert("1.0", default)
            
            return txt

        # 基本信息
        tk.Label(scrollable_frame, text="基本信息", font=("微软雅黑", 10, "bold"),
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))
        
        self.brand_e = make_row(scrollable_frame, "品牌", self.hardware.get("brand", ""))
        self.model_e = make_row(scrollable_frame, "型号", self.hardware.get("model", ""))
        self.sn_e = make_row(scrollable_frame, "序列号", self.hardware.get("serial_number", ""))

        # 配置信息
        tk.Label(scrollable_frame, text="配置信息", font=("微软雅黑", 10, "bold"),
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(12, 8))
        
        def make_combo_row(parent, label, values_list, default="", width=28):
            """创建带下拉建议的输入行"""
            row = tk.Frame(parent, bg=DarkTheme.BG_PRIMARY)
            row.pack(fill=tk.X, pady=3)
            tk.Label(row, text=label, font=DarkTheme.FONT_LABEL, fg=DarkTheme.TEXT_SECONDARY,
                     bg=DarkTheme.BG_PRIMARY, width=12, anchor=tk.W).pack(side=tk.LEFT)
            combo = ttk.Combobox(row, values=values_list, width=width, font=DarkTheme.FONT_NORMAL)
            combo.pack(side=tk.LEFT, fill=tk.X, expand=True)
            if default:
                combo.insert(0, str(default))
            return combo

        self.cpu_e = make_combo_row(scrollable_frame, "CPU", CPU_BRANDS, self.hardware.get("cpu", ""))
        self.ram_e = make_combo_row(scrollable_frame, "内存", RAM_BRANDS, self.hardware.get("ram", ""))
        self.disk_e = make_combo_row(scrollable_frame, "硬盘", DISK_BRANDS, self.hardware.get("disk", ""))
        self.gpu_e = make_combo_row(scrollable_frame, "显卡", GPU_BRANDS, self.hardware.get("gpu", ""))
        self.os_e = make_combo_row(scrollable_frame, "系统版本", OS_OPTIONS, self.hardware.get("os", ""))

        # 额外信息
        tk.Label(scrollable_frame, text="额外信息", font=("微软雅黑", 10, "bold"),
                 fg=DarkTheme.ACCENT_BLUE, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(12, 8))
        
        self.accessories_t = make_text(scrollable_frame, "配件清单",
                                      self.hardware.get("accessories", ""), height=2)
        self.notes_t = make_text(scrollable_frame, "备注",
                                self.hardware.get("notes", ""), height=3)

        # 保存和取消按钮
        btn_frame = tk.Frame(self.win, bg=DarkTheme.BG_PRIMARY)
        btn_frame.pack(fill=tk.X, padx=16, pady=(0, 14))
        
        save_btn = tk.Button(btn_frame, text="💾 保存", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.ACCENT_BLUE, relief=tk.FLAT, cursor="hand2",
                  command=self._save, padx=14, pady=8)
        save_btn.pack(side=tk.LEFT, padx=(0, 8))
        DarkTheme.bind_hover(save_btn, DarkTheme.ACCENT_BLUE)
        
        cancel_btn = tk.Button(btn_frame, text="取消", font=DarkTheme.FONT_BUTTON, fg="white",
                  bg=DarkTheme.BG_HOVER, relief=tk.FLAT, cursor="hand2",
                  command=self._cancel, padx=14, pady=8)
        cancel_btn.pack(side=tk.LEFT)
        DarkTheme.bind_hover(cancel_btn, DarkTheme.BG_HOVER)

    def _save(self):
        """保存硬件信息"""
        try:
            self.result = {
                "brand": self.brand_e.get().strip() or "",
                "model": self.model_e.get().strip() or "",
                "serial_number": self.sn_e.get().strip() or "",
                "cpu": self.cpu_e.get().strip() or "",
                "ram": self.ram_e.get().strip() or "",
                "disk": self.disk_e.get().strip() or "",
                "gpu": self.gpu_e.get().strip() or "",
                "os": self.os_e.get().strip() or "",
                "accessories": self.accessories_t.get("1.0", tk.END).strip() or "",
                "notes": self.notes_t.get("1.0", tk.END).strip() or ""
            }
            # 清除空字段以保持数据整洁
            self.result = {k: v for k, v in self.result.items() if v}
            self.win.destroy()
        except Exception as e:
            messagebox.showerror("错误", f"保存失败：{e}")

    def _cancel(self):
        """取消编辑"""
        self.result = None
        self.win.destroy()

    def show(self):
        """显示对话框并返回结果"""
        self.win.wait_window()
        return self.result


def format_hardware_display(hardware):
    """
    格式化硬件信息用于显示
    
    Args:
        hardware: 硬件字典
    
    Returns:
        格式化的字符串
    """
    if not hardware:
        return "未添加硬件信息"
    
    lines = []
    
    # 基本信息
    if hardware.get("brand") or hardware.get("model"):
        lines.append(f"品牌型号：{hardware.get('brand', '')} {hardware.get('model', '')}".strip())
    
    if hardware.get("serial_number"):
        lines.append(f"序列号：{hardware['serial_number']}")
    
    # 配置信息
    config_parts = []
    if hardware.get("cpu"):
        config_parts.append(f"CPU: {hardware['cpu']}")
    if hardware.get("ram"):
        config_parts.append(f"内存: {hardware['ram']}GB")
    if hardware.get("disk"):
        config_parts.append(f"硬盘: {hardware['disk']}GB")
    if hardware.get("gpu"):
        config_parts.append(f"显卡: {hardware['gpu']}")
    
    if config_parts:
        lines.append("配置：" + ", ".join(config_parts))
    
    if hardware.get("os"):
        lines.append(f"系统：{hardware['os']}")
    
    # 额外信息
    if hardware.get("accessories"):
        lines.append(f"配件：{hardware['accessories']}")
    
    if hardware.get("notes"):
        lines.append(f"备注：{hardware['notes']}")
    
    return "\n".join(lines) if lines else "未添加硬件信息"
