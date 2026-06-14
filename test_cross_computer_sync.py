#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
跨电脑同步功能测试
测试 HTTP 服务器、客户端配置、更新包下载等完整流程
"""

import unittest
import json
import tempfile
import time
from pathlib import Path
import sys
import os
import threading
import requests
from datetime import datetime

# 确保项目根目录在路径中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.sync_server_manager import SyncServerManager
from update_client import UpdateClient


class TestSyncServer(unittest.TestCase):
    """测试 HTTP 同步服务器"""
    
    @classmethod
    def setUpClass(cls):
        """启动服务器"""
        cls.project_root = os.path.dirname(os.path.abspath(__file__))
        cls.server_manager = SyncServerManager(cls.project_root, port=9998)
        cls.server_manager.start_server()
        time.sleep(2)  # 等待服务器启动
    
    @classmethod
    def tearDownClass(cls):
        """停止服务器"""
        cls.server_manager.stop_server()
    
    def test_01_server_is_running(self):
        """测试服务器是否正在运行"""
        self.assertTrue(
            self.server_manager.is_running,
            "HTTP 服务器应该正在运行"
        )
    
    def test_02_server_has_ip(self):
        """测试服务器是否有 IP 地址"""
        self.assertIsNotNone(
            self.server_manager.server_ip,
            "服务器应该检测到 IP 地址"
        )
    
    def test_03_server_url_format(self):
        """测试服务器 URL 格式"""
        url = self.server_manager.get_server_url()
        self.assertTrue(
            url.startswith("http://"),
            f"服务器 URL 应该以 'http://' 开头，得到: {url}"
        )
        self.assertIn(":9998", url, "服务器 URL 应该包含端口 9998")
    
    def test_04_config_saved(self):
        """测试配置是否已保存"""
        config_file = Path(self.project_root) / "sync_server_config.json"
        self.assertTrue(
            config_file.exists(),
            "配置文件应该被创建"
        )
        
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        self.assertIn("server_ip", config)
        self.assertIn("port", config)
        self.assertEqual(config["port"], 9998)


class TestUpdateClient(unittest.TestCase):
    """测试更新客户端"""
    
    @classmethod
    def setUpClass(cls):
        """启动服务器并初始化客户端"""
        cls.project_root = os.path.dirname(os.path.abspath(__file__))
        cls.server_manager = SyncServerManager(cls.project_root, port=9997)
        cls.server_manager.start_server()
        time.sleep(2)
        
        server_url = cls.server_manager.get_server_url()
        cls.client = UpdateClient(server_url)
    
    @classmethod
    def tearDownClass(cls):
        """停止服务器"""
        cls.server_manager.stop_server()
    
    def test_01_check_server_status(self):
        """测试检查服务器状态"""
        is_alive = self.client.check_server_status()
        self.assertTrue(is_alive, "客户端应该能连接到服务器")
    
    def test_02_get_available_updates(self):
        """测试获取可用更新列表"""
        updates = self.client.get_available_updates()
        self.assertIsInstance(updates, list, "更新列表应该是列表")
    
    def test_03_get_remote_data_files(self):
        """测试获取远程数据文件列表"""
        files = self.client.get_remote_data_files()
        self.assertIsInstance(files, list, "文件列表应该是列表")
    
    def test_04_server_url_configuration(self):
        """测试客户端 URL 配置"""
        self.assertTrue(
            self.client.server_url.startswith("http://"),
            "服务器 URL 应该以 http:// 开头"
        )


class TestClientConfig(unittest.TestCase):
    """测试客户端配置"""
    
    def test_01_config_file_creation(self):
        """测试配置文件创建"""
        config = {
            "server_url": "http://192.168.1.100:9999",
            "check_interval": 60,
            "auto_update": True,
            "data_sync_enabled": True,
            "log_level": "INFO"
        }
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "sync_client_config.json"
            
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False)
            
            self.assertTrue(config_file.exists())
            
            with open(config_file, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
            
            self.assertEqual(loaded["server_url"], config["server_url"])
    
    def test_02_config_validation(self):
        """测试配置验证"""
        config = {
            "server_url": "http://192.168.1.100:9999",
            "check_interval": 60,
            "auto_update": True,
            "data_sync_enabled": True
        }
        
        # 验证必要字段
        self.assertIn("server_url", config)
        self.assertTrue(config["server_url"].startswith("http://"))
        self.assertGreater(config["check_interval"], 0)
        self.assertIsInstance(config["auto_update"], bool)


class TestIntegration(unittest.TestCase):
    """集成测试 - 完整的同步流程"""
    
    @classmethod
    def setUpClass(cls):
        """启动服务器"""
        cls.project_root = os.path.dirname(os.path.abspath(__file__))
        cls.server_manager = SyncServerManager(cls.project_root, port=9996)
        cls.server_manager.start_server()
        time.sleep(2)
    
    @classmethod
    def tearDownClass(cls):
        """停止服务器"""
        cls.server_manager.stop_server()
    
    def test_complete_sync_flow(self):
        """测试完整同步流程"""
        # 1. 获取服务器 URL
        server_url = self.server_manager.get_server_url()
        self.assertIsNotNone(server_url)
        
        # 2. 创建客户端
        client = UpdateClient(server_url)
        
        # 3. 检查服务器状态
        is_alive = client.check_server_status()
        self.assertTrue(is_alive)
        
        # 4. 获取更新列表
        updates = client.get_available_updates()
        self.assertIsInstance(updates, list)
        
        # 5. 获取数据文件列表
        files = client.get_remote_data_files()
        self.assertIsInstance(files, list)
        
        print(f"\n✅ 完整同步流程测试通过")
        print(f"   服务器: {server_url}")
        print(f"   更新包数量: {len(updates)}")
        print(f"   数据文件数量: {len(files)}")


class TestServerAPIs(unittest.TestCase):
    """测试所有 HTTP API 端点"""
    
    @classmethod
    def setUpClass(cls):
        """启动服务器"""
        cls.project_root = os.path.dirname(os.path.abspath(__file__))
        cls.server_manager = SyncServerManager(cls.project_root, port=9995)
        cls.server_manager.start_server()
        time.sleep(2)
        cls.base_url = cls.server_manager.get_server_url()
    
    @classmethod
    def tearDownClass(cls):
        """停止服务器"""
        cls.server_manager.stop_server()
    
    def test_api_status(self):
        """测试 /api/status 端点"""
        try:
            response = requests.get(f"{self.base_url}/api/status", timeout=5)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data["success"])
            self.assertIn("status", data)
        except Exception as e:
            self.fail(f"API status 测试失败: {e}")
    
    def test_api_updates_list(self):
        """测试 /api/updates/list 端点"""
        try:
            response = requests.get(f"{self.base_url}/api/updates/list", timeout=5)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data["success"])
            self.assertIn("updates", data)
        except Exception as e:
            self.fail(f"API updates list 测试失败: {e}")
    
    def test_api_data_list(self):
        """测试 /api/data/list 端点"""
        try:
            response = requests.get(f"{self.base_url}/api/data/list", timeout=5)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data["success"])
            self.assertIn("files", data)
        except Exception as e:
            self.fail(f"API data list 测试失败: {e}")


def run_tests():
    """运行所有测试"""
    print("=" * 70)
    print("🚀 跨电脑同步功能完整测试")
    print("=" * 70)
    print()
    
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加所有测试
    suite.addTests(loader.loadTestsFromTestCase(TestSyncServer))
    suite.addTests(loader.loadTestsFromTestCase(TestUpdateClient))
    suite.addTests(loader.loadTestsFromTestCase(TestClientConfig))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestServerAPIs))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print()
    print("=" * 70)
    print("📊 测试结果总结")
    print("=" * 70)
    print(f"运行测试数: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    print()
    
    if result.wasSuccessful():
        print("✅ 所有测试通过！")
        print()
        print("系统已准备好用于跨电脑同步：")
        print("1. 主电脑: python main.py")
        print("2. 其他电脑: python client_config.py")
        print("3. 开始开发，自动同步！")
        return 0
    else:
        print("❌ 有些测试失败，请查看上面的详细信息")
        return 1


if __name__ == '__main__':
    exit_code = run_tests()
    sys.exit(exit_code)
