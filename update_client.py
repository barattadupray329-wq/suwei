"""
Update Client - 用于从服务器下载更新包和数据
在 exe 运行时使用此模块连接到更新服务器
"""

import os
import json
import requests
import hashlib
from pathlib import Path
from datetime import datetime
import logging
from typing import List, Dict, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UpdateClient:
    """从服务器下载更新的客户端"""
    
    def __init__(self, server_url: str = None, computer_name: str = None):
        """
        初始化客户端
        
        Args:
            server_url: 服务器地址，例如 "http://192.168.3.131:9999"。
            computer_name: 服务器计算机名，例如 "SW02"。
                        如果 server_url 为 None，将使用 computer_name 自动发现。
        """
        self.timeout = 10
        self.computer_name = computer_name
        
        if server_url:
            self.server_url = server_url.rstrip('/')
            logger.info(f"🔗 已手动配置服务器: {self.server_url}")
        else:
            logger.info("🔍 未配置服务器地址，尝试自动发现...")
            self.server_url = self._auto_discover()

    def _auto_discover(self) -> Optional[str]:
        """在局域网内自动发现服务器"""
        try:
            # 动态导入发现模块
            from modules.server_discovery import ServerDiscovery
            discovery = ServerDiscovery()
            ip = discovery.start_discovery(target_computer_name=self.computer_name)
            
            if ip:
                server_url = f"http://{ip}:9999"
                logger.info(f"🎉 自动发现服务器成功: {server_url}")
                return server_url
            else:
                logger.warning("⚠️  未在局域网发现服务器")
                return None
        except ImportError:
            logger.error("❌ 缺少自动发现模块 (modules/server_discovery.py)")
            return None
        except Exception as e:
            logger.error(f"❌ 自动发现失败: {e}")
            return None
    
    def check_server_status(self) -> bool:
        """检查服务器是否在线"""
        try:
            response = requests.get(
                f"{self.server_url}/api/status",
                timeout=self.timeout
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"❌ 无法连接到服务器: {e}")
            return False
    
    def get_available_updates(self) -> List[Dict]:
        """获取可用的更新包列表"""
        try:
            response = requests.get(
                f"{self.server_url}/api/updates/list",
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get('success'):
                logger.info(f"✅ 找到 {len(data['updates'])} 个更新包")
                return data['updates']
            else:
                logger.error(f"❌ 获取更新列表失败: {data.get('error')}")
                return []
        
        except Exception as e:
            logger.error(f"❌ 获取更新列表失败: {e}")
            return []
    
    def download_update(self, filename: str, output_path: str) -> bool:
        """
        下载更新包
        
        Args:
            filename: 更新包文件名
            output_path: 保存路径
        
        Returns:
            是否成功下载
        """
        try:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"⬇️  开始下载更新包: {filename}")
            
            response = requests.get(
                f"{self.server_url}/api/updates/download/{filename}",
                timeout=30,
                stream=True
            )
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if total_size > 0:
                            percent = (downloaded / total_size) * 100
                            logger.info(f"   进度: {percent:.1f}% ({downloaded}/{total_size} bytes)")
            
            logger.info(f"✅ 更新包下载完成: {output_path}")
            return True
        
        except Exception as e:
            logger.error(f"❌ 下载更新包失败: {e}")
            if Path(output_path).exists():
                Path(output_path).unlink()
            return False
    
    def get_remote_data_files(self) -> List[Dict]:
        """获取远程数据文件列表"""
        try:
            response = requests.get(
                f"{self.server_url}/api/data/list",
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get('success'):
                logger.info(f"✅ 找到 {len(data['files'])} 个数据文件")
                return data['files']
            else:
                logger.error(f"❌ 获取数据文件列表失败: {data.get('error')}")
                return []
        
        except Exception as e:
            logger.error(f"❌ 获取数据文件列表失败: {e}")
            return []
    
    def sync_data_files(self, local_data_folder: str) -> bool:
        """
        同步数据文件
        
        Args:
            local_data_folder: 本地数据文件夹路径
        
        Returns:
            是否成功同步
        """
        try:
            local_data_folder = Path(local_data_folder)
            local_data_folder.mkdir(parents=True, exist_ok=True)
            
            remote_files = self.get_remote_data_files()
            if not remote_files:
                logger.warning("⚠️  没有找到远程数据文件")
                return False
            
            logger.info(f"🔄 开始同步 {len(remote_files)} 个数据文件...")
            
            synced_count = 0
            for file_info in remote_files:
                file_path = file_info['path']
                local_file = local_data_folder / file_path
                
                # 检查本地文件是否已存在且最新
                if local_file.exists():
                    remote_modified = datetime.fromisoformat(file_info['modified'])
                    local_modified = datetime.fromtimestamp(local_file.stat().st_mtime)
                    
                    if local_modified >= remote_modified:
                        logger.debug(f"   ⏭️  跳过已有文件: {file_path}")
                        continue
                
                # 下载文件
                if self._download_data_file(file_path, local_file):
                    synced_count += 1
            
            logger.info(f"✅ 数据文件同步完成 (更新 {synced_count} 个文件)")
            return True
        
        except Exception as e:
            logger.error(f"❌ 同步数据文件失败: {e}")
            return False
    
    def _download_data_file(self, remote_path: str, local_file: Path) -> bool:
        """下载单个数据文件"""
        try:
            local_file.parent.mkdir(parents=True, exist_ok=True)
            
            response = requests.get(
                f"{self.server_url}/api/data/download/{remote_path}",
                timeout=30,
                stream=True
            )
            response.raise_for_status()
            
            with open(local_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            logger.info(f"   ✅ 已同步: {remote_path}")
            return True
        
        except Exception as e:
            logger.error(f"   ❌ 同步失败: {remote_path} - {e}")
            return False
    
    def verify_file_integrity(self, file_path: str) -> str:
        """
        计算文件 MD5 哈希值
        
        Args:
            file_path: 文件路径
        
        Returns:
            MD5 哈希值
        """
        md5_hash = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
        return md5_hash.hexdigest()


def demo():
    """演示如何使用客户端"""
    # 连接到服务器（需要替换为实际的服务器地址）
    client = UpdateClient("http://192.168.1.100:9999")
    
    # 检查服务器状态
    if client.check_server_status():
        logger.info("✅ 服务器在线")
        
        # 获取可用的更新
        updates = client.get_available_updates()
        if updates:
            latest_update = updates[0]
            logger.info(f"🎯 最新更新: {latest_update['name']}")
            
            # 下载更新包
            if client.download_update(latest_update['name'], 'latest_update.zip'):
                logger.info("✅ 更新包已准备好，可以应用更新")
        
        # 同步数据文件
        client.sync_data_files('./rental_data')
    
    else:
        logger.error("❌ 无法连接到服务器")


if __name__ == '__main__':
    demo()
