#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置管理测试 - Phase 4 Week 8 Day 3
测试配置加载、验证和管理功能
"""

import unittest
import sys
import os
import json
import tempfile
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.config import (
    ConfigManager, AppConfig, Environment, LogLevel,
    DatabaseConfig, CacheConfig, LoggingConfig,
    SecurityConfig, PerformanceConfig, MonitoringConfig,
    get_config, get_logger
)


class TestDatabaseConfig(unittest.TestCase):
    """测试数据库配置"""
    
    def test_default_config(self):
        """测试默认配置"""
        db_config = DatabaseConfig()
        
        self.assertEqual(db_config.host, "localhost")
        self.assertEqual(db_config.port, 5432)
        self.assertEqual(db_config.database, "rental_system")
    
    def test_connection_string(self):
        """测试连接字符串生成"""
        db_config = DatabaseConfig(
            host="db.example.com",
            port=5432,
            username="admin",
            password="secret",
            database="rental_db"
        )
        
        conn_str = db_config.get_connection_string()
        self.assertIn("admin:secret", conn_str)
        self.assertIn("db.example.com", conn_str)
        self.assertIn("rental_db", conn_str)


class TestCacheConfig(unittest.TestCase):
    """测试缓存配置"""
    
    def test_default_ttl_values(self):
        """测试默认TTL值"""
        cache_config = CacheConfig()
        
        self.assertEqual(cache_config.kpi_ttl_seconds, 300)  # 5分钟
        self.assertEqual(cache_config.report_ttl_seconds, 600)  # 10分钟
        self.assertEqual(cache_config.query_ttl_seconds, 300)  # 5分钟
    
    def test_cache_sizes(self):
        """测试缓存大小限制"""
        cache_config = CacheConfig()
        
        self.assertEqual(cache_config.kpi_max_size, 100)
        self.assertEqual(cache_config.report_max_size, 200)
        self.assertEqual(cache_config.query_max_size, 500)


class TestAppConfig(unittest.TestCase):
    """测试应用配置"""
    
    def test_default_config(self):
        """测试默认应用配置"""
        config = AppConfig()
        
        self.assertEqual(config.environment, Environment.DEVELOPMENT)
        self.assertFalse(config.debug)
        self.assertEqual(config.version, "4.0.0")
    
    def test_config_to_dict(self):
        """测试配置转换为字典"""
        config = AppConfig()
        config_dict = config.to_dict()
        
        self.assertIsInstance(config_dict, dict)
        self.assertIn("environment", config_dict)
        self.assertIn("database", config_dict)
        self.assertIn("cache", config_dict)
    
    def test_config_to_json(self):
        """测试配置转换为JSON"""
        config = AppConfig()
        config_json = config.to_json()
        
        self.assertIsInstance(config_json, str)
        parsed = json.loads(config_json)
        self.assertIn("environment", parsed)


class TestConfigManager(unittest.TestCase):
    """测试配置管理器"""
    
    def setUp(self):
        """设置测试环境"""
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理测试环境"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_config_manager_initialization(self):
        """测试配置管理器初始化"""
        manager = ConfigManager()
        
        self.assertIsNotNone(manager.config)
        self.assertIsNotNone(manager.logger)
    
    def test_load_from_file(self):
        """测试从文件加载配置"""
        # 创建配置文件
        config_data = {
            "environment": "staging",
            "debug": True,
            "database": {
                "host": "staging-db.example.com",
                "port": 5432,
                "username": "staging_user",
                "database": "staging_db"
            }
        }
        
        config_file = os.path.join(self.temp_dir, "config.json")
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f)
        
        # 加载配置
        manager = ConfigManager(config_file)
        
        self.assertEqual(manager.config.environment, Environment.STAGING)
        self.assertTrue(manager.config.debug)
        self.assertEqual(manager.config.database.host, "staging-db.example.com")
    
    def test_load_from_environment_variables(self):
        """测试从环境变量加载配置"""
        # 设置环境变量
        os.environ["RENTAL_ENV"] = "production"
        os.environ["RENTAL_DEBUG"] = "true"
        os.environ["RENTAL_DB_HOST"] = "prod-db.example.com"
        
        try:
            manager = ConfigManager()
            
            self.assertEqual(manager.config.environment, Environment.PRODUCTION)
            self.assertTrue(manager.config.debug)
            self.assertEqual(manager.config.database.host, "prod-db.example.com")
        finally:
            # 清理环境变量
            for var in ["RENTAL_ENV", "RENTAL_DEBUG", "RENTAL_DB_HOST"]:
                if var in os.environ:
                    del os.environ[var]
    
    def test_validate_config_development(self):
        """测试开发环境配置验证"""
        manager = ConfigManager()
        manager.config.environment = Environment.DEVELOPMENT
        manager.config.logging.file_enabled = False  # 禁用文件日志避免路径验证
        
        errors = manager.validate_config()
        
        # 开发环境不应有错误
        self.assertEqual(len(errors), 0)
    
    def test_validate_config_production(self):
        """测试生产环境配置验证"""
        manager = ConfigManager()
        manager.config.environment = Environment.PRODUCTION
        manager.config.debug = True
        
        errors = manager.validate_config()
        
        # 生产环境应该有错误
        self.assertGreater(len(errors), 0)
        self.assertTrue(any("调试" in str(error) for error in errors))
    
    def test_save_config(self):
        """测试保存配置"""
        manager = ConfigManager()
        config_file = os.path.join(self.temp_dir, "saved_config.json")
        
        manager.save_config(config_file)
        
        self.assertTrue(os.path.exists(config_file))
        
        # 验证保存的内容
        with open(config_file, 'r', encoding='utf-8') as f:
            saved_data = json.load(f)
        
        self.assertIn("environment", saved_data)
        self.assertIn("database", saved_data)
    
    def test_get_logger(self):
        """测试获取日志记录器"""
        manager = ConfigManager()
        
        logger = manager.get_logger("test")
        
        self.assertIsNotNone(logger)
        self.assertTrue(logger.name.startswith("rental_system"))


class TestConfigGlobalFunctions(unittest.TestCase):
    """测试配置全局函数"""
    
    def test_get_config(self):
        """测试获取全局配置"""
        config = get_config()
        
        self.assertIsNotNone(config)
        self.assertIsInstance(config, AppConfig)
    
    def test_get_logger(self):
        """测试获取全局日志记录器"""
        logger = get_logger("test")
        
        self.assertIsNotNone(logger)


class TestConfigSecurityValidation(unittest.TestCase):
    """测试配置安全验证"""
    
    def test_production_secret_key_validation(self):
        """测试生产环境密钥验证"""
        config = AppConfig()
        config.environment = Environment.PRODUCTION
        # 保留默认密钥会导致验证失败
        
        manager = ConfigManager()
        manager.config = config
        errors = manager.validate_config()
        
        self.assertTrue(
            any("密钥" in str(error) for error in errors),
            "应该验证生产环境密钥"
        )
    
    def test_production_debug_mode_validation(self):
        """测试生产环境调试模式验证"""
        config = AppConfig()
        config.environment = Environment.PRODUCTION
        config.debug = True
        config.security.secret_key = "production-secret-key-123"
        
        manager = ConfigManager()
        manager.config = config
        errors = manager.validate_config()
        
        self.assertTrue(
            any("调试" in str(error) for error in errors),
            "生产环境不应启用调试模式"
        )


class TestConfigIntegration(unittest.TestCase):
    """测试配置集成"""
    
    def setUp(self):
        """设置测试环境"""
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理测试环境"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_full_config_lifecycle(self):
        """测试完整的配置生命周期"""
        # 创建初始配置
        manager = ConfigManager()
        manager.config.environment = Environment.STAGING
        manager.config.debug = True
        
        # 保存配置
        config_file = os.path.join(self.temp_dir, "config.json")
        manager.save_config(config_file)
        
        # 加载配置
        manager2 = ConfigManager(config_file)
        
        # 验证加载的配置
        self.assertEqual(manager2.config.environment, Environment.STAGING)
        self.assertTrue(manager2.config.debug)


if __name__ == "__main__":
    unittest.main(verbosity=2)
