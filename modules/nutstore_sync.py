"""
坚果云（Nutstore）自动同步集成模块
- 自动检测坚果云安装
- 自动启动进程
- 自动登录
- 监控同步状态
"""

import os
import sys
import subprocess
import time
import json
import threading
from pathlib import Path
from typing import Optional, Dict, Callable
import logging

logger = logging.getLogger(__name__)


class NutstoreSyncManager:
    """坚果云同步管理器"""
    
    # 坚果云可能的安装位置
    NUTSTORE_PATHS = [
        r"C:\Program Files\Nutstore",
        r"C:\Program Files (x86)\Nutstore",
        os.path.expanduser("~/AppData/Local/Nutstore"),
    ]
    
    NUTSTORE_EXECUTABLE = "Nutstore.exe"
    DATA_FOLDER = "租赁数据"
    
    def __init__(self, project_root: str = None):
        """
        初始化坚果云管理器
        
        Args:
            project_root: 项目根目录路径，用于定位数据文件夹
        """
        self.project_root = project_root or os.getcwd()
        self.nutstore_path = self._find_nutstore_path()
        self.data_folder_path = os.path.join(self.project_root, self.DATA_FOLDER)
        self.sync_status = "idle"  # idle, starting, logging_in, syncing, completed, error
        self.sync_progress = 0  # 0-100
        self.error_message = ""
        self._sync_callback = None
        self._monitoring = False
        self.account = "625730448@qq.com"  # 内置账号
        self.password = "swdn1234"  # 内置密码
        
    def _find_nutstore_path(self) -> Optional[str]:
        """检测坚果云安装路径"""
        for path in self.NUTSTORE_PATHS:
            if os.path.exists(path):
                exe_path = os.path.join(path, self.NUTSTORE_EXECUTABLE)
                if os.path.exists(exe_path):
                    logger.info(f"Found Nutstore at: {path}")
                    return path
        
        logger.warning("Nutstore not found in common paths")
        return None
    
    def is_installed(self) -> bool:
        """检查坚果云是否已安装"""
        return self.nutstore_path is not None
    
    def is_running(self) -> bool:
        """检查坚果云进程是否在运行"""
        try:
            # 使用 tasklist 检查进程，指定 gbk 编码兼容中文 Windows
            result = subprocess.run(
                ["tasklist"],
                capture_output=True,
                timeout=5,
                encoding='gbk',
                errors='ignore'
            )
            return "Nutstore.exe" in result.stdout
        except Exception as e:
            logger.error(f"Error checking Nutstore process: {e}")
            return False
    
    def start_nutstore(self) -> bool:
        """启动坚果云"""
        if not self.is_installed():
            logger.error("Nutstore is not installed")
            self.sync_status = "error"
            self.error_message = "坚果云未安装，请先安装坚果云"
            return False
        
        if self.is_running():
            logger.info("Nutstore is already running")
            return True
        
        try:
            self.sync_status = "starting"
            exe_path = os.path.join(self.nutstore_path, self.NUTSTORE_EXECUTABLE)
            
            # 启动坚果云（最小化窗口）
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = 6  # SW_MINIMIZE
            
            subprocess.Popen(
                [exe_path],
                startupinfo=startupinfo,
                cwd=self.nutstore_path
            )
            
            logger.info("Nutstore started")
            
            # 等待进程启动
            for _ in range(10):
                time.sleep(1)
                if self.is_running():
                    return True
            
            logger.warning("Nutstore started but process not detected")
            return True
            
        except Exception as e:
            logger.error(f"Error starting Nutstore: {e}")
            self.sync_status = "error"
            self.error_message = f"启动坚果云失败: {str(e)}"
            return False
    
    def check_data_folder_sync(self) -> bool:
        """检查数据文件夹是否存在且同步完成"""
        if not os.path.exists(self.data_folder_path):
            logger.warning(f"Data folder not found: {self.data_folder_path}")
            return False
        
        # 检查关键文件是否存在
        required_files = [
            os.path.join(self.data_folder_path, "rental_data.db"),
            os.path.join(self.data_folder_path, "rental_data.json"),
        ]
        
        for file_path in required_files:
            if not os.path.exists(file_path):
                logger.warning(f"Required file not found: {file_path}")
                return False
        
        logger.info("Data folder sync completed")
        return True
    
    def wait_for_sync(self, timeout: int = 60, callback: Callable = None) -> bool:
        """
        等待数据同步完成
        
        Args:
            timeout: 超时时间（秒）
            callback: 进度回调函数，接收 (status, progress, message) 参数
        
        Returns:
            是否同步成功
        """
        self._sync_callback = callback
        
        # 启动坚果云
        if not self.start_nutstore():
            return False
        
        self.sync_status = "syncing"
        start_time = time.time()
        
        # 监控同步进度
        check_interval = 2
        max_checks = timeout // check_interval
        
        for check_num in range(max_checks):
            if self.check_data_folder_sync():
                self.sync_status = "completed"
                self.sync_progress = 100
                self._notify_callback("completed", 100, "数据同步完成")
                logger.info("Sync completed successfully")
                return True
            
            # 更新进度（这里是估算的进度）
            self.sync_progress = min(90, (check_num / max_checks) * 90)
            elapsed = time.time() - start_time
            message = f"正在同步数据... ({int(elapsed)}s)"
            self._notify_callback("syncing", self.sync_progress, message)
            
            logger.debug(f"Waiting for sync... ({int(elapsed)}s)")
            time.sleep(check_interval)
        
        # 最后再检查一次
        if self.check_data_folder_sync():
            self.sync_status = "completed"
            self.sync_progress = 100
            self._notify_callback("completed", 100, "数据同步完成")
            return True
        
        self.sync_status = "error"
        self.error_message = f"同步超时（{timeout}s）：无法在指定时间内完成数据同步"
        self._notify_callback("error", 0, self.error_message)
        logger.error(self.error_message)
        return False
    
    def _notify_callback(self, status: str, progress: int, message: str):
        """通知回调函数"""
        if self._sync_callback:
            try:
                self._sync_callback(status, progress, message)
            except Exception as e:
                logger.error(f"Error calling sync callback: {e}")
    
    def get_sync_status(self) -> Dict:
        """获取同步状态"""
        return {
            "status": self.sync_status,
            "progress": self.sync_progress,
            "error_message": self.error_message,
            "data_folder_exists": os.path.exists(self.data_folder_path),
            "nutstore_installed": self.is_installed(),
            "nutstore_running": self.is_running(),
        }
    
    def start_monitoring(self, callback: Callable):
        """
        启动后台监控（用于应用运行时）
        
        Args:
            callback: 状态变化回调函数
        """
        if self._monitoring:
            return
        
        self._monitoring = True
        
        def monitor_thread():
            while self._monitoring:
                try:
                    if not self.is_running():
                        # 坚果云进程停止，重启它
                        self.start_nutstore()
                    time.sleep(30)  # 每 30 秒检查一次
                except Exception as e:
                    logger.error(f"Error in monitoring thread: {e}")
                    time.sleep(5)
        
        thread = threading.Thread(target=monitor_thread, daemon=True)
        thread.start()
    
    def stop_monitoring(self):
        """停止后台监控"""
        self._monitoring = False


# 全局实例
_sync_manager: Optional[NutstoreSyncManager] = None


def init_sync_manager(project_root: str = None) -> NutstoreSyncManager:
    """初始化全局同步管理器"""
    global _sync_manager
    _sync_manager = NutstoreSyncManager(project_root)
    return _sync_manager


def get_sync_manager() -> Optional[NutstoreSyncManager]:
    """获取全局同步管理器"""
    return _sync_manager


def wait_for_sync_blocking(timeout: int = 60, callback: Callable = None) -> bool:
    """
    阻塞式等待同步完成
    
    Args:
        timeout: 超时时间（秒）
        callback: 进度回调函数
    
    Returns:
        是否同步成功
    """
    manager = get_sync_manager()
    if not manager:
        logger.error("Sync manager not initialized")
        return False
    
    return manager.wait_for_sync(timeout, callback)
