# 速维电脑租赁管理系统 V2 - 项目结构文档

> 最后更新: 2026-06-17
> 版本: v2.1.0+
> 分支: main (已推送至 origin/main)

---

## 项目总览

### 四版本架构

项目采用四版本架构，核心逻辑独立，各版本共享同一套核心代码：

```
速维电脑租赁管理系统_v2/
├── main.py                      # 版本选择器入口
├── PROJECT_RULES.md             # 开发规则文档
├── ARCHITECTURE.md              # 架构重构计划
├── PROJECT_STRUCTURE.md         # 项目结构 (本文档)
│
├── core/                        # 核心逻辑层 (所有版本共享)
│   ├── __init__.py
│   ├── app.py                   # 主窗口管理 - 导航、模块切换
│   ├── auth.py                  # 认证管理 - 多用户登录、密码哈希
│   ├── data_manager.py          # 数据管理 - SQLite CRUD、Migration
│   └── token_manager.py         # 令牌管理
│
├── modules/                     # 功能模块层
│   │
│   ├── # 核心功能模块 (所有版本共享)
│   ├── rental_mgmt.py           # 租赁管理 - CRUD、续租、导入导出
│   ├── ai_assistant.py          # AI助手
│   ├── dashboard.py             # 仪表板
│   ├── due_reminder.py          # 到期提醒
│   ├── user_mgmt.py             # 用户管理
│   ├── reports.py               # 报表统计
│   ├── hardware_brands.py       # 品牌数据
│   ├── hardware_brands_ui.py    # 品牌管理UI
│   ├── hardware_mgmt.py         # 硬件配置
│   ├── hardware_models.py       # 型号数据
│   ├── logger.py                # 日志记录
│   │
│   └── # 版本特定模块 (网络版)
│   ├── nutstore_sync.py         # 坚果云同步
│   ├── sync_server_manager.py   # HTTP同步服务器
│   ├── server_discovery.py      # 服务器发现
│   ├── splash_screen.py         # 启动屏幕
│   ├── client_setup.py          # 客户端配置
│   └── mode_selection.py        # 模式选择
│
├── versions/                    # 版本入口层
│   ├── __init__.py              # 版本选择器
│   ├── standalone/              # 单机版
│   │   ├── main.py              # 单机版入口
│   │   └── config.py            # 单机版配置
│   ├── network/                 # 网络版
│   │   ├── main.py              # 网络版入口
│   │   └── config.py            # 网络版配置
│   └── lan/                     # 局域网版 (预留)
│       ├── main.py              # 预留入口
│       └── config.py            # 预留配置
│
├── theme/                       # 主题系统
│   └── colors.py                # 深色主题配色
│
├── widgets/                     # 通用组件
│   └── autocomplete.py          # 智能补全
│
├── data/                        # 数据存储 (自动生成)
│   ├── rental_data.db           # SQLite 主数据库
│   └── rental_data.json         # JSON 快照
│
├── logs/                        # 运行日志
│
├── tests/                       # 测试目录
│
├── test_full_integration.py     # 全模块集成测试
├── test_sql_migration.py        # 迁移与版本回溯测试
├── test_rental_ai_functional.py # AI与租赁功能测试
├── test_integration.py          # 集成测试
├── test_new_features.py         # 新功能测试
├── test_rental_module.py        # 租赁管理端到端测试
│
├── dist/                        # 打包输出
├── build/                       # PyInstaller 构建
└── .git/
```

---

## 核心模块说明

### core/ — 核心逻辑层

| 文件 | 职责 |
|------|------|
| `data_manager.py` | SQLite 数据库管理，自动 Migration (v1→v5)，CRUD 操作，JSON 同步，版本回溯，硬件型号/品牌管理，逾期检测，付款历史追踪 |
| `auth.py` | 多用户认证管理器，支持 admin/operator/viewer 三角色登录验证，密码 PBKDF2 哈希，连续失败锁定机制 (5次失败锁定10分钟) |
| `app.py` | 主窗口布局，侧边栏导航，模块切换，全局快捷键 (F5刷新、Ctrl+F搜索)，用户角色检测 |
| `token_manager.py` | 轻量级登录令牌管理 |

### modules/ — 功能模块

| 文件 | 职责 |
|------|------|
| `rental_mgmt.py` | **最大模块 (93.5KB)** — 租赁记录全生命周期管理：新增/编辑/删除/续租/分页筛选/高级筛选/统计报表/AI面板/收款记录/合同导出/批量操作(状态变更、导出、续租、删除) |
| `ai_assistant.py` | 智能信息提取、自然语言查询、成本计算器、数据洞察报告 |
| `dashboard.py` | 实时数据概览、财务统计、即将到期提醒、数据备份、操作日志查看器、报表导出 |
| `user_mgmt.py` | 多用户管理：用户列表、添加用户(含角色选择)、重置密码、启用/禁用、删除用户，admin/operator/viewer 三级权限 |
| `reports.py` | 续租历史查看(含CSV/Excel导出)、高级筛选、统计报表、matplotlib可视化(饼图/柱状图/环形图) |
| `hardware_brands_ui.py` | 品牌分类管理(8分类)、品牌增删改查、导入导出、双击查看关联型号 |
| `hardware_mgmt.py` | 硬件配置对话框，支持分类选择、型号补全、自动填充参考成本 |
| `due_reminder.py` | 即将到期和逾期记录展示 |

### theme/ — 主题系统

| 文件 | 职责 |
|------|------|
| `colors.py` | 统一深色主题配色方案，包含所有颜色常量、字体定义、hover绑定工具 |

### widgets/ — 通用组件

| 文件 | 职责 |
|------|------|
| `autocomplete.py` | 带模糊搜索和键盘导航的智能补全输入框 |

---

## 数据库架构

**版本**: 5 (DB_VERSION = 5)

### Migration 历程

| 版本 | Migration | 说明 |
|------|-----------|------|
| 1 | `_migration_001_initial_schema` | 初始表: settings、rental_records、record_versions 及索引 |
| 2 | `_migration_002_brand_library` | hardware_brands 表 (category + name + sort_order) |
| 3 | `_migration_003_hardware_models` | hardware_models 表 (含规格、参考价格、发布年份) |
| 4 | `_migration_004_brand_library_refactor` | 品牌库重构: 品牌与型号分离 |
| 5 | `_migration_005_sync_models` | 型号库同步: 补充二手/老平台型号 |

### 核心数据表

- `settings` — 系统设置（用户管理、失败计数、锁定状态）
- `rental_records` — 租赁记录（姓名、电话、硬件、租金、状态等）
- `record_versions` — 版本历史（用于单条记录回溯）
- `hardware_brands` — 硬件品牌（8分类: CPU/主板/显卡/内存/硬盘/显示器/机箱电源/散热）
- `hardware_models` — 硬件型号 (74款含参考价格/月租)

---

## 用户角色与权限

| 角色 | 标签 | 删除 | 导入 | 修改用户 | 备份 | 查看全部 |
|------|------|------|------|----------|------|----------|
| admin | 管理员 | ✅ | ✅ | ✅ | ✅ | ✅ |
| operator | 操作员 | ❌ | ✅ | ❌ | ❌ | ✅ |
| viewer | 只读用户 | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 测试覆盖

| 测试文件 | 验证内容 | 状态 |
|----------|----------|------|
| `test_full_integration.py` | 14个模块导入验证 | ✅ 14/14 PASS |
| `test_sql_migration.py` | Migration、JSON导入、版本回溯 | ✅ ALL PASS |
| `test_rental_ai_functional.py` | AI提取、CRUD、筛选、逾期检测、日期解析 | ✅ 14/14 PASS |
| `test_integration.py` | 基础集成 | ✅ |
| `test_new_features.py` | 新功能验证 | ✅ |

---

## Git 提交历史

```
9c7cecd fix: 登录优先架构 - 彻底消除黑框
fe998dc fix: 黑框消除 - 使用 Windows alpha 透明方案
8d98bba fix: 完善黑框消除方案 - 简化窗口初始化流程
3efdeec fix: 消除启动时黑色窗口闪烁 - 改用单根窗口+Toplevel登录对话框
ad5d972 feat: 完善P1-P3功能 - 多用户管理、统计图表、批量操作、收款和合同导出
b30e1ea fix: 修正 test_full_integration.py 导入错误
2db350a sync: 完整同步 master 分支到 main
813fc16 sync: 合并 master 分支 - 数据库版本5 + 硬件型号库 + AI助手 + Excel导入导出
e24df68 Merge dev into main for v2.1.0 release
```

---

## 运行方式

```powershell
# 源码运行
python main.py

# 打包 EXE
pip install pyinstaller
python -m PyInstaller --noconfirm --clean --onefile --windowed --name "速维电脑租赁管理系统V2" main.py

# 运行测试
python test_full_integration.py
python test_sql_migration.py
python test_rental_ai_functional.py
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

*Co-Authored-By: Oz <oz-agent@warp.dev>*
