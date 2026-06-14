# 版本更新和发布指南

## 概述

本应用支持自动更新机制。所有客户端会自动检测新版本并安装更新，**数据不受任何影响**。

## 更新原理

### 数据隔离
- **应用文件**：`data` 文件夹（软链接到坚果云同步文件夹）
- **应用程序**：exe 文件和程序代码
- 更新只替换 exe，数据完全独立

### 更新流程
1. **检查版本** - 从 GitHub Releases 获取最新版本
2. **下载更新** - 将 exe 下载到临时文件夹
3. **备份当前版本** - 保存旧 exe 作为备份
4. **替换 exe** - 用新 exe 替换旧 exe
5. **验证版本** - 更新 version.json
6. **重启应用** - 自动重启以加载新版本

### 出错回滚
如果更新过程失败，会自动恢复旧版本（从备份恢复）

## 如何发布新版本

### 步骤 1: 更新版本号

编辑 `version.json`：

```json
{
  "version": "2.2.0",  // 改为新版本号
  "updated_at": "2026-06-14T15:45:00+08:00",
  "features": [
    "新功能描述"
  ],
  "changes": [
    "修改内容描述"
  ]
}
```

版本号遵循语义化版本 (Semantic Versioning)：
- `MAJOR.MINOR.PATCH`
- 例如：`2.1.0` → `2.1.1`（补丁版本）
- 例如：`2.1.0` → `2.2.0`（次版本）
- 例如：`2.1.0` → `3.0.0`（主版本）

### 步骤 2: 提交代码和打包

```powershell
# 提交所有更改
git add -A
git commit -m "feat: 新功能描述"

# 推送到 GitHub
git push origin main

# 打包成 exe
.\build.ps1
```

### 步骤 3: 发布到 GitHub Releases

1. 打开 https://github.com/barattadupray329-wq/suwei/releases
2. 点击 "Create a new release"
3. 设置：
   - **Tag version**: `v2.2.0`（必须与 version.json 匹配，前面加 `v`）
   - **Release title**: `版本 2.2.0 - 更新说明`
   - **Description**: 详细更新说明
   - **Attach binary**: 上传 `dist\速维租赁管理系统.exe`
4. 点击 "Publish release"

### 步骤 4: 验证

客户端应用会自动检测到新版本，用户看到：

```
检查更新...
发现新版本: 2.2.0
下载中... 45%
...
更新完成，应用将重启
```

## 重要说明

### ⚠️ 数据安全

- **数据文件** (`data/`) 永远不会被覆盖
- 所有数据存储在坚果云同步的 `租赁数据` 文件夹中
- 更新只涉及应用程序文件，与数据无关

### 💾 备份机制

- 旧版本 exe 备份在 `.version_backup` 文件夹
- 如果更新失败会自动恢复
- 用户可以手动恢复旧版本（如需要）

### 🔄 多电脑同步

由于每台电脑上都有独立的应用文件，更新方式：

1. **主电脑** - 发布新版本到 GitHub
2. **其他电脑** - 启动应用时自动检测并安装新版本
3. **数据** - 通过坚果云自动同步，不受更新影响

## 常见问题

### Q: 如果客户端检查更新失败怎么办？

A: 网络连接中断时会显示错误提示，但不会阻止应用运行。用户可以稍后手动重启应用重试。

### Q: 更新时正在使用应用会怎样？

A: 应用重启后才会使用新版本。更新过程不会中断数据操作。

### Q: 如何强制所有客户端更新？

A: 发布新版本到 GitHub Releases。客户端会在启动时自动检测并更新。

### Q: 可以回滚到旧版本吗？

A: 可以。从 `.version_backup` 文件夹恢复备份的 exe，然后修改 version.json 即可。

## 技术细节

### 自动更新检查

应用启动时：
1. 初始化 UpdateManager
2. 后台检查 GitHub Releases API
3. 比较版本号
4. 如有新版本，提示用户

### 下载和安装

用户同意更新后：
1. 下载新 exe 到 `.update_cache` 文件夹
2. 备份当前 exe 到 `.version_backup` 文件夹
3. 替换应用 exe
4. 更新 version.json 版本号
5. 重启应用

### 版本比较

使用语义化版本比较：
- `2.2.0 > 2.1.9` ✓
- `2.1.0 > 2.0.99` ✓
- `3.0.0 > 2.9.9` ✓

## 创建发布标签

```bash
# 创建本地标签
git tag v2.2.0

# 推送标签到 GitHub
git push origin v2.2.0

# 推送所有标签
git push origin --tags
```

## 监控更新状态

在应用中查看更新状态：

```python
from modules.update_manager import get_update_manager

manager = get_update_manager()
status = manager.get_update_status()

print(f"当前版本: {status['current_version']}")
print(f"新版本: {status['new_version']}")
print(f"更新状态: {status['status']}")
```

## 禁用自动更新（如需要）

在 main.py 中注释掉更新相关代码：

```python
# from modules.update_manager import init_update_manager
# update_manager = init_update_manager(project_root)
```

---

**更新日期**: 2026-06-14  
**维护者**: Oz Agent
