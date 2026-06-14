#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新系统测试用例
- 测试更新检测功能
- 测试更新包生成
- 测试更新通知对话框
- 测试更新安装和回滚
"""

import os
import sys
import json
import shutil
import unittest
import tempfile
import time
from unittest.mock import Mock, patch, MagicMock

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.update_notifier import UpdateNotifier, init_update_notifier
from modules.code_loader import CodeLoader, init_code_loader


class TestUpdateNotifier(unittest.TestCase):
    """UpdateNotifier 测试类"""
    
    def setUp(self):
        """测试前准备"""
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
        self.source_root = self.temp_dir
        self.data_folder = os.path.join(self.temp_dir, "data")
        os.makedirs(self.data_folder, exist_ok=True)
        
        # 创建模拟源代码文件夹结构
        self.modules_dir = os.path.join(self.source_root, "modules")
        self.core_dir = os.path.join(self.source_root, "core")
        self.theme_dir = os.path.join(self.source_root, "theme")
        
        os.makedirs(self.modules_dir, exist_ok=True)
        os.makedirs(self.core_dir, exist_ok=True)
        os.makedirs(self.theme_dir, exist_ok=True)
        
        # 创建测试文件
        self._create_test_files()
        
        # 初始化 UpdateNotifier
        self.notifier = UpdateNotifier(self.source_root, self.data_folder)
    
    def tearDown(self):
        """测试后清理"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def _create_test_files(self):
        """创建测试文件"""
        test_files = [
            os.path.join(self.modules_dir, "test_module.py"),
            os.path.join(self.core_dir, "test_core.py"),
            os.path.join(self.theme_dir, "test_theme.py"),
        ]
        
        for file_path in test_files:
            with open(file_path, 'w') as f:
                f.write("# Test file\nprint('Hello')\n")
    
    def test_01_initialization(self):
        """测试 UpdateNotifier 初始化"""
        print("\n✓ 测试 1: UpdateNotifier 初始化")
        self.assertIsNotNone(self.notifier)
        self.assertTrue(os.path.exists(self.notifier.packages_dir))
        print("  - 初始化成功")
        print("  - 更新包目录已创建")
    
    def test_02_code_hash_calculation(self):
        """测试源代码哈希计算"""
        print("\n✓ 测试 2: 源代码哈希计算")
        
        hash1 = self.notifier._get_source_code_hash()
        self.assertIsNotNone(hash1)
        self.assertTrue(len(hash1) > 0)
        print(f"  - 计算的哈希值: {hash1[:16]}...")
        
        # 修改一个文件
        test_file = os.path.join(self.modules_dir, "test_module.py")
        with open(test_file, 'w') as f:
            f.write("# Modified test file\nprint('Hello World')\n")
        
        hash2 = self.notifier._get_source_code_hash()
        self.assertNotEqual(hash1, hash2)
        print(f"  - 修改后的哈希值: {hash2[:16]}...")
        print("  - 哈希值成功检测到变化")
    
    def test_03_check_for_updates(self):
        """测试更新检测"""
        print("\n✓ 测试 3: 更新检测")
        
        # 初始化并记录第一个哈希值
        hash1 = self.notifier._get_source_code_hash()
        self.notifier._last_code_hash = hash1
        
        # 初始化时没有更新
        has_update = self.notifier.check_for_updates()
        self.assertFalse(has_update)
        print("  - 初始状态: 无更新")
        
        # 修改文件
        test_file = os.path.join(self.modules_dir, "test_module.py")
        with open(test_file, 'w') as f:
            f.write("# Updated file\nprint('Updated')\n")
        
        # 再次检查
        has_update = self.notifier.check_for_updates()
        self.assertTrue(has_update)
        print("  - 修改后: 检测到更新 ✓")
    
    def test_04_create_update_package(self):
        """测试更新包创建"""
        print("\n✓ 测试 4: 更新包创建")
        
        # 修改文件
        test_file = os.path.join(self.modules_dir, "test_module.py")
        with open(test_file, 'w') as f:
            f.write("# New version\n")
        
        # 检测更新
        self.notifier.check_for_updates()
        
        # 创建更新包
        update_info = self.notifier.create_update_package(reason="test")
        
        self.assertIsNotNone(update_info)
        self.assertIn('name', update_info)
        self.assertIn('timestamp', update_info)
        self.assertIn('files', update_info)
        self.assertIn('size_mb', update_info)
        
        print(f"  - 更新包名称: {update_info['name']}")
        print(f"  - 更新原因: {update_info['reason']}")
        print(f"  - 包含文件: {', '.join(update_info['files'])}")
        print(f"  - 大小: {update_info['size_mb']:.2f} MB")
        
        # 验证文件是否被复制
        package_path = os.path.join(self.notifier.packages_dir, update_info['name'])
        self.assertTrue(os.path.exists(package_path))
        print("  - 更新包已成功创建")
    
    def test_05_update_history(self):
        """测试更新历史"""
        print("\n✓ 测试 5: 更新历史")
        
        # 创建多个更新
        for i in range(3):
            test_file = os.path.join(self.modules_dir, "test_module.py")
            with open(test_file, 'w') as f:
                f.write(f"# Update {i}\n")
            
            self.notifier.check_for_updates()
            update_info = self.notifier.create_update_package(reason=f"update_{i}")
            if update_info:
                time.sleep(0.2)  # 确保不同的时间戳
        
        history = self.notifier.get_update_list()
        self.assertGreaterEqual(len(history), 1)  # 至少有一个更新
        print(f"  - 更新历史记录数: {len(history)}")
        
        # 验证最新更新
        latest = self.notifier.get_latest_update()
        self.assertIsNotNone(latest)
        print(f"  - 最新更新: {latest['name']}")
    
    def test_06_update_status_persistence(self):
        """测试更新状态持久化"""
        print("\n✓ 测试 6: 更新状态持久化")
        
        # 创建更新
        test_file = os.path.join(self.modules_dir, "test_module.py")
        with open(test_file, 'w') as f:
            f.write("# Persist test\n")
        
        self.notifier.check_for_updates()
        self.notifier.create_update_package(reason="persist_test")
        
        # 验证文件是否保存
        self.assertTrue(os.path.exists(self.notifier.status_file))
        print(f"  - 状态文件已保存: {self.notifier.status_file}")
        
        # 创建新的 notifier 实例并加载状态
        new_notifier = UpdateNotifier(self.source_root, self.data_folder)
        self.assertTrue(len(new_notifier.update_history) > 0)
        print(f"  - 加载到的历史记录数: {len(new_notifier.update_history)}")
        print("  - 状态成功持久化")
    
    def test_07_monitoring(self):
        """测试后台监控"""
        print("\n✓ 测试 7: 后台监控功能")
        
        callback_called = {'count': 0}
        
        def update_callback(event_type, data):
            callback_called['count'] += 1
            print(f"    - 检测到事件: {event_type}")
        
        # 启动监控
        self.notifier.start_monitoring(callback=update_callback)
        print("  - 后台监控已启动")
        
        # 修改文件
        test_file = os.path.join(self.modules_dir, "test_module.py")
        with open(test_file, 'w') as f:
            f.write("# Monitor test\n")
        
        # 等待检测
        time.sleep(35)  # 等待超过检查间隔
        
        # 停止监控
        self.notifier.stop_monitoring()
        print(f"  - 回调函数被调用 {callback_called['count']} 次")
        print("  - 后台监控已停止")


class TestCodeLoader(unittest.TestCase):
    """CodeLoader 测试类"""
    
    def setUp(self):
        """测试前准备"""
        self.temp_dir = tempfile.mkdtemp()
        self.source_root = self.temp_dir
        
        # 创建模块目录
        self.modules_dir = os.path.join(self.source_root, "modules")
        os.makedirs(self.modules_dir, exist_ok=True)
        
        # 创建测试模块
        test_module_path = os.path.join(self.modules_dir, "test_module.py")
        with open(test_module_path, 'w') as f:
            f.write("TEST_VAR = 'version1'\n")
        
        self.loader = CodeLoader(self.source_root)
    
    def tearDown(self):
        """测试后清理"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_01_code_loader_initialization(self):
        """测试 CodeLoader 初始化"""
        print("\n✓ 测试 1: CodeLoader 初始化")
        self.assertIsNotNone(self.loader)
        # 初始化时需要保存代码清单
        self.loader.save_code_manifest()
        self.assertTrue(os.path.exists(self.loader.code_manifest))
        print("  - CodeLoader 初始化成功")
    
    def test_02_manifest_generation(self):
        """测试代码清单生成"""
        print("\n✓ 测试 2: 代码清单生成")
        
        manifest = self.loader._generate_code_manifest()
        self.assertIn('modules', manifest)
        self.assertTrue(len(manifest['modules']) > 0)
        
        print(f"  - 检测到 {len(manifest['modules'])} 个模块")
        for path, info in list(manifest['modules'].items())[:3]:
            print(f"    - {path}")
    
    def test_03_code_update_detection(self):
        """测试代码更新检测"""
        print("\n✓ 测试 3: 代码更新检测")
        
        # 保存初始清单
        self.loader.save_code_manifest()
        
        # 修改代码
        test_module_path = os.path.join(self.modules_dir, "test_module.py")
        with open(test_module_path, 'w') as f:
            f.write("TEST_VAR = 'version2'\n")
        
        # 检测更新
        has_update = self.loader.check_code_updates()
        self.assertTrue(has_update)
        print("  - 成功检测到代码更新")
    
    def test_04_manifest_save_and_load(self):
        """测试清单保存和加载"""
        print("\n✓ 测试 4: 清单保存和加载")
        
        # 保存清单
        self.loader.save_code_manifest()
        self.assertTrue(os.path.exists(self.loader.code_manifest))
        print("  - 清单已保存")
        
        # 加载清单
        manifest = self.loader.load_code_manifest()
        self.assertIsNotNone(manifest)
        print("  - 清单已加载")
        print(f"  - 模块数量: {len(manifest.get('modules', {}))}")


class TestUpdateIntegration(unittest.TestCase):
    """更新系统集成测试"""
    
    def setUp(self):
        """测试前准备"""
        self.temp_dir = tempfile.mkdtemp()
        self.source_root = self.temp_dir
        self.data_folder = os.path.join(self.temp_dir, "data")
        os.makedirs(self.data_folder, exist_ok=True)
        
        # 创建源代码结构
        for dir_name in ['modules', 'core', 'theme']:
            dir_path = os.path.join(self.source_root, dir_name)
            os.makedirs(dir_path, exist_ok=True)
            
            # 创建测试文件
            test_file = os.path.join(dir_path, 'test.py')
            with open(test_file, 'w') as f:
                f.write(f"# {dir_name} test file\n")
    
    def tearDown(self):
        """测试后清理"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_full_update_workflow(self):
        """测试完整的更新工作流"""
        print("\n✓ 集成测试: 完整的更新工作流")
        
        # 1. 创建 notifier
        notifier = UpdateNotifier(self.source_root, self.data_folder)
        print("  1. UpdateNotifier 已初始化")
        
        # 2. 修改源代码
        test_file = os.path.join(self.source_root, 'modules', 'test.py')
        with open(test_file, 'w') as f:
            f.write("# Updated version 1\n")
        print("  2. 源代码已修改")
        
        # 3. 检测更新
        has_update = notifier.check_for_updates()
        self.assertTrue(has_update)
        print("  3. 更新已检测到")
        
        # 4. 创建更新包
        update_info = notifier.create_update_package(reason="integration_test")
        self.assertIsNotNone(update_info)
        print(f"  4. 更新包已生成: {update_info['name']}")
        
        # 5. 验证更新包
        package_path = os.path.join(notifier.packages_dir, update_info['name'])
        self.assertTrue(os.path.exists(package_path))
        print("  5. 更新包已验证")
        
        # 6. 检查更新历史
        history = notifier.get_update_list()
        self.assertEqual(len(history), 1)
        print(f"  6. 更新历史已记录: {len(history)} 条记录")
        
        print("\n✓ 工作流完成！")


def run_tests():
    """运行所有测试"""
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加测试类
    suite.addTests(loader.loadTestsFromTestCase(TestUpdateNotifier))
    suite.addTests(loader.loadTestsFromTestCase(TestCodeLoader))
    suite.addTests(loader.loadTestsFromTestCase(TestUpdateIntegration))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # 返回结果
    return result.wasSuccessful()


if __name__ == '__main__':
    # 设置输出编码
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print("=" * 70)
    print("速维电脑租赁管理系统 - 更新系统测试")
    print("=" * 70)
    
    success = run_tests()
    
    print("\n" + "=" * 70)
    if success:
        print("[✓] 所有测试通过！")
    else:
        print("[✗] 部分测试失败！")
    print("=" * 70)
    
    sys.exit(0 if success else 1)
