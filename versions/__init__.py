#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
版本选择器 - 根据配置路由到对应版本
"""
import sys
import os
from pathlib import Path

# 版本配置映射
VERSIONS = {
    "standalone": "速维电脑租赁管理系统 - 单机版",
    "network": "速维电脑租赁管理系统 - 网络版",
    "lan": "速维电脑租赁管理系统 - 局域网版",
}

def get_version_entry(version_name: str):
    """获取指定版本的入口模块"""
    version_map = {
        "standalone": "versions.standalone.main",
        "network": "versions.network.main",
        "lan": "versions.lan.main",
    }
    
    if version_name not in version_map:
        raise ValueError(f"未知版本: {version_name}. 可用版本: {list(version_map.keys())}")
    
    return version_map[version_name]

def select_version():
    """版本选择逻辑"""
    # 默认使用网络版（当前主要开发版本）
    return "network"
