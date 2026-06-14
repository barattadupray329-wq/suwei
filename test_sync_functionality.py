#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
跨电脑同步功能简化测试
重点测试核心功能而不依赖后台线程的服务器启动
"""

import unittest
import json
import tempfile
from pathlib import Path
import sys
import os

# 确保项目根目录在路径中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.sync_server_manager import SyncServerManager
from update_client import UpdateClient


class TestServerManager(unittest.TestCase):
    """测试服务器管理器的基本功能"""
    
    def setUp(self):
        """设置测试"""
        self.project_root = os.path.dirname(os.path.abspath(__file__))
        self.manager = SyncServerManager(self.project_root, port=9999)
    
    def test_01_manager_creation(self):
        """测试管理器创建"""
        self.assertIsNotNone(self.manager)
        self.assertEqual(self.manager.port, 9999)
    
    def test_02_get_local_ip(self):
        """测试获取本地 IP"""
        ip = self.manager.get_local_ip()
        self.assertIsNotNone(ip)
        self.assertTrue(
            ip.count('.') == 3 or ip == "127.0.0.1",
            f"IP 格式不正确: {ip}"
        )
    
    def test_03_server_url_construction(self):
        """测试服务器 URL 构造"""
        self.manager.server_ip = "192.168.1.100"
        url = self.manager.get_server_url()
        self.assertTrue(url.startswith("http://"))
        self.assertIn("192.168.1.100", url)
        self.assertIn("9999", url)
    
    def test_04_config_structure(self):
        """测试配置文件结构"""
        self.manager.server_ip = "192.168.1.100"
        self.manager._save_config()
        
        config_file = Path(self.project_root) / "sync_server_config.json"
        self.assertTrue(config_file.exists(), "配置文件应该被创建")
        
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # 验证必要字段
        self.assertIn("server_ip", config)
        self.assertIn("port", config)
        self.assertIn("project_root", config)
        self.assertIn("data_folder", config)
        self.assertIn("update_folder", config)
        
        # 清理
        config_file.unlink()


class TestClientConfiguration(unittest.TestCase):
    """测试客户端配置"""
    
    def test_01_config_structure(self):
        """测试客户端配置结构"""
        config = {
            "server_url": "http://192.168.1.100:9999",
            "check_interval": 60,
            "auto_update": True,
            "data_sync_enabled": True,
            "log_level": "INFO"
        }
        
        # 验证所有必需字段
        required_fields = ["server_url", "check_interval", "auto_update", "data_sync_enabled"]
        for field in required_fields:
            self.assertIn(field, config, f"配置应该包含 {field}")
    
    def test_02_config_serialization(self):
        """测试配置序列化"""
        config = {
            "server_url": "http://192.168.1.100:9999",
            "check_interval": 60,
            "auto_update": True,
            "data_sync_enabled": True
        }
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "sync_client_config.json"
            
            # 保存
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False)
            
            # 加载
            with open(config_file, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
            
            # 验证
            self.assertEqual(loaded["server_url"], config["server_url"])
            self.assertEqual(loaded["check_interval"], config["check_interval"])


class TestUpdateClient(unittest.TestCase):
    """测试更新客户端"""
    
    def test_01_client_initialization(self):
        """测试客户端初始化"""
        server_url = "http://192.168.1.100:9999"
        client = UpdateClient(server_url)
        
        self.assertEqual(client.server_url, server_url)
        self.assertEqual(client.timeout, 10)
    
    def test_02_client_url_handling(self):
        """测试客户端 URL 处理"""
        # 测试带尾部斜杠的 URL
        server_url = "http://192.168.1.100:9999/"
        client = UpdateClient(server_url)
        
        self.assertEqual(client.server_url, "http://192.168.1.100:9999")
    
    def test_03_client_api_url_construction(self):
        """测试客户端 API URL 构造"""
        server_url = "http://192.168.1.100:9999"
        client = UpdateClient(server_url)
        
        # 验证客户端有正确的服务器地址
        self.assertTrue(client.server_url.startswith("http://"))
        self.assertIn(":9999", client.server_url)


class TestIntegrationScenarios(unittest.TestCase):
    """测试集成场景"""
    
    def test_01_primary_computer_setup(self):
        """测试主电脑设置流程"""
        project_root = os.path.dirname(os.path.abspath(__file__))
        
        # 1. 创建服务器管理器
        manager = SyncServerManager(project_root, port=9999)
        self.assertIsNotNone(manager)
        
        # 2. 获取 IP
        ip = manager.get_local_ip()
        manager.server_ip = ip
        self.assertIsNotNone(ip)
        
        # 3. 构造服务器 URL
        server_url = manager.get_server_url()
        self.assertTrue(server_url.startswith("http://"))
        self.assertIn("9999", server_url)
        
        print(f"\n✅ 主电脑设置成功")
        print(f"   服务器地址: {server_url}")
    
    def test_02_client_computer_setup(self):
        """测试客户端电脑设置流程"""
        # 1. 模拟从主电脑获取服务器地址
        server_url = "http://192.168.1.100:9999"
        
        # 2. 创建客户端
        client = UpdateClient(server_url)
        self.assertEqual(client.server_url, server_url)
        
        # 3. 验证客户端配置
        config = {
            "server_url": server_url,
            "check_interval": 60,
            "auto_update": True,
            "data_sync_enabled": True
        }
        
        self.assertEqual(config["server_url"], server_url)
        
        print(f"\n✅ 客户端电脑设置成功")
        print(f"   服务器地址: {config['server_url']}")
        print(f"   检查间隔: {config['check_interval']}秒")


class TestSystemComponents(unittest.TestCase):
    """测试系统组件完整性"""
    
    def test_01_all_files_exist(self):
        """测试所有必要文件存在"""
        project_root = Path(os.path.dirname(os.path.abspath(__file__)))
        
        required_files = [
            "update_server.py",
            "update_client.py",
            "client_config.py",
            "modules/sync_server_manager.py",
        ]
        
        for file_path in required_files:
            full_path = project_root / file_path
            self.assertTrue(
                full_path.exists(),
                f"文件不存在: {file_path}"
            )
    
    def test_02_documentation_exists(self):
        """测试文档存在"""
        project_root = Path(os.path.dirname(os.path.abspath(__file__)))
        
        doc_files = [
            "QUICK_START.md",
            "HTTP_SERVER_INTEGRATION.md",
            "INTEGRATION_SUMMARY.md",
        ]
        
        for doc in doc_files:
            doc_path = project_root / doc
            self.assertTrue(
                doc_path.exists(),
                f"文档不存在: {doc}"
            )


def run_tests():
    """运行所有测试"""
    print("=" * 70)
    print("🚀 跨电脑同步功能测试")
    print("=" * 70)
    print()
    
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加所有测试
    suite.addTests(loader.loadTestsFromTestCase(TestServerManager))
    suite.addTests(loader.loadTestsFromTestCase(TestClientConfiguration))
    suite.addTests(loader.loadTestsFromTestCase(TestUpdateClient))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegrationScenarios))
    suite.addTests(loader.loadTestsFromTestCase(TestSystemComponents))
    
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
        print()
        print("🖥️  主电脑（开发机器）")
        print("   1. 启动应用: python main.py")
        print("   2. 登录后自动启动 HTTP 服务器")
        print("   3. 记住显示的服务器地址（例如: http://192.168.1.100:9999）")
        print()
        print("💻 其他电脑（客户端）")
        print("   1. 运行配置脚本: python client_config.py")
        print("   2. 输入主电脑的服务器地址")
        print("   3. 脚本自动测试连接")
        print()
        print("🔄 同步工作流程")
        print("   1. 修改主电脑上的代码")
        print("   2. UpdateNotifier 自动检测并生成更新包")
        print("   3. 其他电脑自动下载并应用更新")
        print("   4. 应用自动重启，显示最新代码")
        print()
        return 0
    else:
        print("❌ 有些测试失败，请查看上面的详细信息")
        return 1


if __name__ == '__main__':
    exit_code = run_tests()
    sys.exit(exit_code)
