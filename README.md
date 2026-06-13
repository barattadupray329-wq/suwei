# 💻 速维电脑租赁管理系统 V2 (Pro)
> 全新重构的深色主题租赁管理解决方案，集成 AI 智能助手、SQLite 本地数据库、自动 Migration 与租赁记录版本回溯。
## ✨ 功能特性
- 🎨 **深色现代 UI**：采用 DarkTheme 配色方案，视觉舒适，专业美观。
- 🤖 **AI 租赁助手**：
  - 📝 **智能提取**：从自然语言中自动识别姓名、电话、身份证、日期、金额、硬件配置等信息。
  - 💬 **自然语言查询**：支持“找张三”“逾期有哪些”“本月新增多少”等业务查询。
  - 🧮 **成本计算器**：识别配件清单并自动计算总价与回本月租。
  - 📊 **数据洞察**：统计租赁、财务、到期提醒与数据验证结果。
- 📊 **全景仪表板**：实时展示租赁状态统计（在租、逾期、退租、买断、丢失等）。
- 📋 **租赁全生命周期管理**：新增、编辑、删除、续租、批量导入导出。
- 📥📤 **Excel 兼容导入导出**：支持 UTF-8-sig 编码的 CSV 批量操作。
- 💾 **SQLite 本地数据库**：使用 Python 标准库 `sqlite3`，无需安装第三方数据库服务。
- 🔄 **自动 Migration**：启动时自动创建/升级数据库结构，并可从旧版 JSON 数据自动导入。
- 🧬 **版本回溯**：记录新增、更新、删除、逾期变更、回滚等历史快照，可按版本恢复单条租赁记录。
---
## 🛠 环境要求
- **操作系统**: Windows 10/11（兼容 macOS/Linux）
- **运行环境**: Python 3.8+
- **第三方依赖**: 无
- **标准库模块**: `tkinter`, `sqlite3`, `json`, `csv`, `re`, `datetime`, `pathlib`, `os`, `sys`, `typing`
---
## 📦 安装与运行
### 方式一：源码运行（开发者）
1. **克隆或下载项目**
   确保文件结构如下：
   ```text
   suwei/
   ├── main.py              # 启动入口
   ├── core/                # 核心逻辑
   ├── modules/             # UI 模块
   ├── theme/               # 主题配色
   ├── data/                # 数据存储（自动生成）
   └── test_*.py            # 验证脚本（根目录）
   ```
2. **运行主程序**
   打开终端（PowerShell/CMD），进入项目目录并执行：
   ```powershell
   python main.py
   ```
3. **验证源码部署环境**
   部署前建议执行：
   ```powershell
   python test_sql_migration.py
   python test_full_integration.py
   python test_rental_ai_functional.py
   python -m compileall core modules test_sql_migration.py
   ```
   通过标准：
   - `test_sql_migration.py` 输出 `STATUS: ALL PASS`
   - `test_full_integration.py` 输出 `STATUS: ALL PASS`
   - `test_rental_ai_functional.py` 输出 `PASSED: 14/14`
### 方式二：独立 EXE 运行（用户）
如果下载的是编译好的 `.exe` 文件：
1. 双击 `速维电脑租赁管理系统V2.exe`。
2. 系统会自动在当前目录创建 `data/` 文件夹。
3. 首次启动会自动创建 SQLite 数据库：`data/rental_data.db`。
4. 如果目录中已有旧版 `data/rental_data.json`，系统会自动导入到 SQLite。
5. 保存后仍会同步导出 JSON 快照：`data/rental_data.json`，用于人工查看和兼容旧工具。
6. **注意**：请勿将 EXE 放在只读目录（如 `C:\Program Files`），否则数据库和日志可能无法写入；建议放在 D 盘、桌面或用户文档目录。
---
## 🔑 默认配置
- **管理员账号**: `admin`
- **管理员密码**: `admin123`
### 修改默认密码
当前密码使用 PBKDF2 哈希保存，不再明文保存 `default_password`。
1. 打开 `core/data_manager.py`。
2. 找到 `_get_default_data` 方法。
3. 修改 `default_admin`，并通过 `_build_password_hash()` 生成新的 `password_salt` / `password_hash`，或后续增加程序内密码修改入口。
4. 如果需要完全重置配置，关闭软件后删除：
   - `data/rental_data.db`
   - `data/rental_data.json`
5. 重启后系统会自动创建默认数据库。
---
## 📖 使用指南
### 1. 登录系统
启动软件后，输入账号密码点击“🚀 登录”。错误会有弹窗提示。
### 2. 导航菜单
- 📊 **仪表板**：查看数据概览、收入统计和到期提醒。
- 📋 **租赁管理**：新增、编辑、删除、续租、导入导出、AI 助手入口。
- ⏰ **到期提醒**：查看即将到期和逾期租赁记录。
- 💻 **硬件管理**：维护硬件配置与品牌下拉库。
- 📈 **报表统计**：查看筛选、续租历史和统计报表。
- 🤖 **AI 助手**：智能填写、自然语言查询、成本计算、数据洞察。
### 3. 租赁管理
- **搜索与筛选**：顶部搜索栏支持姓名/电话/ID 模糊搜索；下拉框支持按状态筛选。
- **续租操作**：选中记录点击“🔄 续租”，输入时间与金额，系统自动计算新到期日并更新总租金。
- **CSV 导入导出**：
  - **导出**：点击“📤 批量导出”，生成 Excel 可读的 CSV 文件。
  - **导入**：点击“📥 批量导入”，选择 CSV 文件，系统自动校验并去重。

### 4. 硬件品牌库与型号管理
- **品牌库页面**（💻 硬件管理 → 品牌库）：
  - 只管理**纯品牌名称**（如 Intel、华硕、金士顿），不存储具体型号。
  - 列表显示“品牌 (N 个型号)”形式，点击分类标签切换 CPU/主板/显卡等。
  - 支持添加、删除、重命名、CSV 导入导出品牌。
- **型号选择**：硬件录入/编辑对话框使用 `AutocompleteEntry` 智能补全，支持模糊搜索和键盘导航；只匹配当前分类的品牌+型号。
- **成本联动**：选择型号后自动回填参考成本与月租，配件成本自动求和。
- **扩展型号库**：编辑 `modules/hardware_models.py` 中的 `HARDWARE_MODELS` 列表（含二手常用老平台型号）。
- **扩展品牌库**：编辑 `modules/hardware_brands.py` 中的 `*_BRANDS` 常量，或通过 UI 动态添加。

### 5. AI 助手
点击租赁管理界面的 **🤖 AI 助手** 按钮打开面板：
- **智能填写**：输入如 `租赁人张三，电话13800000000，起租2024-01-01...`，点击提取即可结构化数据。
- **自然语言查询**：输入“逾期”“在租”“找张三”等查询现有记录。
- **成本计算器**：输入配件和价格，自动计算总价和回本月租。
- **数据洞察**：生成统计、财务、到期提醒和数据验证报告。
---
## 🚀 生产部署（打包 EXE）
使用 `PyInstaller` 将项目打包为可执行文件：
```powershell
# 1. 安装 PyInstaller
pip install pyinstaller

# 2. 执行打包
python -m PyInstaller --noconfirm --clean --onefile --windowed --name "速维电脑租赁管理系统V2" main.py
```
打包后的文件位于：
```text
dist/速维电脑租赁管理系统V2.exe
```
### 部署验证流程
源码部署或 EXE 打包前，建议按以下顺序验证：
```powershell
python test_sql_migration.py
python test_full_integration.py
python test_rental_ai_functional.py
python -m compileall core modules test_sql_migration.py
python -m PyInstaller --noconfirm --clean --onefile --windowed --name "速维电脑租赁管理系统V2" main.py
```
本版本已验证：
- SQLite Migration / JSON 导入 / 版本回溯测试通过
- 全模块集成测试通过
- 租赁管理与 AI 助手功能测试通过
- PyInstaller 成功生成 `dist/速维电脑租赁管理系统V2.exe`
---
## 💾 数据管理
- **主数据库**: `data/rental_data.db`
- **兼容快照**: `data/rental_data.json`
- **版本历史表**: `record_versions`
- **备份机制**: `DataManager.backup_data()` 可生成带时间戳的 JSON 备份文件，例如 `data/backup_20260612_120000.json`。
### 数据恢复
- **常规恢复**：优先使用 JSON 备份文件恢复数据，再启动程序自动导入 SQLite。
- **完全重置**：关闭软件后删除 `data/rental_data.db` 和 `data/rental_data.json`，重启后自动创建空数据库。
- **单条记录回溯**：
  - 使用 `DataManager.get_record_versions(record_id)` 查看历史版本。
  - 使用 `DataManager.rollback_record(record_id, version_id)` 回滚到指定版本。
### SQLite Migration 步骤
系统启动时会初始化 `DataManager()`，随后自动执行：
1. 打开或创建 `data/rental_data.db`。
2. 读取 SQLite `PRAGMA user_version`。
3. 如果版本为 `0`，执行 `Migration 001`：
   - 创建 `settings`
   - 创建 `rental_records`
   - 创建 `record_versions`
   - 创建状态、租赁人、到期日期索引
4. 依次执行后续 Migration（002-005）升级数据库结构。
5. 如果 SQLite 记录为空且存在旧版 `data/rental_data.json`，自动导入 JSON 记录。
6. 每次新增、更新、删除、逾期检查、回滚都会写入 `record_versions` 历史表。
7. 每次保存后同步导出 `data/rental_data.json`，用于兼容旧工具和人工查看。

### Migration 列表
| 版本 | Migration | 说明 |
|------|-----------|------|
| 1 | `_migration_001_initial_schema` | 初始表结构：settings、rental_records、record_versions 及索引 |
| 2 | `_migration_002_brand_library` | 硬件品牌库表：hardware_brands（category + name + sort_order） |
| 3 | `_migration_003_hardware_models` | 硬件型号库表：hardware_models（含规格、参考价格/月租、发布年份） |
| 4 | `_migration_004_brand_library_refactor` | 重构品牌库：从 brand+model 混合名称分离为纯品牌名称 |
| 5 | `_migration_005_sync_models` | 同步型号库：补充二手/老平台常用型号，更新参考价格 |

当前数据库版本：
```text
DB_VERSION = 5
```
---
## 🌿 分支策略
- `main`：稳定可运行版本，部署环境优先使用此分支。
- `dev`：开发分支，所有新功能、数据库变更、UI 调整先提交到此分支。
- 合并流程：功能完成 → 在 `dev` 运行测试 → 创建 PR → 合并到 `main`。
---
## ❓ 常见问题（FAQ）
**Q: 打开软件闪退怎么办？**  
A: 通常是因为杀毒软件拦截、路径权限不足或路径包含特殊字符。请尝试以管理员身份运行，或将软件移动到用户目录、桌面、D 盘等可写目录。
**Q: 启动后没有数据库怎么办？**  
A: 正常情况下会自动创建 `data/rental_data.db`。如果没有生成，请检查程序所在目录是否可写。
**Q: 旧版 JSON 数据会丢失吗？**  
A: 不会。首次启动时，如果 SQLite 为空且存在 `data/rental_data.json`，系统会自动导入旧数据。
**Q: CSV 导入乱码？**  
A: 本系统使用 `UTF-8-sig` 编码导出和导入。请确保 CSV 文件也是此编码，Excel 建议使用“另存为 -> CSV UTF-8”。
**Q: AI 提取不准确？**  
A: AI 模块基于规则和正则表达式匹配。请尽量使用标准描述，例如包含“租赁人”“电话”“起租”“到期”“月租”等关键词。
---
## 📝 版本日志
- **v2.1.0 (2026-06-12)**:
  - 🗄️ 新增 SQLite 主数据库存储
  - 🔄 新增自动 Migration 机制
  - 🧬 新增租赁记录版本历史与回溯能力
  - 📦 验证 PyInstaller EXE 打包部署流程
- **v2.0.0 (2026-06-11)**:
  - 🆕 全新深色 UI 重构
  - 🤖 新增 AI 租赁助手模块
  - 📊 新增数据仪表板
  - ⚡ 初版 JSON 本地持久化
---
## 📞 技术支持
如遇到严重 Bug 或需要定制开发，请检查 `COMMIT_LOG.md` 和测试报告获取详细变更记录。
> **Co-Authored-By**: Oz <oz-agent@warp.dev>
