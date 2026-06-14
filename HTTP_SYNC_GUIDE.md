# HTTP 跨电脑同步方案 - 快速启动指南

## 📋 概述

这是一个**无需任何额外软件安装**的跨电脑同步方案。主电脑运行一个简单的 HTTP 服务器，其他电脑通过网络访问它来：
- ✅ 下载软件更新包
- ✅ 同步数据文件

---

## 🚀 快速开始

### 步骤 1：主电脑启动服务器

在主电脑上运行：

```bash
python update_server.py
```

你会看到类似这样的输出：

```
============================================================
🚀 速维电脑租赁管理系统 - 更新服务器启动
============================================================
📍 本机 IP: 192.168.1.100
🔗 访问地址: http://192.168.1.100:9999
📦 更新包文件夹: D:\Python项目\速维电脑租赁管理系统_v2\租赁数据\.update_packages
📂 数据文件夹: D:\Python项目\速维电脑租赁管理系统_v2\租赁数据
============================================================
其他电脑的 exe 配置服务器地址为:
   http://192.168.1.100:9999
============================================================
按 Ctrl+C 停止服务器
============================================================
```

**重要**: 记住你的 IP 地址（例如 `192.168.1.100`）

---

### 步骤 2：验证服务器运行

在任何浏览器中打开：
```
http://192.168.1.100:9999
```

你应该看到一个绿色的状态页面，显示：
- ✅ 运行中
- 更新包数量
- 数据文件夹位置

---

### 步骤 3：其他电脑配置 exe

在其他电脑的 exe 配置文件中（或主程序中）添加：

```python
from update_client import UpdateClient

# 创建客户端（替换为你的服务器 IP）
client = UpdateClient("http://192.168.1.100:9999")

# 检查服务器状态
if client.check_server_status():
    # 下载最新的更新包
    updates = client.get_available_updates()
    if updates:
        latest_update = updates[0]
        client.download_update(latest_update['name'], '.update_packages/latest.zip')
    
    # 同步数据文件
    client.sync_data_files('./rental_data')
```

---

## 🔄 完整的同步流程

### 主电脑上：

1. **修改源代码**
   ```
   修改 modules/, core/, theme/ 文件夹中的代码
   ```

2. **生成更新包**
   ```
   UpdateNotifier 自动检测变化
   → 生成 .zip 更新包
   → 保存到 租赁数据\.update_packages\ 文件夹
   ```

3. **服务器提供访问**
   ```
   update_server.py 运行
   → 其他电脑可以访问 http://IP:9999/api/updates/list
   ```

### 其他电脑上：

1. **exe 启动**
   ```
   定期检查 http://主电脑IP:9999/api/updates/list
   ```

2. **有新更新时**
   ```
   下载更新包 → 解压 → 替换代码 → 重启应用
   ```

3. **数据同步**
   ```
   同时从服务器同步 租赁数据 文件夹
   ```

---

## 📡 API 端点

| 端点 | 说明 |
|------|------|
| `/api/status` | 获取服务器状态 |
| `/api/updates/list` | 获取可用更新列表 |
| `/api/updates/download/{filename}` | 下载更新包 |
| `/api/data/list` | 获取数据文件列表 |
| `/api/data/download/{filepath}` | 下载数据文件 |

---

## 🔧 配置文件示例

在主电脑的配置文件中指定：

```json
{
  "sync": {
    "server_url": "http://192.168.1.100:9999",
    "check_interval": 30,
    "auto_update": true,
    "data_sync_enabled": true
  }
}
```

在其他电脑的配置文件中：

```json
{
  "sync": {
    "server_url": "http://192.168.1.100:9999",
    "check_interval": 60,
    "auto_update": false,
    "data_sync_enabled": true
  }
}
```

---

## ⚙️ 高级配置

### 修改服务器端口

编辑 `update_server.py`，找到 `main()` 函数：

```python
def main():
    port = 9999  # ← 改这个数字
    local_ip = get_local_ip()
    ...
```

### 修改客户端超时时间

在 `update_client.py` 中：

```python
client = UpdateClient("http://192.168.1.100:9999")
client.timeout = 20  # 修改超时时间（秒）
```

---

## 🐛 故障排查

### 问题 1：其他电脑无法连接

**解决**：
1. 检查防火墙是否允许 9999 端口
2. 确保主电脑上的 `update_server.py` 仍在运行
3. 检查 IP 地址是否正确

```bash
# Windows 上允许防火墙
netsh advfirewall firewall add rule name="Update Server" dir=in action=allow protocol=tcp localport=9999
```

### 问题 2：下载很慢

**解决**：
1. 检查网络连接
2. 减少同时下载的文件数量
3. 增加超时时间：`client.timeout = 30`

### 问题 3：更新包没有出现

**解决**：
1. 检查 `租赁数据\.update_packages\` 文件夹是否存在
2. 确保 UpdateNotifier 有生成更新包
3. 查看服务器日志是否有错误

---

## 📊 监控服务器

### 在线查看日志

运行 `update_server.py` 时，会在控制台输出所有操作：

```
[时间] - 信息 - [IP] 请求更新列表，找到 3 个包
[时间] - 信息 - [IP] 下载更新包: update_20240614_001.zip
[时间] - 信息 - [IP] 开始同步 15 个数据文件...
```

### 查看更新包列表

访问浏览器：
```
http://192.168.1.100:9999/api/updates/list
```

会返回 JSON 格式的列表

---

## 🔐 安全建议

这个方案默认**不需要身份验证**（适合局域网）。

如果需要密码保护，可以：

1. **修改服务器代码**添加基本认证
2. **使用 HTTPS**（需要 SSL 证书）
3. **限制 IP 访问**（防火墙规则）

---

## ✨ 优点总结

| 特性 | 说明 |
|------|------|
| 无需额外软件 | 只需 Python + requests 库 |
| 完全自主控制 | 所有代码都在你的项目中 |
| 局域网高速 | 网络速度快，零延迟 |
| 易于部署 | 一条命令启动 |
| 灵活配置 | 可以自定义端口、文件夹等 |

---

## 📚 相关文件

- `update_server.py` - 主电脑服务器
- `update_client.py` - 其他电脑客户端
- `HTTP_SYNC_GUIDE.md` - 本指南

---

## 💬 常见问题

**Q: 服务器必须一直运行吗？**
A: 是的，其他电脑需要能随时访问服务器。如果主电脑关机，其他电脑将无法下载更新。

**Q: 可以用公网 IP 吗？**
A: 可以，但需要配置路由器端口转发，且建议添加身份验证。

**Q: 多台电脑同时下载会不会有问题？**
A: 不会，HTTP 服务器可以同时处理多个连接。

**Q: 如何更新服务器代码？**
A: 停止 `update_server.py`，修改代码，重新运行即可。

---

祝你使用愉快！ 🎉
