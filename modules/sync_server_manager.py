"""
同步服务器管理器 - 在主程序中管理 HTTP 更新服务器
在主电脑上自动启动服务器，其他电脑通过网络访问
"""

import os
import threading
import logging
from pathlib import Path
import socket
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class SyncServerManager:
    """管理 HTTP 更新服务器的生命周期"""
    
    def __init__(self, project_root: str, port: int = 9999):
        """
        初始化服务器管理器
        
        Args:
            project_root: 项目根目录
            port: 服务器端口
        """
        self.project_root = Path(project_root)
        self.port = port
        self.server_thread = None
        self.server_process = None
        self.is_running = False
        self.server_ip = None
        self.config_file = self.project_root / "sync_server_config.json"
    
    def get_local_ip(self) -> str:
        """获取本机 IP 地址"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def start_server(self) -> bool:
        """
        启动 HTTP 服务器（在后台线程中）
        
        Returns:
            是否成功启动
        """
        try:
            if self.is_running:
                logger.warning("✓ 服务器已在运行")
                return True
            
            logger.info("🚀 正在启动 HTTP 同步服务器...")
            
            # 获取本机 IP
            self.server_ip = self.get_local_ip()
            
            # 在后台线程中启动服务器
            self.server_thread = threading.Thread(
                target=self._run_server,
                daemon=True
            )
            self.server_thread.start()
            
            # 等待服务器启动
            import time
            time.sleep(1)
            
            if self._check_server_alive():
                self.is_running = True
                self._save_config()
                logger.info(f"✅ HTTP 服务器已启动")
                logger.info(f"   📍 IP: {self.server_ip}:{self.port}")
                logger.info(f"   🔗 访问: http://{self.server_ip}:{self.port}")
                return True
            else:
                logger.error("❌ 服务器启动失败")
                return False
        
        except Exception as e:
            logger.error(f"❌ 启动服务器失败: {e}")
            return False
    
    def _run_server(self):
        """在线程中运行服务器"""
        try:
            # 动态导入服务器模块
            import sys
            from pathlib import Path
            # 确保项目根目录在路径中
            sys.path.insert(0, str(self.project_root))
            
            from update_server import UpdateServerHandler, get_local_ip
            from http.server import HTTPServer
            
            server_address = ('0.0.0.0', self.port)
            httpd = HTTPServer(server_address, UpdateServerHandler)
            
            logger.info(f"📡 HTTP 服务器在 {self.port} 端口启动")
            httpd.serve_forever()
        
        except Exception as e:
            logger.error(f"❌ 服务器运行错误: {e}")
    
    def _check_server_alive(self) -> bool:
        """检查服务器是否在线"""
        try:
            import requests
            response = requests.get(
                f"http://127.0.0.1:{self.port}/api/status",
                timeout=5
            )
            return response.status_code == 200
        except:
            return False
    
    def _save_config(self):
        """保存服务器配置到文件"""
        try:
            config = {
                "server_ip": self.server_ip,
                "port": self.port,
                "started_at": datetime.now().isoformat(),
                "project_root": str(self.project_root),
                "data_folder": str(self.project_root / "租赁数据"),
                "update_folder": str(self.project_root / "租赁数据" / ".update_packages")
            }
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✅ 配置已保存到 {self.config_file}")
        
        except Exception as e:
            logger.error(f"❌ 保存配置失败: {e}")
    
    def get_server_url(self) -> str:
        """获取服务器访问URL"""
        if self.server_ip:
            return f"http://{self.server_ip}:{self.port}"
        return None
    
    def stop_server(self):
        """停止服务器"""
        try:
            if not self.is_running:
                return
            
            logger.info("🛑 正在停止服务器...")
            self.is_running = False
            
            # 无法直接停止服务器线程，但可以设置标志
            # 服务器将继续运行到程序退出
            logger.info("✅ 服务器停止信号已发送")
        
        except Exception as e:
            logger.error(f"❌ 停止服务器失败: {e}")
    
    @staticmethod
    def load_config(project_root: str) -> dict:
        """加载保存的服务器配置"""
        try:
            config_file = Path(project_root) / "sync_server_config.json"
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except:
            pass
        return None


# 全局实例
_sync_server_manager = None


def init_sync_server(project_root: str) -> SyncServerManager:
    """初始化并启动同步服务器"""
    global _sync_server_manager
    
    _sync_server_manager = SyncServerManager(project_root)
    _sync_server_manager.start_server()
    
    return _sync_server_manager


def get_sync_server_manager() -> SyncServerManager:
    """获取全局同步服务器管理器实例"""
    global _sync_server_manager
    return _sync_server_manager


def get_sync_server_url() -> str:
    """获取服务器 URL"""
    manager = get_sync_server_manager()
    if manager:
        return manager.get_server_url()
    return None


if __name__ == '__main__':
    # 测试：直接运行此模块
    manager = init_sync_server('.')
    
    if manager.is_running:
        print(f"\n✅ 服务器运行中: {manager.get_server_url()}")
        print("按 Ctrl+C 停止\n")
        
        try:
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            manager.stop_server()
            print("\n✅ 已停止")
