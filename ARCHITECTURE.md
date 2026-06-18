# 速维电脑租赁管理系统 V2 - 架构与项目计划

> 最后更新: 2026-06-17
> 状态: 核心架构重构完成 ✅
> 版本: v2.1.0

---

## 项目概述

速维电脑租赁管理系统 V2 是一个基于 Python 3.8+ 和 Tkinter 的桌面应用程序，用于管理电脑租赁业务的完整生命周期。项目采用模块化架构，支持多版本部署。

### 核心特性

- **租赁管理**: 完整的 CRUD 操作、续租、逾期检测、收款记录
- **数据持久化**: SQLite 数据库 + JSON 快照，支持自动 Migration (v1→v5)
- **用户认证**: 多用户支持 (admin/operator/viewer)，密码哈希，账户锁定
- **AI 助手**: 智能信息提取、自然语言查询、成本计算
- **报表统计**: 多维度统计、图表可视化、Excel 导出
- **硬件管理**: 74 款硬件型号库、8 大分类品牌库、智能补全
- **版本架构**: 单机版（本地 SQLite 存储，无网络同步）

---

## 架构设计

### 单机架构

```
                    ┌─────────────────────────┐
                    │     核心逻辑层 (core/)   │
                    │  - data_manager.py       │
                    │  - auth.py               │
                    │  - app.py                │
                    │  - token_manager.py      │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   功能模块层 (modules/)  │
                    │  - rental_mgmt.py        │
                    │  - ai_assistant.py       │
                    │  - dashboard.py          │
                    │  - reports.py            │
                    │  - ...                   │
                    └───────────┬─────────────┘
                                │
                        ┌───────▼───────┐
                        │  单机版       │
                        │  (main.py)    │
                        │               │
                        │ • 本地存储    │
                        │ • 无网络同步  │
                        │ • 独立运行    │
                        └───────────────┘
```

### 核心逻辑层 (core/)

所有版本共享的核心业务逻辑，独立于任何特定版本。

| 模块 | 职责 | 状态 |
|------|------|------|
| `data_manager.py` | SQLite 数据库管理，自动 Migration，CRUD 操作 | ✅ 完成 |
| `auth.py` | 用户认证，密码哈希，账户锁定，多角色权限 | ✅ 完成 |
| `app.py` | 主窗口框架，模块导航，快捷键管理 | ✅ 完成 |
| `token_manager.py` | 登录令牌生成与验证 | ✅ 完成 |

### 功能模块层 (modules/)

#### 核心功能模块（所有版本共享）

| 模块 | 功能 | 状态 |
|------|------|------|
| `rental_mgmt.py` | 租赁管理（CRUD、续租、导入导出、收款、合同、批量操作） | ✅ 完成 |
| `ai_assistant.py` | AI 助手（智能提取、自然语言查询、成本计算） | ✅ 完成 |
| `dashboard.py` | 仪表板（数据概览、财务统计、到期提醒、备份、日志） | ✅ 完成 |
| `reports.py` | 报表（续租历史、高级筛选、统计图表、Excel 导出） | ✅ 完成 |
| `user_mgmt.py` | 用户管理（多用户 CRUD、角色权限控制） | ✅ 完成 |
| `due_reminder.py` | 到期提醒（即将到期和逾期记录展示） | ✅ 完成 |
| `hardware_brands.py` | 品牌数据（8 分类品牌常量定义） | ✅ 完成 |
| `hardware_brands_ui.py` | 品牌管理 UI（分类浏览、增删改查、导入导出） | ✅ 完成 |
| `hardware_mgmt.py` | 硬件配置（硬件配置对话框） | ✅ 完成 |
| `hardware_models.py` | 型号数据（74 款硬件型号数据库） | ✅ 完成 |
| `autocomplete.py` | 自动补全（硬件型号智能补全） | ✅ 完成 |
| `logger.py` | 日志记录 | ✅ 完成 |


---

## 数据库架构

### Migration 历程

| 版本 | Migration | 说明 | 状态 |
|------|-----------|------|------|
| 1 | `_migration_001_initial_schema` | 初始表: settings、rental_records、record_versions | ✅ |
| 2 | `_migration_002_brand_library` | hardware_brands 表 | ✅ |
| 3 | `_migration_003_hardware_models` | hardware_models 表 | ✅ |
| 4 | `_migration_004_brand_library_refactor` | 品牌库重构 | ✅ |
| 5 | `_migration_005_sync_models` | 型号库同步 | ✅ |

### 核心数据表

- `settings` — 系统设置（用户管理、失败计数、锁定状态）
- `rental_records` — 租赁记录（姓名、电话、硬件、租金、状态等）
- `record_versions` — 版本历史（用于单条记录回溯）
- `hardware_brands` — 硬件品牌（8 分类: CPU/主板/显卡/内存/硬盘/显示器/机箱电源/散热）
- `hardware_models` — 硬件型号 (74 款含参考价格/月租)

---

## 开发规则

### 版本划分

1. **核心逻辑** — 共享的业务逻辑和数据管理
2. **单机版** — 本地 SQLite 存储，无网络同步

### 开发约定

1. **默认修改核心逻辑**: 所有功能修改均针对核心逻辑部分
2. **本地存储**: 数据存储在 SQLite 数据库 + JSON 快照

---

## 重构完成总结

### 已完成的重构 (2026-06-17)

✅ **阶段 1: 核心逻辑验证**
- [x] 验证 core/ 模块独立性
- [x] 确保 modules/ 核心功能不依赖版本特定代码
- [x] 创建架构文档 (ARCHITECTURE.md)
- [x] 创建开发规则文档 (PROJECT_RULES.md)

✅ **阶段 2: 版本统一为单机版**
- [x] 移除多版本入口 (versions/ 目录)
- [x] 移除网络同步模块 (nutstore_sync、splash_screen)
- [x] 移除局域网相关模块 (server_discovery、sync_server_manager、client_setup、update_client)
- [x] 移除模式选择模块 (mode_selection)
- [x] 更新 PROJECT_STRUCTURE.md

✅ **阶段 3: 核心逻辑修复**
- [x] 文字遮挡修复 (标签 width=12, 输入框 width=26)
- [x] 边框缩放修复 (Canvas 统一 600px + 自适应)
- [x] 计算逻辑修复 (编辑表单自动计算保护)
- [x] 续租逻辑修复 (精确月数计算，已付金额比较)
- [x] CSV 导入修复 (None 值安全处理)
- [x] 启动崩溃修复 (跨线程调用保护)

✅ **阶段 4: 测试验证**
- [x] 完整集成测试: 14/14 通过
- [x] 租赁管理端到端测试: 30/30 通过
- [x] SQL 迁移测试: 全部通过
- [x] 核心功能集成测试: 全部通过

### 测试覆盖

| 测试文件 | 验证内容 | 状态 |
|----------|----------|------|
| `test_full_integration.py` | 14 个模块导入验证 | ✅ 14/14 PASS |
| `test_sql_migration.py` | Migration、JSON 导入、版本回溯 | ✅ ALL PASS |
| `test_rental_ai_functional.py` | AI 提取、CRUD、筛选、逾期检测 | ✅ 14/14 PASS |
| `test_integration.py` | 核心功能集成验证 | ✅ ALL PASS |
| `test_rental_module.py` | 租赁管理端到端测试 | ✅ 30/30 PASS |

---

## 用户角色与权限

| 角色 | 标签 | 删除 | 导入 | 修改用户 | 备份 | 查看全部 |
|------|------|------|------|----------|------|----------|
| admin | 管理员 | ✅ | ✅ | ✅ | ✅ | ✅ |
| operator | 操作员 | ❌ | ✅ | ❌ | ❌ | ✅ |
| viewer | 只读用户 | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 运行方式

```powershell
# 单机版 (唯一版本)
python main.py
```

### 打包 EXE

```powershell
python -m PyInstaller --noconfirm --clean --onefile --windowed --name "速维电脑租赁管理系统V2" main.py
```

### 运行测试

```powershell
python test_full_integration.py
python test_sql_migration.py
python test_rental_ai_functional.py
python test_integration.py
python test_rental_module.py
```

---

## 技术栈

- **语言**: Python 3.8+
- **GUI**: tkinter (ttk 样式)
- **数据库**: SQLite 3 (标准库)
- **图表**: matplotlib (v3.11+)
- **Excel**: openpyxl (v3.1+)
- **打包**: PyInstaller
- **依赖**: 无需 pip install（除图表功能需 matplotlib）

---

## Git 提交历史

```
refactor: 四版本架构重构 - 核心逻辑独立与版本入口分离
fix: 登录优先架构 - 彻底消除黑框
fix: 黑框消除 - 使用 Windows alpha 透明方案
fix: 完善黑框消除方案 - 简化窗口初始化流程
fix: 消除启动时黑色窗口闪烁 - 改用单根窗口+Toplevel登录对话框
feat: 完善P1-P3功能 - 多用户管理、统计图表、批量操作、收款和合同导出
```

---

## 下一步计划

### 短期计划 (v2.1.0)

- [x] 精简为纯单机版，移除网络同步模块
- [ ] 优化打包流程
- [ ] 添加版本更新检查机制
- [ ] 完善错误处理和用户反馈

### 中期计划 (v2.2.0)

- [ ] 添加数据备份自动恢复功能
- [ ] 优化移动端适配界面

### 长期计划 (v3.0.0)

- [ ] 云端数据同步支持
- [ ] 多租户架构
- [ ] API 接口开放
- [ ] 第三方集成支持

---

*最后更新: 2026-06-17*
*架构重构完成 ✅*
*Co-Authored-By: Oz <oz-agent@warp.dev>*
