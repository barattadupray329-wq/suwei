"""
更新通知管理器
- 监控源代码更新
- 自动生成更新包
- 推送更新通知给 exe
- 用户可选择是否更新
"""

import os
import sys
import json
import shutil
import hashlib
import logging
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Callable, List

logger = logging.getLogger(__name__)


class UpdateNotifier:
    """更新通知管理器"""
    
    # 更新检查间隔（秒）
    CHECK_INTERVAL = 30
    
    # 更新包目录
    UPDATE_PACKAGES_DIR = ".update_packages"
    
    # 更新状态文件
    UPDATE_STATUS_FILE = "update_status.json"
    
    def __init__(self, source_root: str, data_folder: str):
        """
        初始化更新通知管理器
        
        Args:
            source_root: 源代码根目录
            data_folder: 数据文件夹（用于保存更新包）
        """
        self.source_root = source_root
        self.data_folder = data_folder
        self.packages_dir = os.path.join(data_folder, self.UPDATE_PACKAGES_DIR)
        self.status_file = os.path.join(self.packages_dir, self.UPDATE_STATUS_FILE)
        
        # 创建更新包目录
        os.makedirs(self.packages_dir, exist_ok=True)
        
        # 状态
        self.update_available = False
        self.latest_update = None
        self.update_history = []
        self._monitoring = False
        self._update_callback = None
        self._last_code_hash = None
        
        # 加载更新历史
        self._load_update_status()
        
        logger.info(f"Update notifier initialized")
    
    def _get_source_code_hash(self) -> str:
        """计算所有源代码的总哈希值"""
        try:
            hasher = hashlib.md5()
            
            # 遍历 modules 文件夹的所有 .py 文件
            modules_dir = os.path.join(self.source_root, "modules")
            core_dir = os.path.join(self.source_root, "core")
            theme_dir = os.path.join(self.source_root, "theme")
            
            for directory in [modules_dir, core_dir, theme_dir]:
                if not os.path.exists(directory):
                    continue
                
                for root, dirs, files in os.walk(directory):
                    for file in sorted(files):
                        if file.endswith('.py'):
                            file_path = os.path.join(root, file)
                            try:
                                with open(file_path, 'rb') as f:
                                    hasher.update(f.read())
                            except:
                                pass
            
            return hasher.hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate source code hash: {e}")
            return ""
    
    def _load_update_status(self):
        """加载更新状态"""
        try:
            if os.path.exists(self.status_file):
                with open(self.status_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.update_history = data.get('history', [])
                    self.latest_update = data.get('latest', None)
                    logger.info(f"Loaded {len(self.update_history)} update records")
            else:
                self.update_history = []
                self.latest_update = None
        except Exception as e:
            logger.error(f"Failed to load update status: {e}")
            self.update_history = []
    
    def _save_update_status(self):
        """保存更新状态"""
        try:
            data = {
                'history': self.update_history[-100:],  # 最多保留 100 条
                'latest': self.latest_update,
            }
            with open(self.status_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save update status: {e}")
    
    def check_for_updates(self) -> bool:
        """
        检查是否有代码更新
        
        Returns:
            是否有新的更新
        """
        try:
            current_hash = self._get_source_code_hash()
            
            if not current_hash:
                return False
            
            # 如果哈希值不同，说明有更新
            if current_hash != self._last_code_hash:
                logger.info("Code update detected!")
                self._last_code_hash = current_hash
                return True
            
            return False
        except Exception as e:
            logger.error(f"Error checking for updates: {e}")
            return False
    
    def create_update_package(self, reason: str = "code_update") -> Optional[Dict]:
        """
        创建更新包
        
        Args:
            reason: 更新原因
        
        Returns:
            更新包信息
        """
        try:
            timestamp = datetime.now()
            package_name = timestamp.strftime("%Y%m%d_%H%M%S")
            package_path = os.path.join(self.packages_dir, package_name)
            
            logger.info(f"Creating update package: {package_name}")
            
            # 创建更新包文件夹
            os.makedirs(package_path, exist_ok=True)
            
            # 复制源代码文件
            modules_src = os.path.join(self.source_root, "modules")
            core_src = os.path.join(self.source_root, "core")
            theme_src = os.path.join(self.source_root, "theme")
            
            copied_files = []
            
            for src_dir, dir_name in [
                (modules_src, "modules"),
                (core_src, "core"),
                (theme_src, "theme"),
            ]:
                if os.path.exists(src_dir):
                    dst_dir = os.path.join(package_path, dir_name)
                    shutil.copytree(src_dir, dst_dir)
                    logger.info(f"Copied: {dir_name}")
                    copied_files.append(dir_name)
            
            # 创建更新信息文件
            update_info = {
                "name": package_name,
                "timestamp": timestamp.isoformat(),
                "reason": reason,
                "files": copied_files,
                "code_hash": self._get_source_code_hash(),
                "size_mb": self._get_package_size(package_path) / (1024 * 1024),
            }
            
            info_file = os.path.join(package_path, "update_info.json")
            with open(info_file, 'w', encoding='utf-8') as f:
                json.dump(update_info, f, ensure_ascii=False, indent=2)
            
            # 更新历史
            self.update_history.append(update_info)
            self.latest_update = update_info
            self.update_available = True
            self._save_update_status()
            
            logger.info(f"Update package created: {package_name}")
            
            # 发送通知
            if self._update_callback:
                self._update_callback("update_available", update_info)
            
            return update_info
        
        except Exception as e:
            logger.error(f"Failed to create update package: {e}")
            return None
    
    def _get_package_size(self, package_path: str) -> int:
        """获取更新包大小"""
        try:
            total = 0
            for dirpath, dirnames, filenames in os.walk(package_path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    total += os.path.getsize(filepath)
            return total
        except:
            return 0
    
    def start_monitoring(self, callback: Callable = None):
        """
        启动后台监控
        
        Args:
            callback: 更新事件回调函数 (event_type, data)
        """
        if self._monitoring:
            return
        
        self._update_callback = callback
        self._monitoring = True
        self._last_code_hash = self._get_source_code_hash()
        
        def monitor_thread():
            logger.info("Update monitoring started")
            
            while self._monitoring:
                try:
                    if self.check_for_updates():
                        logger.info("Creating update package...")
                        self.create_update_package(reason="auto_detected")
                    
                    time.sleep(self.CHECK_INTERVAL)
                except Exception as e:
                    logger.error(f"Error in monitoring thread: {e}")
                    time.sleep(5)
        
        thread = threading.Thread(target=monitor_thread, daemon=True)
        thread.start()
        logger.info("Update monitoring thread started")
    
    def stop_monitoring(self):
        """停止后台监控"""
        self._monitoring = False
        logger.info("Update monitoring stopped")
    
    def install_update(self, package_name: str) -> bool:
        """
        安装更新包
        
        Args:
            package_name: 更新包名称
        
        Returns:
            是否安装成功
        """
        try:
            package_path = os.path.join(self.packages_dir, package_name)
            
            if not os.path.exists(package_path):
                logger.error(f"Update package not found: {package_name}")
                return False
            
            logger.info(f"Installing update: {package_name}")
            
            # 备份当前代码
            backup_dir = os.path.join(self.packages_dir, f".backup_{package_name}")
            
            modules_dst = os.path.join(self.source_root, "modules")
            if os.path.exists(modules_dst):
                shutil.copytree(modules_dst, os.path.join(backup_dir, "modules"))
            
            core_dst = os.path.join(self.source_root, "core")
            if os.path.exists(core_dst):
                shutil.copytree(core_dst, os.path.join(backup_dir, "core"))
            
            # 应用更新
            for dir_name in ["modules", "core", "theme"]:
                src = os.path.join(package_path, dir_name)
                dst = os.path.join(self.source_root, dir_name)
                
                if os.path.exists(src):
                    if os.path.exists(dst):
                        shutil.rmtree(dst)
                    shutil.copytree(src, dst)
                    logger.info(f"Updated: {dir_name}")
            
            logger.info(f"Update installed successfully: {package_name}")
            
            # 发送通知
            if self._update_callback:
                self._update_callback("update_installed", {"package": package_name})
            
            return True
        
        except Exception as e:
            logger.error(f"Failed to install update: {e}")
            return False
    
    def get_update_list(self) -> List[Dict]:
        """获取更新列表"""
        return sorted(self.update_history, key=lambda x: x['timestamp'], reverse=True)
    
    def get_latest_update(self) -> Optional[Dict]:
        """获取最新的更新"""
        return self.latest_update
    
    def mark_update_as_dismissed(self, package_name: str):
        """标记更新为已忽略"""
        try:
            for update in self.update_history:
                if update['name'] == package_name:
                    update['dismissed'] = True
                    break
            self._save_update_status()
            
            if self._update_callback:
                self._update_callback("update_dismissed", {"package": package_name})
        except Exception as e:
            logger.error(f"Error dismissing update: {e}")


# 全局实例
_update_notifier: Optional[UpdateNotifier] = None


def init_update_notifier(source_root: str, data_folder: str) -> UpdateNotifier:
    """初始化全局更新通知管理器"""
    global _update_notifier
    _update_notifier = UpdateNotifier(source_root, data_folder)
    return _update_notifier


def get_update_notifier() -> Optional[UpdateNotifier]:
    """获取全局更新通知管理器"""
    return _update_notifier
