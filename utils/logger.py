#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
应用日志模块
提供统一的日志记录功能，替代 print() 输出
"""

import logging
import os
from datetime import datetime
from pathlib import Path


class AppLogger:
    """应用日志管理器"""
    
    _instance = None
    _logger = None
    
    @classmethod
    def get_logger(cls, name="suwei_app"):
        """获取或创建日志记录器"""
        if cls._logger is None:
            cls._logger = cls._setup_logger(name)
        return cls._logger
    
    @classmethod
    def _setup_logger(cls, name):
        """配置日志记录器"""
        logger = logging.getLogger(name)
        
        # 避免重复添加 handler
        if logger.handlers:
            return logger
        
        logger.setLevel(logging.DEBUG)
        
        # 日志目录
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        
        # 日志文件（按天滚动）
        log_file = log_dir / f"app_{datetime.now().strftime('%Y%m%d')}.log"
        
        # 文件处理器
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(module)s:%(lineno)d - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
        
        # 控制台处理器（开发调试用）
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(levelname)s: %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)
        
        return logger
    
    @classmethod
    def info(cls, message):
        cls.get_logger().info(message)
    
    @classmethod
    def warning(cls, message):
        cls.get_logger().warning(message)
    
    @classmethod
    def error(cls, message):
        cls.get_logger().error(message)
    
    @classmethod
    def debug(cls, message):
        cls.get_logger().debug(message)


# 便捷函数
def get_logger(name="suwei_app"):
    return AppLogger.get_logger(name)

def log_info(message):
    AppLogger.info(message)

def log_warning(message):
    AppLogger.warning(message)

def log_error(message):
    AppLogger.error(message)

def log_debug(message):
    AppLogger.debug(message)
