#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
客户端配置脚本 - 其他电脑上运行此脚本来配置服务器地址
"""

import json
import os
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "sync_client_config.json"


def create_default_config():
    """创建默认配置文件"""
    default_config = {
        "server_url": "http://192.168.1.100:9999",  # 请修改为你主电脑的 IP
        "check_interval": 60,
        "auto_update": True,
        "data_sync_enabled": True,
        "log_level": "INFO"
    }
    
    print("=" * 60)
    print("🔧 速维电脑租赁管理系统 - 客户端配置")
    print("=" * 60)
    print("\n请输入主电脑的 IP 地址和端口（默认：192.168.1.100:9999）")
    print("格式: http://IP:端口 (例如: http://192.168.1.100:9999)")
    print()
    
    server_url = input("📍 服务器地址 [http://192.168.1.100:9999]: ").strip()
    if not server_url:
        server_url = default_config["server_url"]
    
    # 验证 URL 格式
    if not server_url.startswith("http://") and not server_url.startswith("https://"):
        server_url = "http://" + server_url
    
    default_config["server_url"] = server_url
    
    print("\n⚙️  其他设置:")
    print()
    
    check_interval = input("检查更新间隔（秒）[60]: ").strip()
    if check_interval:
        default_config["check_interval"] = int(check_interval)
    
    auto_update = input("自动更新（y/n）[y]: ").strip().lower()
    default_config["auto_update"] = auto_update != 'n'
    
    data_sync = input("启用数据同步（y/n）[y]: ").strip().lower()
    default_config["data_sync_enabled"] = data_sync != 'n'
    
    # 保存配置
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=2, ensure_ascii=False)
        
        print("\n" + "=" * 60)
        print("✅ 配置已保存到:", CONFIG_FILE)
        print("=" * 60)
        print("\n配置内容:")
        print(json.dumps(default_config, indent=2, ensure_ascii=False))
        print("\n" + "=" * 60)
        
        return default_config
    
    except Exception as e:
        print(f"\n❌ 配置保存失败: {e}")
        return None


def load_config() -> dict:
    """加载配置文件"""
    if not CONFIG_FILE.exists():
        return None
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None


def test_connection(server_url: str) -> bool:
    """测试与服务器的连接"""
    try:
        import requests
        print(f"\n🔗 测试连接到: {server_url}")
        response = requests.get(
            f"{server_url}/api/status",
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 连接成功！")
            print(f"   服务器状态: {data.get('status')}")
            print(f"   更新包数量: {data.get('update_packages')}")
            print(f"   时间戳: {data.get('timestamp')}")
            return True
        else:
            print(f"❌ 服务器返回错误: {response.status_code}")
            return False
    
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        return False


def main():
    """主函数"""
    print("\n")
    
    # 检查是否已有配置
    config = load_config()
    if config:
        print(f"✅ 找到已保存的配置: {CONFIG_FILE}")
        print(f"   服务器地址: {config['server_url']}")
        print()
        
        option = input("选择操作 (1=测试连接, 2=重新配置, 3=查看配置, 0=退出) [1]: ").strip()
        if not option or option == '1':
            test_connection(config['server_url'])
        elif option == '2':
            config = create_default_config()
            if config:
                test_connection(config['server_url'])
        elif option == '3':
            print("\n" + "=" * 60)
            print("📄 当前配置:")
            print("=" * 60)
            print(json.dumps(config, indent=2, ensure_ascii=False))
    
    else:
        print("❌ 未找到配置文件")
        print("创建新配置...")
        print()
        
        config = create_default_config()
        if config:
            test_connection(config['server_url'])
    
    print()


if __name__ == '__main__':
    main()
