# HTTP 服务器集成完全指南

## 📋 概述

现已完全集成 HTTP 跨电脑同步方案！

- ✅ **主电脑**：自动启动 HTTP 服务器，无需额外操作
- ✅ **其他电脑**：通过配置文件指定服务器地址，自动同步

---

## 🚀 主电脑设置（开发机器）

### 步骤 1：启动应用

```bash
python main.py
```

或者使用 exe：

```bash
.\dist\速维电脑租赁管理系统_v2.exe
```

### 步骤 2：登录应用

- 输入用户名和密码
- 应用启动

### 步骤 3：服务器自动启动 ✨

程序会自动：
1. ✅ 检测本机 IP 地址
2. ✅ 在 9999 端口启动 HTTP 服务器
3. ✅ 保存配置到 `sync_server_config.json`

**日志输出例如：**
```
初始化 HTTP 同步服务器...
🚀 正在启动 HTTP 同步服务器...
✅ HTTP 服务器已启动
   📍 IP: 192.168.1.100:9999
   🔗 访问: http://192.168.1.100:9999
```

### 步骤 4：验证服务器运行

在**任何浏览器**中打开：
```
http://192.168.1.100:9999
```

你会看到一个绿色的状态页面 ✅

---

## 💻 其他电脑设置（客户端）

### 步骤 1：获取主电脑 IP 地址

在主电脑的日志中，你会看到类似的 IP：
```
📍 IP: 192.168.1.100:9999
```

记住这个 IP（例如：`192.168.1.100`）

### 步骤 2：在客户端电脑上配置

#### 方法 A：使用配置脚本（推荐）

在客户端电脑上运行：

```bash
python client_config.py
```

然后按照提示输入：
1. 主电脑的服务器地址（例如：`http://192.168.1.100:9999`）
2. 其他设置（可以全部按回车使用默认值）

**配置脚本会生成 `sync_client_config.json`**

#### 方法 B：手动创建配置文件

在客户端电脑的项目文件夹中，创建 `sync_client_config.json`：

```json
{
  "server_url": "http://192.168.1.100:9999",
  "check_interval": 60,
  "auto_update": true,
  "data_sync_enabled": true,
  "log_level": "INFO"
}
```

**记得改成你主电脑的 IP！**

### 步骤 3：验证连接

运行配置脚本的选项 1：

```bash
python client_config.py
# 选择 1 测试连接
```

或者在浏览器中打开：
```
http://192.168.1.100:9999/api/status
```

---

## 🔄 同步流程

### 当你在主电脑上修改代码时：

```
修改源代码 (modules/, core/, theme/)
         ↓
    更新被检测到
         ↓
   自动生成更新包
         ↓
 存储到 租赁数据\.update_packages\
         ↓
 HTTP 服务器提供访问
         ↓
其他电脑的 exe 可以下载
```

### 其他电脑上的 exe 会：

```
定期检查服务器 (每60秒)
         ↓
   有新更新？
    ↙ (是)  ↘ (否)
  下载      继续等待
   ↓
解压 & 应用
   ↓
重启应用
   ↓
 完成 ✅
```

---

## 📁 相关文件说明

| 文件 | 说明 |
|------|------|
| `update_server.py` | HTTP 服务器主程序 |
| `update_client.py` | 客户端下载工具 |
| `modules/sync_server_manager.py` | 服务器生命周期管理 |
| `client_config.py` | 客户端配置脚本 |
| `sync_server_config.json` | 主电脑自动生成的配置 |
| `sync_client_config.json` | 客户端手动创建的配置 |

---

## 📡 API 端点

### 获取服务器状态

```
GET /api/status
```

**响应：**
```json
{
  "success": true,
  "status": "running",
  "update_packages": 3,
  "data_folder": "/path/to/data",
  "timestamp": "2026-06-14T10:30:00"
}
```

### 获取更新列表

```
GET /api/updates/list
```

**响应：**
```json
{
  "success": true,
  "updates": [
    {
      "name": "update_20260614_001.zip",
      "size": 102400,
      "modified": "2026-06-14T10:00:00",
      "url": "/api/updates/download/update_20260614_001.zip"
    }
  ],
  "timestamp": "2026-06-14T10:30:00"
}
```

### 下载更新包

```
GET /api/updates/download/{filename}
```

### 获取数据文件列表

```
GET /api/data/list
```

### 下载数据文件

```
GET /api/data/download/{filepath}
```

---

## 🔧 配置说明

### 主电脑配置 (`sync_server_config.json`)

自动生成，无需修改。内容包括：

```json
{
  "server_ip": "192.168.1.100",
  "port": 9999,
  "started_at": "2026-06-14T10:00:00",
  "project_root": "/path/to/project",
  "data_folder": "/path/to/data",
  "update_folder": "/path/to/data/.update_packages"
}
```

### 客户端配置 (`sync_client_config.json`)

需要手动创建，关键项：

```json
{
  "server_url": "http://192.168.1.100:9999",  // ← 改这里！
  "check_interval": 60,                        // 检查间隔（秒）
  "auto_update": true,                         // 是否自动应用更新
  "data_sync_enabled": true,                   // 是否同步数据
  "log_level": "INFO"                          // 日志级别
}
```

---

## 🐛 故障排查

### 问题 1：其他电脑无法连接

**症状：** `❌ 连接失败`

**解决步骤：**

1. 检查主电脑 IP 是否正确
   ```bash
   # 主电脑上查看 IP
   ipconfig
   # 找到 IPv4 地址（例如 192.168.1.100）
   ```

2. 检查防火墙
   ```powershell
   # 允许 9999 端口
   netsh advfirewall firewall add rule name="Update Server" `
     dir=in action=allow protocol=tcp localport=9999
   ```

3. 检查服务器是否运行
   ```bash
   # 主电脑上，访问浏览器
   http://localhost:9999
   # 应该看到绿色的 ✅ 状态
   ```

4. 检查配置文件
   ```bash
   # 客户端上，确保 sync_client_config.json 存在
   # 且 server_url 正确
   ```

### 问题 2：更新包没有出现

**症状：** `/api/updates/list` 返回空列表

**解决步骤：**

1. 检查 `.update_packages` 文件夹
   ```bash
   # 主电脑上
   ls 租赁数据\.update_packages\
   # 应该有 .zip 文件
   ```

2. 确保有修改代码
   ```bash
   # 修改 modules/, core/, theme/ 中的文件
   # UpdateNotifier 会自动检测并生成更新包
   ```

3. 检查日志
   ```bash
   # 主电脑控制台应该有"发现代码更新"的消息
   ```

### 问题 3：下载速度很慢

**解决方案：**

1. 减小更新包大小
   - 不包含不必要的文件
   - 只打包 modules/, core/, theme/

2. 增加超时时间（客户端）
   ```python
   from update_client import UpdateClient
   client = UpdateClient("http://...")
   client.timeout = 30  # 改成 30 秒
   ```

3. 检查网络连接
   ```bash
   ping 主电脑IP
   # 应该有响应
   ```

---

## 📊 监控和调试

### 查看主电脑服务器日志

主电脑的控制台会显示：

```
[时间] - INFO - [IP] 请求更新列表，找到 3 个包
[时间] - INFO - [IP] 下载更新包: update_20260614_001.zip
[时间] - INFO - [IP] 开始同步 15 个数据文件...
```

### 测试连接

```bash
# 客户端上
curl http://192.168.1.100:9999/api/status

# 或使用 Python
python -c "
import requests
r = requests.get('http://192.168.1.100:9999/api/status')
print(r.json())
"
```

### 查看生成的配置

```bash
# 主电脑
cat sync_server_config.json

# 客户端
cat sync_client_config.json
```

---

## ✨ 快速参考

### 主电脑

```bash
# 启动应用 → 自动启动服务器
python main.py

# 验证服务器
# 浏览器打开: http://localhost:9999
```

### 客户端

```bash
# 第一次配置
python client_config.py
# 按提示输入主电脑 IP

# 之后，exe 会自动检查和同步
python main.py
```

---

## 🎯 工作原理总结

```
主电脑 (Development)
  ├─ 运行 main.py
  ├─ 自动启动 HTTP 服务器 (:9999)
  ├─ 修改代码
  ├─ UpdateNotifier 生成更新包
  └─ 存储到 租赁数据\.update_packages\
         ↓
      HTTP API
         ↓
客户端电脑 (Deployment)
  ├─ 配置 sync_client_config.json
  ├─ 定期检查 /api/updates/list
  ├─ 发现新更新
  ├─ 下载更新包
  ├─ 应用更新
  └─ 重启应用 ✅
```

---

## 💡 最佳实践

1. **始终让主电脑运行**
   - 其他电脑依赖它的服务器

2. **定期检查日志**
   - 了解同步状态

3. **在修改代码前告知用户**
   - 让他们有准备

4. **使用版本号管理更新**
   - 便于跟踪和回滚

5. **定期备份数据**
   - 虽然 Nutstore 已经同步，但多重备份更安全

---

## 📚 相关文件

- `HTTP_SYNC_GUIDE.md` - HTTP 方案详细指南
- `UPDATE_GUIDE.md` - 更新系统说明
- `DEPLOYMENT_GUIDE.md` - 部署指南

---

祝使用愉快！有问题随时询问 🎉
