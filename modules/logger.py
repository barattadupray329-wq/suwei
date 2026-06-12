#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一日志记录模块
"""

import logging
import os
from datetime import datetime

_LOG = None


def get_logger(name="RentalSystem", log_dir=None):
    global _LOG
    if _LOG:
        return _LOG
    if log_dir is None:
        log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"RentalSystem_{datetime.now().strftime('%Y%m%d')}.log")

    _LOG = logging.getLogger(name)
    _LOG.setLevel(logging.DEBUG)
    if not _LOG.handlers:
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        fh.setFormatter(fmt)
        _LOG.addHandler(fh)
        ch = logging.StreamHandler()
        ch.setLevel(logging.WARNING)
        ch.setFormatter(fmt)
        _LOG.addHandler(ch)
    return _LOG
