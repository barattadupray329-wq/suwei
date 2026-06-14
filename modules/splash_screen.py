"""
应用启动屏幕 - 显示坚果云同步进度
"""

import tkinter as tk
from tkinter import ttk
import threading
import logging

logger = logging.getLogger(__name__)


class SplashScreen:
    """启动屏幕"""
    
    def __init__(self, root: tk.Tk, title: str = "速维租赁管理系统", version: str = "v2.0"):
        """
        初始化启动屏幕
        
        Args:
            root: Tkinter 主窗口
            title: 应用标题
            version: 应用版本
        """
        self.root = root
        self.title = title
        self.version = version
        self.window = None
        self.progress_var = None
        self.status_label = None
        self.progress_bar = None
        self.is_closed = False
        
    def show(self):
        """显示启动屏幕"""
        # 创建启动屏幕窗口
        self.window = tk.Toplevel(self.root)
        self.window.title("启动")
        self.window.geometry("400x200")
        
        # 禁用关闭按钮
        self.window.protocol("WM_DELETE_WINDOW", lambda: None)
        
        # 居中显示
        self.window.update_idletasks()
        x = self.window.winfo_screenwidth() // 2 - 200
        y = self.window.winfo_screenheight() // 2 - 100
        self.window.geometry(f"400x200+{x}+{y}")
        
        # 标题
        title_label = tk.Label(
            self.window,
            text=self.title,
            font=("Arial", 16, "bold")
        )
        title_label.pack(pady=20)
        
        # 版本
        version_label = tk.Label(
            self.window,
            text=self.version,
            font=("Arial", 10),
            fg="gray"
        )
        version_label.pack()
        
        # 状态标签
        self.status_label = tk.Label(
            self.window,
            text="正在启动...",
            font=("Arial", 10)
        )
        self.status_label.pack(pady=10)
        
        # 进度条
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(
            self.window,
            variable=self.progress_var,
            maximum=100,
            mode="determinate",
            length=300
        )
        self.progress_bar.pack(pady=10, padx=50)
        
        # 进度百分比
        self.percent_label = tk.Label(
            self.window,
            text="0%",
            font=("Arial", 9),
            fg="gray"
        )
        self.percent_label.pack()
        
        self.window.lift()
        self.window.attributes("-topmost", True)
        self.window.update()
    
    def update_progress(self, status: str, progress: int, message: str):
        """
        更新进度
        
        Args:
            status: 状态 (starting, syncing, completed, error)
            progress: 进度 (0-100)
            message: 状态消息
        """
        if not self.window or self.is_closed:
            return
        
        try:
            self.progress_var.set(progress)
            self.status_label.config(text=message)
            self.percent_label.config(text=f"{int(progress)}%")
            
            # 错误状态改变颜色
            if status == "error":
                self.status_label.config(fg="red")
            elif status == "completed":
                self.status_label.config(fg="green")
            else:
                self.status_label.config(fg="black")
            
            self.window.update()
        except Exception as e:
            logger.error(f"Error updating splash screen: {e}")
    
    def close(self):
        """关闭启动屏幕"""
        self.is_closed = True
        if self.window:
            try:
                self.window.destroy()
            except:
                pass
    
    def show_error(self, error_message: str):
        """显示错误消息"""
        if not self.window or self.is_closed:
            return
        
        try:
            self.status_label.config(text=error_message, fg="red")
            self.window.update()
        except Exception as e:
            logger.error(f"Error showing error on splash screen: {e}")


def show_splash_with_sync(root: tk.Tk, sync_manager) -> bool:
    """
    显示启动屏幕并等待同步完成
    
    Args:
        root: Tkinter 主窗口
        sync_manager: NutstoreSyncManager 实例
    
    Returns:
        是否同步成功
    """
    splash = SplashScreen(root)
    splash.show()
    
    # 在线程中等待同步
    result = [None]
    
    def wait_sync():
        try:
            result[0] = sync_manager.wait_for_sync(
                timeout=120,
                callback=splash.update_progress
            )
        except Exception as e:
            logger.error(f"Error during sync: {e}")
            splash.show_error(f"同步失败: {str(e)}")
            result[0] = False
        finally:
            # 延迟关闭，让用户看到完成信息
            import time
            time.sleep(1)
            splash.close()
    
    sync_thread = threading.Thread(target=wait_sync, daemon=True)
    sync_thread.start()
    
    # 等待同步完成
    while not splash.is_closed and sync_thread.is_alive():
        root.update()
        import time
        time.sleep(0.1)
    
    return result[0] if result[0] is not None else False
