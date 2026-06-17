"""
局域网自动发现模块
- 服务端：定时广播自己的 IP 和计算机名
- 客户端：监听广播或通过计算机名解析 IP
"""

import socket
import threading
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# 配置
BROADCAST_PORT = 50001
BROADCAST_MSG = b"SUWEI_RENTAL_SERVER"
DISCOVER_TIMEOUT = 3.0  # 客户端等待发现的时间（秒）

class ServerDiscovery:
    """UDP 广播与发现管理类"""

    def __init__(self):
        self.server_ip = None
        self.computer_name = None
        self.discovered_ip = None
        self._stop_event = threading.Event()
        self.is_running = False

    def start_broadcast(self, server_ip: str, computer_name: str):
        """服务端：启动 IP 广播
        Args:
            server_ip: 本机 IP
            computer_name: 本机计算机名 (例如 SW02)
        """
        if self.is_running:
            return
        self.server_ip = server_ip
        self.computer_name = computer_name
        self.is_running = True
        self._stop_event.clear()
        
        threading.Thread(target=self._broadcast_loop, daemon=True, name="SyncBroadcast").start()
        logger.info(f"📡 开始广播服务器: {computer_name} ({server_ip})")

    def _broadcast_loop(self):
        """广播循环"""
        # 广播格式：前缀|IP|电脑名
        msg = f"{BROADCAST_MSG.decode()}|{self.server_ip}|{self.computer_name}".encode()
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            while not self._stop_event.is_set():
                try:
                    # 发送到广播地址
                    sock.sendto(msg, ('<broadcast>', BROADCAST_PORT))
                    logger.debug(f"广播：{msg.decode()}")
                    self._stop_event.wait(2)  # 每 2 秒广播一次
                except Exception as e:
                    logger.error(f"广播错误：{e}")
                    self._stop_event.wait(2)

    def start_discovery(self, timeout=DISCOVER_TIMEOUT, target_computer_name=None) -> str:
        """客户端：启动监听，返回发现的服务器 IP
        Args:
            timeout: 等待时间
            target_computer_name: 指定要寻找的电脑名 (例如 SW02)。如果不填，则连接第一个发现的服务器。
        """
        logger.info(f"🔍 正在搜索局域网内的服务器... (目标：{target_computer_name or '任意'})")
        self.discovered_ip = None
        self._stop_event.clear()
        
        discovery_thread = threading.Thread(
            target=self._discovery_loop, 
            args=(timeout, target_computer_name), 
            daemon=True, 
            name="SyncDiscovery"
        )
        discovery_thread.start()
        
        # 等待直到超时或发现 IP
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.discovered_ip:
                logger.info(f"✅ 发现服务器: {self.discovered_ip}")
                return self.discovered_ip
            time.sleep(0.1)
        
        logger.info("❌ 未发现服务器")
        return None

    def _discovery_loop(self, timeout, target_name):
        """监听循环"""
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            try:
                sock.bind(('', BROADCAST_PORT))
                sock.settimeout(timeout)
                while not self._stop_event.is_set():
                    try:
                        data, addr = sock.recvfrom(1024)
                        if data.startswith(BROADCAST_MSG):
                            parts = data.decode().split('|')
                            # 格式：前缀 | IP | 电脑名
                            if len(parts) >= 3:
                                found_ip = parts[1]
                                found_name = parts[2]
                                
                                # 如果指定了电脑名，必须匹配；否则连接第一个
                                # 排除特定电脑名的逻辑也在此处理
                                if target_name and exclude_computer_name and found_name.lower() == exclude_computer_name.lower():
                                    logger.debug(f"排除本机: {found_name}")
                                    continue
                                    
                                if not target_name or found_name.lower() == target_name.lower():
                                    self.discovered_ip = found_ip
                                    self.computer_name = found_name
                                    self._stop_event.set()
                                    logger.info(f"🎉 匹配到目标: {found_name} -> {found_ip}")
                                    break
                                else:
                                    logger.debug(f"发现非目标服务器: {found_name} ({found_ip})")
                    except socket.timeout:
                        break
            except Exception as e:
                logger.error(f"监听错误：{e}")

    def find_server(self, timeout=DISCOVER_TIMEOUT, exclude_computer_name=None):
        """客户端：同步发现服务器，返回 (IP, 电脑名)
        Args:
            timeout: 等待时间
            exclude_computer_name: 排除的电脑名 (避免客户端发现自己是服务端)
        """
        logger.info(f"🔍 正在搜索局域网内的服务器... (排除：{exclude_computer_name})")
        self.discovered_ip = None
        self.computer_name = None
        self._stop_event.clear()
        
        discovery_thread = threading.Thread(
            target=self._discovery_loop, 
            args=(timeout, exclude_computer_name), 
            daemon=True, 
            name="SyncDiscovery"
        )
        discovery_thread.start()
        
        # 等待直到超时或发现 IP
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.discovered_ip:
                logger.info(f"✅ 发现服务器: {self.computer_name} ({self.discovered_ip})")
                return self.discovered_ip, self.computer_name
            time.sleep(0.1)
        
        logger.info("❌ 未发现服务器")
        return None

    def stop(self):
        """停止广播或监听"""
        self._stop_event.set()
        self.is_running = False
