#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置管理系统 - Phase 4 Week 8 Day 3
支持环境变量、配置文件和运行时配置的生产就绪配置系统
"""

import os
import json
import logging
from typing import Any, Dict, Optional, List
from pathlib import Path
from dataclasses import dataclass, field, asdict
from enum import Enum
import sys


class Environment(str, Enum):
    """运行环境"""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class LogLevel(str, Enum):
    """日志级别"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@dataclass
class DatabaseConfig:
    """数据库配置"""
    host: str = "localhost"
    port: int = 5432
    username: str = "admin"
    password: str = ""
    database: str = "rental_system"
    pool_size: int = 10
    max_overflow: int = 20
    pool_recycle: int = 3600
    echo: bool = False
    
    def get_connection_string(self) -> str:
        """获取连接字符串"""
        if self.password:
            return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        return f"postgresql://{self.username}@{self.host}:{self.port}/{self.database}"


@dataclass
class CacheConfig:
    """缓存配置"""
    enabled: bool = True
    kpi_ttl_seconds: int = 300  # 5分钟
    report_ttl_seconds: int = 600  # 10分钟
    query_ttl_seconds: int = 300  # 5分钟
    kpi_max_size: int = 100
    report_max_size: int = 200
    query_max_size: int = 500


@dataclass
class LoggingConfig:
    """日志配置"""
    level: LogLevel = LogLevel.INFO
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    file_path: Optional[str] = None
    max_bytes: int = 10485760  # 10MB
    backup_count: int = 5
    console_enabled: bool = True
    file_enabled: bool = True


@dataclass
class SecurityConfig:
    """安全配置"""
    secret_key: str = "default-secret-key-change-in-production"
    session_timeout_minutes: int = 30
    password_min_length: int = 8
    max_login_attempts: int = 5
    lockout_duration_minutes: int = 15


@dataclass
class PerformanceConfig:
    """性能配置"""
    max_threads: int = 4
    request_timeout_seconds: int = 30
    slow_query_threshold_ms: int = 500
    enable_profiling: bool = False
    profiling_sample_rate: float = 0.1


@dataclass
class MonitoringConfig:
    """监控配置"""
    enabled: bool = True
    metrics_enabled: bool = True
    error_tracking_enabled: bool = True
    health_check_enabled: bool = True
    health_check_interval_seconds: int = 60


@dataclass
class AppConfig:
    """应用配置"""
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    app_name: str = "速维电脑租赁管理系统"
    version: str = "4.0.0"
    description: str = "Phase 4 production-ready system"
    
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)
    
    def to_json(self, pretty: bool = True) -> str:
        """转换为JSON"""
        if pretty:
            return json.dumps(self.to_dict(), indent=2, ensure_ascii=False, default=str)
        return json.dumps(self.to_dict(), ensure_ascii=False, default=str)


class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_file: Optional[str] = None):
        self.config_file = config_file or self._find_config_file()
        self.config = self._load_config()
        self.logger = self._setup_logging()
    
    def _find_config_file(self) -> Optional[str]:
        """查找配置文件"""
        # 检查环境变量
        if "RENTAL_CONFIG" in os.environ:
            return os.environ["RENTAL_CONFIG"]
        
        # 检查常见位置
        candidates = [
            "config.json",
            ".config/config.json",
            f"{Path.home()}/.rental_system/config.json",
            "/etc/rental_system/config.json",
        ]
        
        for candidate in candidates:
            if os.path.exists(candidate):
                return candidate
        
        return None
    
    def _load_config(self) -> AppConfig:
        """加载配置"""
        config = AppConfig()
        
        # 从环境变量覆盖
        self._load_from_env(config)
        
        # 从配置文件加载
        if self.config_file and os.path.exists(self.config_file):
            self._load_from_file(config)
        
        return config
    
    def _load_from_env(self, config: AppConfig):
        """从环境变量加载配置"""
        # 环境
        if "RENTAL_ENV" in os.environ:
            config.environment = Environment(os.environ["RENTAL_ENV"])
        
        # 调试模式
        if "RENTAL_DEBUG" in os.environ:
            config.debug = os.environ["RENTAL_DEBUG"].lower() in ("true", "1", "yes")
        
        # 数据库配置
        if "RENTAL_DB_HOST" in os.environ:
            config.database.host = os.environ["RENTAL_DB_HOST"]
        if "RENTAL_DB_PORT" in os.environ:
            config.database.port = int(os.environ["RENTAL_DB_PORT"])
        if "RENTAL_DB_USER" in os.environ:
            config.database.username = os.environ["RENTAL_DB_USER"]
        if "RENTAL_DB_PASSWORD" in os.environ:
            config.database.password = os.environ["RENTAL_DB_PASSWORD"]
        if "RENTAL_DB_NAME" in os.environ:
            config.database.database = os.environ["RENTAL_DB_NAME"]
        
        # 缓存配置
        if "RENTAL_CACHE_ENABLED" in os.environ:
            config.cache.enabled = os.environ["RENTAL_CACHE_ENABLED"].lower() in ("true", "1")
        if "RENTAL_CACHE_KPI_TTL" in os.environ:
            config.cache.kpi_ttl_seconds = int(os.environ["RENTAL_CACHE_KPI_TTL"])
        
        # 日志配置
        if "RENTAL_LOG_LEVEL" in os.environ:
            config.logging.level = LogLevel(os.environ["RENTAL_LOG_LEVEL"])
        if "RENTAL_LOG_FILE" in os.environ:
            config.logging.file_path = os.environ["RENTAL_LOG_FILE"]
        
        # 安全配置
        if "RENTAL_SECRET_KEY" in os.environ:
            config.security.secret_key = os.environ["RENTAL_SECRET_KEY"]
        if "RENTAL_SESSION_TIMEOUT" in os.environ:
            config.security.session_timeout_minutes = int(os.environ["RENTAL_SESSION_TIMEOUT"])
    
    def _load_from_file(self, config: AppConfig):
        """从JSON文件加载配置"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self._update_config_from_dict(config, data)
        except Exception as e:
            print(f"警告: 无法加载配置文件 {self.config_file}: {e}")
    
    def _update_config_from_dict(self, config: AppConfig, data: Dict):
        """从字典更新配置"""
        if "environment" in data:
            config.environment = Environment(data["environment"])
        if "debug" in data:
            config.debug = data["debug"]
        if "app_name" in data:
            config.app_name = data["app_name"]
        
        # 数据库配置
        if "database" in data:
            db_data = data["database"]
            for key, value in db_data.items():
                if hasattr(config.database, key):
                    setattr(config.database, key, value)
        
        # 缓存配置
        if "cache" in data:
            cache_data = data["cache"]
            for key, value in cache_data.items():
                if hasattr(config.cache, key):
                    setattr(config.cache, key, value)
        
        # 日志配置
        if "logging" in data:
            log_data = data["logging"]
            for key, value in log_data.items():
                if key == "level" and isinstance(value, str):
                    config.logging.level = LogLevel(value)
                elif hasattr(config.logging, key):
                    setattr(config.logging, key, value)
        
        # 安全配置
        if "security" in data:
            sec_data = data["security"]
            for key, value in sec_data.items():
                if hasattr(config.security, key):
                    setattr(config.security, key, value)
        
        # 性能配置
        if "performance" in data:
            perf_data = data["performance"]
            for key, value in perf_data.items():
                if hasattr(config.performance, key):
                    setattr(config.performance, key, value)
        
        # 监控配置
        if "monitoring" in data:
            mon_data = data["monitoring"]
            for key, value in mon_data.items():
                if hasattr(config.monitoring, key):
                    setattr(config.monitoring, key, value)
    
    def _setup_logging(self) -> logging.Logger:
        """设置日志"""
        logger = logging.getLogger("rental_system")
        logger.setLevel(self.config.logging.level.value)
        
        # 移除已有的处理器
        logger.handlers.clear()
        
        # 创建格式化器
        formatter = logging.Formatter(self.config.logging.format)
        
        # 控制台处理器
        if self.config.logging.console_enabled:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(self.config.logging.level.value)
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)
        
        # 文件处理器
        if self.config.logging.file_enabled and self.config.logging.file_path:
            try:
                log_dir = os.path.dirname(self.config.logging.file_path)
                if log_dir and not os.path.exists(log_dir):
                    os.makedirs(log_dir)
                
                from logging.handlers import RotatingFileHandler
                file_handler = RotatingFileHandler(
                    self.config.logging.file_path,
                    maxBytes=self.config.logging.max_bytes,
                    backupCount=self.config.logging.backup_count
                )
                file_handler.setLevel(self.config.logging.level.value)
                file_handler.setFormatter(formatter)
                logger.addHandler(file_handler)
            except Exception as e:
                logger.warning(f"无法创建文件日志处理器: {e}")
        
        return logger
    
    def get_logger(self, name: str) -> logging.Logger:
        """获取日志记录器"""
        return logging.getLogger(f"rental_system.{name}")
    
    def save_config(self, filepath: str):
        """保存配置到文件"""
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(self.config.to_json())
            self.logger.info(f"配置已保存到 {filepath}")
        except Exception as e:
            self.logger.error(f"保存配置失败: {e}")
            raise
    
    def validate_config(self) -> List[str]:
        """验证配置"""
        errors = []
        
        # 验证数据库配置
        if not self.config.database.host:
            errors.append("数据库主机未配置")
        if self.config.database.port <= 0:
            errors.append("数据库端口无效")
        
        # 验证安全配置
        if self.config.environment == Environment.PRODUCTION:
            if self.config.security.secret_key == "default-secret-key-change-in-production":
                errors.append("生产环境必须更改默认密钥")
            if self.config.debug:
                errors.append("生产环境不应启用调试模式")
        
        # 验证日志配置
        if self.config.logging.file_enabled and not self.config.logging.file_path:
            errors.append("启用文件日志但未指定日志文件路径")
        
        return errors
    
    def get_config(self) -> AppConfig:
        """获取配置"""
        return self.config


# 全局配置实例
_config_manager: Optional[ConfigManager] = None


def get_config_manager() -> ConfigManager:
    """获取配置管理器单例"""
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager


def get_config() -> AppConfig:
    """获取应用配置"""
    return get_config_manager().get_config()


def get_logger(name: str) -> logging.Logger:
    """获取日志记录器"""
    return get_config_manager().get_logger(name)
