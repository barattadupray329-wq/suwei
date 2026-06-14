"""
自动备份管理器
- 监控数据变化，自动创建备份
- 保留完整的备份历史
- 支持版本恢复
- 防止数据丢失
"""

import os
import shutil
import json
import hashlib
import logging
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Callable

logger = logging.getLogger(__name__)


class BackupManager:
    """数据自动备份管理器"""
    
    BACKUP_DIR = ".backups"  # 备份文件夹
    MAX_BACKUPS = 100  # 最多保留 100 个备份（大约 3-4 个月）
    BACKUP_INTERVAL = 5  # 每 5 秒检查一次数据变化
    
    def __init__(self, data_folder: str):
        """
        初始化备份管理器
        
        Args:
            data_folder: 数据文件夹路径（通常是 ./data）
        """
        self.data_folder = data_folder
        self.backup_dir = os.path.join(data_folder, self.BACKUP_DIR)
        
        # 创建备份文件夹
        os.makedirs(self.backup_dir, exist_ok=True)
        
        # 备份索引文件
        self.backup_index_file = os.path.join(self.backup_dir, "backup_index.json")
        
        # 监控状态
        self._monitoring = False
        self._last_hash = {}  # 记录最后一次的文件哈希值
        self._backup_callback = None
        
        # 初始化索引
        self._load_backup_index()
        
        logger.info(f"Backup manager initialized for: {data_folder}")
    
    def _load_backup_index(self):
        """加载备份索引"""
        if os.path.exists(self.backup_index_file):
            try:
                with open(self.backup_index_file, 'r', encoding='utf-8') as f:
                    self.backups = json.load(f)
                logger.info(f"Loaded {len(self.backups)} backup records")
            except Exception as e:
                logger.error(f"Failed to load backup index: {e}")
                self.backups = []
        else:
            self.backups = []
    
    def _save_backup_index(self):
        """保存备份索引"""
        try:
            with open(self.backup_index_file, 'w', encoding='utf-8') as f:
                json.dump(self.backups, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save backup index: {e}")
    
    def _get_file_hash(self, file_path: str) -> str:
        """计算文件哈希值"""
        try:
            if not os.path.exists(file_path):
                return ""
            
            hash_md5 = hashlib.md5()
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate hash for {file_path}: {e}")
            return ""
    
    def _check_data_changed(self) -> bool:
        """检查数据是否有变化"""
        changed = False
        
        # 检查主要数据文件
        important_files = [
            os.path.join(self.data_folder, "rental_data.db"),
            os.path.join(self.data_folder, "rental_data.json"),
        ]
        
        for file_path in important_files:
            if os.path.exists(file_path):
                current_hash = self._get_file_hash(file_path)
                last_hash = self._last_hash.get(file_path, "")
                
                if current_hash != last_hash:
                    self._last_hash[file_path] = current_hash
                    changed = True
        
        return changed
    
    def create_backup(self, reason: str = "auto") -> Optional[Dict]:
        """
        创建备份
        
        Args:
            reason: 备份原因（auto, manual, before_update 等）
        
        Returns:
            备份信息字典
        """
        try:
            timestamp = datetime.now()
            backup_name = timestamp.strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(self.backup_dir, backup_name)
            
            # 创建备份文件夹
            os.makedirs(backup_path, exist_ok=True)
            
            logger.info(f"Creating backup: {backup_name} (reason: {reason})")
            
            # 复制所有数据文件
            db_file = os.path.join(self.data_folder, "rental_data.db")
            json_file = os.path.join(self.data_folder, "rental_data.json")
            
            backup_files = []
            
            if os.path.exists(db_file):
                backup_db = os.path.join(backup_path, "rental_data.db")
                shutil.copy2(db_file, backup_db)
                backup_files.append("rental_data.db")
                logger.debug(f"Backed up: {db_file}")
            
            if os.path.exists(json_file):
                backup_json = os.path.join(backup_path, "rental_data.json")
                shutil.copy2(json_file, backup_json)
                backup_files.append("rental_data.json")
                logger.debug(f"Backed up: {json_file}")
            
            # 记录备份信息
            backup_info = {
                "name": backup_name,
                "timestamp": timestamp.isoformat(),
                "reason": reason,
                "files": backup_files,
                "size_mb": self._get_backup_size(backup_path) / (1024 * 1024),
            }
            
            self.backups.append(backup_info)
            self._save_backup_index()
            
            # 清理过旧的备份
            self._cleanup_old_backups()
            
            logger.info(f"Backup created successfully: {backup_name}")
            
            # 调用回调函数
            if self._backup_callback:
                self._backup_callback("backup_created", backup_info)
            
            return backup_info
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            return None
    
    def _get_backup_size(self, backup_path: str) -> int:
        """获取备份大小（字节）"""
        try:
            total_size = 0
            for dirpath, dirnames, filenames in os.walk(backup_path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    total_size += os.path.getsize(filepath)
            return total_size
        except Exception as e:
            logger.error(f"Failed to get backup size: {e}")
            return 0
    
    def _cleanup_old_backups(self):
        """清理过旧的备份，只保留最多 MAX_BACKUPS 个"""
        try:
            if len(self.backups) <= self.MAX_BACKUPS:
                return
            
            logger.info(f"Cleaning up old backups, keeping {self.MAX_BACKUPS} latest")
            
            # 按时间排序，删除最旧的
            self.backups.sort(key=lambda x: x['timestamp'], reverse=True)
            
            # 删除超出数量的备份
            for backup_info in self.backups[self.MAX_BACKUPS:]:
                backup_path = os.path.join(self.backup_dir, backup_info['name'])
                try:
                    shutil.rmtree(backup_path)
                    logger.info(f"Deleted old backup: {backup_info['name']}")
                except Exception as e:
                    logger.error(f"Failed to delete backup {backup_info['name']}: {e}")
            
            # 更新索引（只保留最新的）
            self.backups = self.backups[:self.MAX_BACKUPS]
            self._save_backup_index()
            
        except Exception as e:
            logger.error(f"Error cleaning up backups: {e}")
    
    def start_monitoring(self, callback: Callable = None):
        """
        启动后台监控
        
        Args:
            callback: 备份事件回调函数
        """
        if self._monitoring:
            return
        
        self._backup_callback = callback
        self._monitoring = True
        
        # 初始化文件哈希
        for file_path in [
            os.path.join(self.data_folder, "rental_data.db"),
            os.path.join(self.data_folder, "rental_data.json"),
        ]:
            if os.path.exists(file_path):
                self._last_hash[file_path] = self._get_file_hash(file_path)
        
        def monitor_thread():
            logger.info("Backup monitoring started")
            
            while self._monitoring:
                try:
                    if self._check_data_changed():
                        logger.info("Data change detected, creating backup...")
                        self.create_backup(reason="auto_change_detected")
                    
                    threading.Event().wait(self.BACKUP_INTERVAL)
                    
                except Exception as e:
                    logger.error(f"Error in backup monitoring: {e}")
        
        thread = threading.Thread(target=monitor_thread, daemon=True)
        thread.start()
        logger.info("Backup monitoring thread started")
    
    def stop_monitoring(self):
        """停止后台监控"""
        self._monitoring = False
        logger.info("Backup monitoring stopped")
    
    def restore_backup(self, backup_name: str) -> bool:
        """
        恢复备份
        
        Args:
            backup_name: 备份名称
        
        Returns:
            是否恢复成功
        """
        try:
            backup_path = os.path.join(self.backup_dir, backup_name)
            
            if not os.path.exists(backup_path):
                logger.error(f"Backup not found: {backup_name}")
                return False
            
            logger.warning(f"Restoring backup: {backup_name}")
            
            # 创建恢复前的备份（以防万一）
            self.create_backup(reason="before_restore")
            
            # 恢复文件
            backup_db = os.path.join(backup_path, "rental_data.db")
            backup_json = os.path.join(backup_path, "rental_data.json")
            
            if os.path.exists(backup_db):
                shutil.copy2(backup_db, os.path.join(self.data_folder, "rental_data.db"))
                logger.info("Restored: rental_data.db")
            
            if os.path.exists(backup_json):
                shutil.copy2(backup_json, os.path.join(self.data_folder, "rental_data.json"))
                logger.info("Restored: rental_data.json")
            
            logger.info(f"Backup restored successfully: {backup_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to restore backup: {e}")
            return False
    
    def get_backup_list(self) -> List[Dict]:
        """获取备份列表"""
        return sorted(self.backups, key=lambda x: x['timestamp'], reverse=True)
    
    def get_backup_info(self, backup_name: str) -> Optional[Dict]:
        """获取备份信息"""
        for backup in self.backups:
            if backup['name'] == backup_name:
                return backup
        return None
    
    def get_total_backup_size(self) -> float:
        """获取所有备份的总大小（MB）"""
        total = 0
        for backup in self.backups:
            total += backup.get('size_mb', 0)
        return total
    
    def export_backup(self, backup_name: str, export_path: str) -> bool:
        """
        导出备份到指定位置
        
        Args:
            backup_name: 备份名称
            export_path: 导出路径
        
        Returns:
            是否导出成功
        """
        try:
            backup_path = os.path.join(self.backup_dir, backup_name)
            
            if not os.path.exists(backup_path):
                logger.error(f"Backup not found: {backup_name}")
                return False
            
            # 创建 zip 压缩包
            shutil.make_archive(
                export_path,
                'zip',
                backup_path
            )
            
            logger.info(f"Backup exported to: {export_path}.zip")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export backup: {e}")
            return False


# 全局实例
_backup_manager: Optional[BackupManager] = None


def init_backup_manager(data_folder: str) -> BackupManager:
    """初始化全局备份管理器"""
    global _backup_manager
    _backup_manager = BackupManager(data_folder)
    return _backup_manager


def get_backup_manager() -> Optional[BackupManager]:
    """获取全局备份管理器"""
    return _backup_manager
