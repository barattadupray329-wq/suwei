#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单机版配置 - 本地存储，无网络同步
"""

VERSION_NAME = "standalone"
VERSION_DISPLAY = "速维电脑租赁管理系统 - 单机版"
VERSION_NUMBER = "2.1.0"

# 同步配置 - 单机版禁用所有网络同步
SYNC_ENABLED = False
NUTSTORE_SYNC = False
HTTP_SERVER_ENABLED = False
LAN_SYNC = False

# 数据存储配置
DATA_DIR = "data"
BACKUP_ENABLED = True
BACKUP_INTERVAL = 3600  # 每小时备份

# 功能配置
AI_ASSISTANT_ENABLED = True
HARDWARE_MANAGEMENT_ENABLED = True
MULTI_USER_ENABLED = True
REPORTS_ENABLED = True
