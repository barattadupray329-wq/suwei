"""
动态代码加载器
- exe 可以加载最新的源代码
- 自动检查代码更新
- 无需重新打包 exe
"""

import os
import sys
import json
import hashlib
import importlib
import logging
from pathlib import Path
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class CodeLoader:
    """动态代码加载器"""
    
    def __init__(self, source_root: str):
        """
        初始化代码加载器
        
        Args:
            source_root: 源代码根目录
        """
        self.source_root = source_root
        self.modules_dir = os.path.join(source_root, "modules")
        self.code_manifest = os.path.join(source_root, "code_manifest.json")
        self._module_cache = {}
        self._code_hashes = {}
        
        logger.info(f"Code loader initialized for: {source_root}")
    
    def _get_code_hash(self, file_path: str) -> str:
        """计算代码文件的哈希值"""
        try:
            if not os.path.exists(file_path):
                return ""
            
            hash_md5 = hashlib.md5()
            with open(file_path, 'rb') as f:
                hash_md5.update(f.read())
            return hash_md5.hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate hash for {file_path}: {e}")
            return ""
    
    def _generate_code_manifest(self) -> Dict:
        """生成代码清单"""
        manifest = {
            "generated_at": str(__import__('datetime').datetime.now()),
            "modules": {},
        }
        
        if not os.path.exists(self.modules_dir):
            return manifest
        
        # 遍历所有 .py 文件
        for root, dirs, files in os.walk(self.modules_dir):
            for file in files:
                if file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, self.source_root)
                    
                    file_hash = self._get_code_hash(file_path)
                    manifest["modules"][rel_path] = {
                        "hash": file_hash,
                        "size": os.path.getsize(file_path),
                    }
        
        logger.info(f"Generated code manifest with {len(manifest['modules'])} modules")
        return manifest
    
    def save_code_manifest(self):
        """保存代码清单到文件"""
        try:
            manifest = self._generate_code_manifest()
            with open(self.code_manifest, 'w', encoding='utf-8') as f:
                json.dump(manifest, f, ensure_ascii=False, indent=2)
            logger.info(f"Code manifest saved to {self.code_manifest}")
        except Exception as e:
            logger.error(f"Failed to save code manifest: {e}")
    
    def load_code_manifest(self) -> Dict:
        """加载代码清单"""
        try:
            if not os.path.exists(self.code_manifest):
                logger.warning("Code manifest not found, generating...")
                return self._generate_code_manifest()
            
            with open(self.code_manifest, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load code manifest: {e}")
            return self._generate_code_manifest()
    
    def check_code_updates(self) -> bool:
        """
        检查是否有代码更新
        
        Returns:
            是否有更新
        """
        try:
            current_manifest = self._generate_code_manifest()
            saved_manifest = self.load_code_manifest()
            
            current_modules = current_manifest.get("modules", {})
            saved_modules = saved_manifest.get("modules", {})
            
            # 检查新增或修改的文件
            for path, info in current_modules.items():
                saved_info = saved_modules.get(path)
                if not saved_info or saved_info['hash'] != info['hash']:
                    logger.info(f"Code update detected: {path}")
                    return True
            
            # 检查删除的文件
            for path in saved_modules:
                if path not in current_modules:
                    logger.info(f"Code removed: {path}")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking code updates: {e}")
            return False
    
    def load_module_from_source(self, module_name: str):
        """
        从源代码动态加载模块
        
        Args:
            module_name: 模块名称（如 'rental_mgmt'）
        
        Returns:
            加载的模块
        """
        try:
            # 确保 modules 文件夹在 Python 路径中
            if self.modules_dir not in sys.path:
                sys.path.insert(0, self.modules_dir)
            
            logger.info(f"Loading module from source: {module_name}")
            
            # 动态导入
            module = importlib.import_module(module_name)
            
            # 重新加载，确保获取最新版本
            module = importlib.reload(module)
            
            logger.info(f"Module loaded successfully: {module_name}")
            return module
            
        except Exception as e:
            logger.error(f"Failed to load module {module_name}: {e}")
            return None
    
    def reload_all_modules(self):
        """重新加载所有模块"""
        try:
            logger.info("Reloading all modules...")
            
            # 重新加载已导入的模块
            for module_name, module in list(sys.modules.items()):
                if 'modules' in module_name and hasattr(module, '__file__'):
                    try:
                        importlib.reload(module)
                        logger.debug(f"Reloaded: {module_name}")
                    except Exception as e:
                        logger.warning(f"Failed to reload {module_name}: {e}")
            
            logger.info("All modules reloaded")
            
        except Exception as e:
            logger.error(f"Error reloading modules: {e}")
    
    def get_module_version_info(self, module_name: str) -> Dict:
        """获取模块版本信息"""
        try:
            module_path = os.path.join(self.modules_dir, f"{module_name}.py")
            
            if not os.path.exists(module_path):
                return None
            
            return {
                "name": module_name,
                "path": module_path,
                "hash": self._get_code_hash(module_path),
                "size": os.path.getsize(module_path),
                "modified": os.path.getmtime(module_path),
            }
            
        except Exception as e:
            logger.error(f"Failed to get module version info: {e}")
            return None


# 全局实例
_code_loader: Optional[CodeLoader] = None


def init_code_loader(source_root: str) -> CodeLoader:
    """初始化全局代码加载器"""
    global _code_loader
    _code_loader = CodeLoader(source_root)
    return _code_loader


def get_code_loader() -> Optional[CodeLoader]:
    """获取全局代码加载器"""
    return _code_loader
