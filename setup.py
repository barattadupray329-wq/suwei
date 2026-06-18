#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyInstaller 配置脚本
生成单个 exe 文件，包含所有依赖
"""

import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# 获取项目根目录
PROJ_ROOT = os.path.dirname(os.path.abspath(__file__))

# 需要包含的隐藏导入
hiddenimports = [
    'tkinter',
    'tkinter.ttk',
    'tkinter.messagebox',
    'tkinter.filedialog',
    'sqlite3',
    'json',
    'csv',
    'subprocess',
    'threading',
    'logging',
    'pathlib',
    'datetime',
    'requests',
    'update_server',
    'http.server',
    'urllib.request',
    'urllib.parse',
    'socketserver',
]

# 数据文件和文件夹
datas = [
    (os.path.join(PROJ_ROOT, 'theme'), 'theme'),
    (os.path.join(PROJ_ROOT, 'modules'), 'modules'),
    (os.path.join(PROJ_ROOT, 'core'), 'core'),
]

# PyInstaller 分析选项
a = Analysis(
    [os.path.join(PROJ_ROOT, 'main.py')],
    pathex=[PROJ_ROOT],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludedimports=[],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='速维租赁管理系统',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # 不显示控制台窗口
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(PROJ_ROOT, 'suwei_icon.ico') if os.path.exists(os.path.join(PROJ_ROOT, 'suwei_icon.ico')) else None,
)
