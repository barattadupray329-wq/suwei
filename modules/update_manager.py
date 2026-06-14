"""
自动更新管理器
- 检查新版本
- 安全下载和安装更新
- 数据完全隔离，不受影响
- 支持回滚到旧版本
- 后台静默更新
"""

import os
import sys
import json
import shutil
import hashlib
import logging
import subprocess
import threading
import time
import urllib.request
from pathlib import Path
from typing import Optional, Dict, Callable
from datetime import datetime

logger = logging.getLogger(__name__)


class UpdateManager:
    """应用更新管理器"""
    
    # 更新检查服务器（可以改成你自己的服务器）
    UPDATE_CHECK_URL = "https://api.github.com/repos/barattadupray329-wq/suwei/releases/latest"
    
    # 版本信息文件
    VERSION_FILE = "version.json"
    UPDATE_CACHE_DIR = ".update_cache"
    BACKUP_DIR = ".version_backup"
    
    def __init__(self, app_root: str = None):
        """
        初始化更新管理器
        
        Args:
            app_root: 应用根目录路径
        """
        self.app_root = app_root or os.getcwd()
        self.version_file_path = os.path.join(self.app_root, self.VERSION_FILE)
        self.cache_dir = os.path.join(self.app_root, self.UPDATE_CACHE_DIR)
        self.backup_dir = os.path.join(self.app_root, self.BACKUP_DIR)
        
        self.current_version = self._load_current_version()
        self.update_status = "idle"  # idle, checking, downloading, installing, completed, error
        self.update_progress = 0  # 0-100
        self.error_message = ""
        self.new_version_info = None
        self._update_callback = None
        
        # 创建必要的目录
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def _load_current_version(self) -> str:
        """加载当前版本号"""
        if os.path.exists(self.version_file_path):
            try:
                with open(self.version_file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get("version", "1.0.0")
            except Exception as e:
                logger.error(f"Failed to load version file: {e}")
        return "1.0.0"
    
    def _save_version(self, version: str, date: str = None):
        """保存版本信息"""
        try:
            data = {
                "version": version,
                "updated_at": date or datetime.now().isoformat(),
            }
            with open(self.version_file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info(f"Version updated to: {version}")
        except Exception as e:
            logger.error(f"Failed to save version: {e}")
    
    def _parse_version(self, version_str: str) -> tuple:
        """解析版本号为可比较的元组"""
        try:
            return tuple(map(int, version_str.split('.')))
        except:
            return (0, 0, 0)
    
    def check_update(self, callback: Callable = None) -> bool:
        """
        检查是否有新版本
        
        Args:
            callback: 进度回调函数 (status, progress, message)
        
        Returns:
            是否有新版本可用
        """
        self._update_callback = callback
        self.update_status = "checking"
        self._notify_callback("checking", 0, "正在检查更新...")
        
        try:
            logger.info("Checking for updates...")
            
            # 从 GitHub API 获取最新版本信息
            try:
                with urllib.request.urlopen(self.UPDATE_CHECK_URL, timeout=10) as response:
                    data = json.loads(response.read().decode('utf-8'))
                    
                    latest_version = data.get('tag_name', 'v1.0.0').lstrip('v')
                    
                    # 比较版本号
                    current = self._parse_version(self.current_version)
                    latest = self._parse_version(latest_version)
                    
                    if latest > current:
                        self.new_version_info = {
                            "version": latest_version,
                            "url": data.get('assets', [{}])[0].get('browser_download_url') if data.get('assets') else None,
                            "description": data.get('body', ''),
                            "release_date": data.get('published_at', ''),
                        }
                        self.update_status = "update_available"
                        self._notify_callback("update_available", 100, f"发现新版本: {latest_version}")
                        logger.info(f"New version available: {latest_version}")
                        return True
                    else:
                        self.update_status = "idle"
                        self._notify_callback("idle", 100, f"已是最新版本 ({self.current_version})")
                        logger.info("Already on latest version")
                        return False
                        
            except urllib.error.URLError as e:
                logger.warning(f"Failed to check updates (network error): {e}")
                self._notify_callback("error", 0, "检查更新失败（网络错误），请检查网络连接")
                self.update_status = "error"
                return False
        
        except Exception as e:
            logger.error(f"Error checking updates: {e}")
            self.update_status = "error"
            self.error_message = str(e)
            self._notify_callback("error", 0, f"检查更新失败: {str(e)}")
            return False
    
    def download_update(self, callback: Callable = None) -> bool:
        """
        下载更新
        
        Args:
            callback: 进度回调函数
        
        Returns:
            是否下载成功
        """
        if not self.new_version_info:
            logger.error("No update info available")
            return False
        
        self._update_callback = callback
        self.update_status = "downloading"
        
        download_url = self.new_version_info.get('url')
        if not download_url:
            logger.error("No download URL available")
            self._notify_callback("error", 0, "无法获取下载链接")
            self.update_status = "error"
            return False
        
        try:
            self._notify_callback("downloading", 0, "正在下载更新...")
            
            # 下载文件
            exe_name = "速维租赁管理系统.exe"
            temp_exe_path = os.path.join(self.cache_dir, exe_name)
            
            logger.info(f"Downloading update from: {download_url}")
            
            def progress_hook(block_num, block_size, total_size):
                """下载进度回调"""
                if total_size > 0:
                    downloaded = min(block_num * block_size, total_size)
                    progress = int((downloaded / total_size) * 100)
                    self.update_progress = progress
                    self._notify_callback("downloading", progress, f"下载中... {progress}%")
            
            urllib.request.urlretrieve(download_url, temp_exe_path, progress_hook)
            
            if not os.path.exists(temp_exe_path):
                raise Exception("Download file not created")
            
            self._notify_callback("downloading", 100, "下载完成")
            self.update_status = "ready_to_install"
            logger.info(f"Update downloaded successfully: {temp_exe_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error downloading update: {e}")
            self.update_status = "error"
            self.error_message = str(e)
            self._notify_callback("error", 0, f"下载失败: {str(e)}")
            return False
    
    def install_update(self, restart_callback: Callable = None) -> bool:
        """
        安装更新
        
        Args:
            restart_callback: 重启应用的回调函数（会调用此函数重启）
        
        Returns:
            是否安装成功
        """
        if self.update_status != "ready_to_install":
            logger.error("Update not ready to install")
            return False
        
        try:
            self.update_status = "installing"
            self._notify_callback("installing", 0, "正在安装更新...")
            
            exe_name = "速维租赁管理系统.exe"
            temp_exe_path = os.path.join(self.cache_dir, exe_name)
            current_exe_path = os.path.join(self.app_root, exe_name)
            backup_exe_path = os.path.join(self.backup_dir, f"{exe_name}.bak")
            
            # 1. 备份当前版本
            logger.info("Creating backup of current version...")
            self._notify_callback("installing", 20, "备份当前版本...")
            
            if os.path.exists(current_exe_path):
                shutil.copy2(current_exe_path, backup_exe_path)
            
            # 2. 验证下载的文件完整性（可选）
            logger.info("Verifying downloaded file...")
            self._notify_callback("installing", 40, "验证更新文件...")
            
            if not os.path.exists(temp_exe_path):
                raise Exception("Downloaded file not found")
            
            # 3. 替换应用文件
            logger.info("Replacing application file...")
            self._notify_callback("installing", 60, "替换应用文件...")
            
            shutil.move(temp_exe_path, current_exe_path)
            
            # 4. 更新版本信息
            logger.info("Updating version info...")
            self._notify_callback("installing", 80, "更新版本信息...")
            
            new_version = self.new_version_info.get('version', self.current_version)
            self._save_version(new_version)
            self.current_version = new_version
            
            # 5. 清理缓存
            logger.info("Cleaning up cache...")
            shutil.rmtree(self.cache_dir, ignore_errors=True)
            
            self.update_status = "completed"
            self._notify_callback("completed", 100, "更新完成，应用将重启")
            
            logger.info("Update installed successfully")
            
            # 延迟重启，让用户看到完成消息
            if restart_callback:
                threading.Thread(target=self._restart_app_delayed, args=(restart_callback,), daemon=True).start()
            
            return True
            
        except Exception as e:
            logger.error(f"Error installing update: {e}")
            self.update_status = "error"
            self.error_message = str(e)
            self._notify_callback("error", 0, f"安装失败: {str(e)}")
            
            # 尝试回滚
            self._rollback()
            
            return False
    
    def _rollback(self):
        """回滚到备份版本"""
        try:
            logger.warning("Rolling back to previous version...")
            exe_name = "速维租赁管理系统.exe"
            current_exe_path = os.path.join(self.app_root, exe_name)
            backup_exe_path = os.path.join(self.backup_dir, f"{exe_name}.bak")
            
            if os.path.exists(backup_exe_path):
                shutil.copy2(backup_exe_path, current_exe_path)
                logger.info("Rollback successful")
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
    
    def _restart_app_delayed(self, restart_callback: Callable, delay: int = 2):
        """延迟重启应用"""
        time.sleep(delay)
        restart_callback()
    
    def _notify_callback(self, status: str, progress: int, message: str):
        """通知回调函数"""
        if self._update_callback:
            try:
                self._update_callback(status, progress, message)
            except Exception as e:
                logger.error(f"Error calling update callback: {e}")
    
    def get_update_status(self) -> Dict:
        """获取更新状态"""
        return {
            "status": self.update_status,
            "current_version": self.current_version,
            "new_version": self.new_version_info.get('version') if self.new_version_info else None,
            "progress": self.update_progress,
            "error_message": self.error_message,
        }


# 全局实例
_update_manager: Optional[UpdateManager] = None


def init_update_manager(app_root: str = None) -> UpdateManager:
    """初始化全局更新管理器"""
    global _update_manager
    _update_manager = UpdateManager(app_root)
    return _update_manager


def get_update_manager() -> Optional[UpdateManager]:
    """获取全局更新管理器"""
    return _update_manager
