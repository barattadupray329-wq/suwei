"""
更新通知对话框
- 显示更新提示
- 用户可以选择更新或忽略
- 显示更新详情
"""

import tkinter as tk
from tkinter import ttk, messagebox
from typing import Callable, Optional, Dict
from theme.colors import DarkTheme


class UpdateDialog:
    """更新通知对话框"""
    
    def __init__(self, parent: tk.Tk, update_info: Dict, on_update: Callable = None, on_dismiss: Callable = None):
        """
        初始化更新对话框
        
        Args:
            parent: 父窗口
            update_info: 更新信息字典
            on_update: 用户点击更新时的回调
            on_dismiss: 用户点击忽略时的回调
        """
        self.parent = parent
        self.update_info = update_info
        self.on_update = on_update
        self.on_dismiss = on_dismiss
        self.result = None
        
        self._create_dialog()
    
    def _create_dialog(self):
        """创建对话框"""
        self.window = tk.Toplevel(self.parent)
        self.window.title("发现新版本")
        self.window.geometry("500x400")
        self.window.resizable(False, False)
        
        # 禁用关闭按钮，必须选择一个选项
        self.window.protocol("WM_DELETE_WINDOW", lambda: None)
        
        # 居中显示
        self.window.update_idletasks()
        x = self.window.winfo_screenwidth() // 2 - 250
        y = self.window.winfo_screenheight() // 2 - 200
        self.window.geometry(f"500x400+{x}+{y}")
        
        # 设置背景颜色
        self.window.configure(bg=DarkTheme.BG_PRIMARY)
        
        # 标题
        title_label = tk.Label(
            self.window,
            text="🎉 发现新版本",
            font=("Arial", 16, "bold"),
            fg=DarkTheme.ACCENT_BLUE,
            bg=DarkTheme.BG_PRIMARY
        )
        title_label.pack(pady=15)
        
        # 版本信息
        info_frame = tk.Frame(self.window, bg=DarkTheme.BG_SECONDARY)
        info_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        # 版本号
        package_name = self.update_info.get('name', 'Unknown')
        version_label = tk.Label(
            info_frame,
            text=f"更新包: {package_name}",
            font=("Arial", 10),
            fg=DarkTheme.TEXT_PRIMARY,
            bg=DarkTheme.BG_SECONDARY
        )
        version_label.pack(anchor=tk.W, pady=5)
        
        # 更新原因
        reason = self.update_info.get('reason', 'code_update')
        reason_text = {
            'auto_detected': '自动检测到代码更新',
            'code_update': '代码已更新',
            'bug_fix': '错误修复',
            'feature': '新增功能',
        }.get(reason, reason)
        
        reason_label = tk.Label(
            info_frame,
            text=f"原因: {reason_text}",
            font=("Arial", 10),
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_SECONDARY
        )
        reason_label.pack(anchor=tk.W, pady=5)
        
        # 大小
        size_mb = self.update_info.get('size_mb', 0)
        size_label = tk.Label(
            info_frame,
            text=f"大小: {size_mb:.2f} MB",
            font=("Arial", 10),
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_SECONDARY
        )
        size_label.pack(anchor=tk.W, pady=5)
        
        # 时间
        timestamp = self.update_info.get('timestamp', 'Unknown')
        time_label = tk.Label(
            info_frame,
            text=f"时间: {timestamp}",
            font=("Arial", 9),
            fg=DarkTheme.TEXT_MUTED,
            bg=DarkTheme.BG_SECONDARY
        )
        time_label.pack(anchor=tk.W, pady=5)
        
        # 文件列表
        files = self.update_info.get('files', [])
        if files:
            files_text = f"包含: {', '.join(files)}"
            files_label = tk.Label(
                info_frame,
                text=files_text,
                font=("Arial", 9),
                fg=DarkTheme.TEXT_MUTED,
                bg=DarkTheme.BG_SECONDARY,
                wraplength=450,
                justify=tk.LEFT
            )
            files_label.pack(anchor=tk.W, pady=5)
        
        # 提示信息
        tips_label = tk.Label(
            self.window,
            text="请选择是否立即更新，更新过程中会自动重启应用",
            font=("Arial", 9),
            fg=DarkTheme.TEXT_SECONDARY,
            bg=DarkTheme.BG_PRIMARY
        )
        tips_label.pack(pady=10)
        
        # 按钮框
        button_frame = tk.Frame(self.window, bg=DarkTheme.BG_PRIMARY)
        button_frame.pack(fill=tk.X, padx=20, pady=20)
        
        # 立即更新按钮
        update_btn = tk.Button(
            button_frame,
            text="✓ 立即更新",
            font=("Arial", 11, "bold"),
            fg="white",
            bg=DarkTheme.ACCENT_GREEN,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._on_update,
            width=15,
            pady=8
        )
        update_btn.pack(side=tk.LEFT, padx=5)
        DarkTheme.bind_hover(update_btn, DarkTheme.ACCENT_GREEN)
        
        # 以后再说按钮
        dismiss_btn = tk.Button(
            button_frame,
            text="稍后再说",
            font=("Arial", 11),
            fg="white",
            bg=DarkTheme.ACCENT_GRAY,
            relief=tk.FLAT,
            cursor="hand2",
            command=self._on_dismiss,
            width=15,
            pady=8
        )
        dismiss_btn.pack(side=tk.LEFT, padx=5)
        DarkTheme.bind_hover(dismiss_btn, DarkTheme.ACCENT_GRAY)
        
        # 将对话框置于前面
        self.window.lift()
        self.window.attributes("-topmost", True)
        self.window.update()
    
    def _on_update(self):
        """用户选择更新"""
        self.result = True
        if self.on_update:
            self.on_update(self.update_info)
        self.window.destroy()
    
    def _on_dismiss(self):
        """用户选择忽略"""
        self.result = False
        if self.on_dismiss:
            self.on_dismiss(self.update_info)
        self.window.destroy()
    
    def show(self):
        """显示对话框"""
        self.window.wait_window()
        return self.result


def show_update_dialog(parent: tk.Tk, update_info: Dict, on_update: Callable = None, on_dismiss: Callable = None) -> bool:
    """
    显示更新通知对话框
    
    Args:
        parent: 父窗口
        update_info: 更新信息
        on_update: 更新回调
        on_dismiss: 忽略回调
    
    Returns:
        用户是否选择更新
    """
    dialog = UpdateDialog(parent, update_info, on_update, on_dismiss)
    return dialog.show()
