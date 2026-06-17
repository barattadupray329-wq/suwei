#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生产环境部署验证脚本
用于验证速维电脑租赁管理系统 v2 的部署前置条件
"""

import sys
import os
import subprocess
import platform
import json
from pathlib import Path
from datetime import datetime

# 颜色定义
class Colors:
    INFO = '\033[94m'      # 蓝色
    SUCCESS = '\033[92m'   # 绿色
    ERROR = '\033[91m'     # 红色
    WARNING = '\033[93m'   # 黄色
    MAGENTA = '\033[95m'   # 紫色
    CYAN = '\033[96m'      # 青色
    ENDC = '\033[0m'       # 无颜色


def get_timestamp():
    """获取格式化的时间戳"""
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def print_info(message):
    """打印信息"""
    print(f"{Colors.INFO}[INFO]{Colors.ENDC} {get_timestamp()} - {message}")


def print_success(message):
    """打印成功信息"""
    print(f"{Colors.SUCCESS}[SUCCESS]{Colors.ENDC} {get_timestamp()} - {message}")


def print_error(message):
    """打印错误信息"""
    print(f"{Colors.ERROR}[ERROR]{Colors.ENDC} {get_timestamp()} - {message}")


def print_warning(message):
    """打印警告信息"""
    print(f"{Colors.WARNING}[WARNING]{Colors.ENDC} {get_timestamp()} - {message}")


def print_header(title):
    """打印标题"""
    line = "=" * 80
    print(f"\n{Colors.MAGENTA}{line}{Colors.ENDC}")
    print_success(title)
    print(f"{Colors.MAGENTA}{line}{Colors.ENDC}\n")


def check_command(command, description):
    """检查命令是否可用"""
    try:
        result = subprocess.run(
            command if isinstance(command, list) else [command],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            output = result.stdout.strip()
            print_success(f"{description} 已安装: {output}")
            return True
        else:
            print_error(f"{description} 未安装或出错")
            return False
    except Exception as e:
        print_error(f"{description} 检查失败: {str(e)}")
        return False


def check_prerequisites():
    """检查前置条件"""
    print_info("检查前置条件...")
    
    checks = [
        (["python", "--version"], "Python"),
        (["pip", "--version"], "pip"),
        (["git", "--version"], "Git"),
    ]
    
    all_ok = True
    for command, description in checks:
        if not check_command(command, description):
            all_ok = False
    
    # 检查环境变量
    if not os.getenv('DB_PASSWORD'):
        print_warning("环境变量 DB_PASSWORD 未设置")
    
    if not os.getenv('SECRET_KEY'):
        print_warning("环境变量 SECRET_KEY 未设置")
    
    return all_ok


def check_dependencies():
    """检查项目依赖"""
    print_info("检查项目依赖...")
    
    project_root = Path(__file__).parent.parent
    requirements_file = project_root / "requirements.txt"
    
    if requirements_file.exists():
        print_success("requirements.txt 已找到")
        
        required_packages = ["flask", "requests", "cryptography"]
        
        for pkg in required_packages:
            try:
                result = subprocess.run(
                    ["pip", "show", pkg],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    print_success(f"  ✓ {pkg} 已安装")
                else:
                    print_warning(f"  ✗ {pkg} 未安装")
            except Exception as e:
                print_warning(f"  ✗ {pkg} 检查失败: {str(e)}")
    else:
        print_warning("requirements.txt 未找到")


def check_module_imports():
    """测试模块导入"""
    print_info("测试关键模块导入...")
    
    modules = {
        "core.app": "主应用模块",
        "core.report_engine": "报表引擎",
        "core.cache_manager": "缓存管理器",
        "core.config": "配置管理器",
        "core.auth": "认证模块",
    }
    
    for module_name, description in modules.items():
        try:
            __import__(module_name)
            print_success(f"✓ {description} ({module_name}) - 导入成功")
        except ImportError as e:
            print_warning(f"✗ {description} ({module_name}) - 导入失败: {str(e)}")
        except Exception as e:
            print_warning(f"✗ {description} ({module_name}) - 导入失败: {str(e)}")


def check_configuration():
    """检查配置文件"""
    print_info("检查配置文件...")
    
    project_root = Path(__file__).parent.parent
    config_files = [
        project_root / "config.production.json",
        project_root / "requirements.txt",
        project_root / "DEPLOYMENT_CHECKLIST.md",
    ]
    
    for config_file in config_files:
        if config_file.exists():
            size_kb = config_file.stat().st_size / 1024
            print_success(f"✓ {config_file.name} - {size_kb:.1f}KB")
        else:
            print_warning(f"✗ {config_file.name} - 未找到")


def get_system_info():
    """获取系统信息"""
    print(f"{Colors.CYAN}系统信息:{Colors.ENDC}")
    print(f"  操作系统: {platform.system()} {platform.release()}")
    print(f"  处理器: {platform.processor()}")
    print(f"  Python 版本: {platform.python_version()}")
    print(f"  工作目录: {os.getcwd()}")
    print()


def generate_deployment_report():
    """生成部署就绪报告"""
    print_header("部署就绪性检查报告")
    
    print_info(f"时间: {get_timestamp()}")
    print_info(f"系统: {platform.system()}")
    print()
    
    get_system_info()
    
    print(f"{Colors.CYAN}部署前置条件检查:{Colors.ENDC}")
    prereq_ok = check_prerequisites()
    print()
    
    print(f"{Colors.CYAN}依赖检查:{Colors.ENDC}")
    check_dependencies()
    print()
    
    print(f"{Colors.CYAN}配置文件检查:{Colors.ENDC}")
    check_configuration()
    print()
    
    print(f"{Colors.CYAN}模块导入测试:{Colors.ENDC}")
    check_module_imports()
    print()
    
    print(f"{Colors.CYAN}部署建议:{Colors.ENDC}")
    print("  1. 在 Linux/Unix 生产服务器上运行原始的 Bash 部署脚本")
    print("  2. 使用 Gunicorn + systemd 来管理应用进程")
    print("  3. 配置以下环境变量:")
    print("     - DB_PASSWORD (数据库密码)")
    print("     - SECRET_KEY (应用密钥)")
    print("     - BACKUP_ENCRYPTION_KEY (备份加密密钥)")
    print("     - PROD_DOMAIN (生产域名)")
    print("  4. 执行部署步骤:")
    print("     a. 备份现有系统")
    print("     b. 克隆/更新代码")
    print("     c. 安装依赖")
    print("     d. 运行数据库迁移")
    print("     e. 初始化缓存")
    print("     f. 配置 systemd 服务")
    print("     g. 启动应用")
    print("     h. 验证部署")
    print()
    
    line = "=" * 80
    print(f"{Colors.MAGENTA}{line}{Colors.ENDC}")
    if prereq_ok:
        print_success("✓ 所有前置条件已满足，系统已准备好部署")
    else:
        print_error("✗ 部分前置条件未满足，请解决后重试")
    print(f"{Colors.MAGENTA}{line}{Colors.ENDC}\n")


def main():
    """主程序"""
    print()
    print("=" * 80)
    print(f"{Colors.MAGENTA}速维电脑租赁管理系统 v2 - 生产部署验证脚本{Colors.ENDC}")
    print("=" * 80)
    print()
    
    try:
        generate_deployment_report()
        print_info("部署验证完成！请根据上述报告进行相应的部署前准备。\n")
        return 0
    except Exception as e:
        print_error(f"执行过程中出错: {str(e)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
