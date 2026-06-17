"""
应用启动屏幕 - 显示坚果云同步进度
"""

import tkinter as tk
from tkinter import ttk
import threading
import logging
import time

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
            
            if status == "error":
                self.status_label.config(fg="red")
            elif status == "completed":
                self.status_label.config(fg="green")
            else:
                self.status_label.config(fg="black")
            
            self.window.update()
        except Exception as e:
            # 忽略跨线程 UI 更新警告，不影响主流程
            pass
    
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


def show_splash_with_sync(root: tk.Tk, sync_manager, timeout: int = 30) -> bool:
    """
    显示启动屏幕并等待同步完成
    
    Args:
        root: Tkinter 主窗口
        sync_manager: NutstoreSyncManager 实例
        timeout: 同步超时时间（秒），默认30秒
    
    Returns:
        是否同步成功
    """
    splash = SplashScreen(root)
    splash.show()
    
    # 检查坚果云是否已安装
    if not sync_manager.is_installed():
        splash.show_error("⚠️ 坚果云未安装")
        root.after(1000, splash.close)
        # 使用 after 而非 sleep 保持事件循环运行
        _sync_done = [False]
        _sync_result = [False]
        
        def _wait_and_close():
            _sync_done[0] = True
        
        root.after(1200, _wait_and_close)
        while not _sync_done[0]:
            try:
                root.update()
            except tk.TclError:
                return False
            time.sleep(0.05)
        return False
    
    # 使用线程安全的同步方式
    _sync_done = [False]
    _sync_result = [False]
    
    def _do_sync():
        try:
            _sync_result[0] = sync_manager.wait_for_sync(
                timeout=timeout,
                callback=splash.update_progress
            )
        except Exception as e:
            logger.error(f"Error during sync: {e}")
            # 不能在线程中直接调用root.after，设置标志让主线程处理
            _sync_result[0] = False
        finally:
            _sync_done[0] = True
            # 使用事件机制通知主线程关闭splash
            # 主循环检测到_sync_done后会处理关闭
    
    sync_thread = threading.Thread(target=_do_sync, daemon=True)
    sync_thread.start()
    
    # 等待同步完成
    max_wait = timeout + 10
    wait_start = time.time()
    try:
        while not _sync_done[0]:
            root.update()
            time.sleep(0.05)
            if time.time() - wait_start > max_wait:
                splash.close()
                break
    except tk.TclError:
        # 窗口被销毁
        return False
    
    # 同步完成，延迟关闭splash让用户看到结果
    time.sleep(0.5)
    splash.close()
    return _sync_result[0]
