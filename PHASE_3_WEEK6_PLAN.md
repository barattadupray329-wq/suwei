# Phase 3 Week 6 规划
## 报表与管理看板 - UI实现与集成

**预计周期**: 2026-06-18 ~ 2026-06-22  
**优先级**: 🔴 高  
**前置依赖**: Phase 3 Week 5 ✅ (报表数据引擎)

---

## 目标与成果

### 主要目标
1. 创建报表UI模块 (`modules/reports_v2.py`)
2. 实现两个核心报表：
   - **报表1**: 客户欠款明细表
   - **报表2**: 设备换机频率统计
3. 集成到主应用导航
4. 支持日期筛选、排序、刷新、CSV导出

### 预期交付
- ✅ `modules/reports_v2.py` (~500-600行)
  - `ReportsV2Frame` 主框架
  - `ArrearsDetailReport` 欠款明细报表
  - `ExchangeFrequencyReport` 换机频率报表
  - 通用过滤器和工具栏
  
- ✅ 修改 `core/app.py` 
  - 添加报表导航入口
  - 集成ReportsV2Frame
  
- ✅ `tests/test_reports_ui.py` (~200行)
  - UI框架和报表组件测试

---

## Week 6 工作分解

### 任务1: UI框架设计 (Day 1)

#### 1.1 ReportsV2Frame 主框架结构
```python
class ReportsV2Frame(ttk.Frame):
    """报表管理框架"""
    
    def __init__(self, parent, data_manager, report_engine):
        # 初始化
        pass
    
    def _create_widgets(self):
        # 1. 工具栏 (ToolBar)
        #    - 报表类型选择器 (Combobox)
        #    - 日期范围选择 (DateEntry或Entry)
        #    - 刷新按钮
        #    - 导出按钮
        #    - 搜索框
        
        # 2. 过滤面板 (FilterPanel)
        #    - 客户名称筛选 (Entry + 搜索)
        #    - 日期范围 (From - To)
        #    - 状态过滤 (Combobox)
        #    - 应用/清除按钮
        
        # 3. 报表区域 (ReportArea)
        #    - Treeview 表格展示
        #    - 分页器 (如果数据多)
        #    - 状态栏 (显示记录数)
```

#### 1.2 样式和布局
- 使用DarkTheme风格（与Phase 2一致）
- Grid布局：工具栏(top) → 过滤面板(left/top) → 报表区(center)
- 表格列宽自适应
- 支持鼠标拖拽调整列宽

---

### 任务2: 报表1 - 客户欠款明细表 (Day 1-2)

#### 2.1 ArrearsDetailReport 组件
```python
class ArrearsDetailReport:
    """客户欠款明细报表"""
    
    def __init__(self, frame, engine):
        pass
    
    def load_data(self, customer_name=None, status=None):
        """从ReportEngine获取数据"""
        # 调用: engine.get_contract_arrears_detail(customer_name)
        # 返回: List[Dict]
        pass
    
    def render_table(self, data):
        """渲染到Treeview"""
        # 列：合同ID、客户名、电话、状态、期限、总租金、已收、未收、逾期天数
        pass
    
    def on_sort_column(self, column):
        """按列排序"""
        pass
    
    def on_row_double_click(self, event):
        """双击查看合同详情（可选）"""
        pass
    
    def on_export_csv(self):
        """导出为CSV"""
        # 调用: engine.export_arrears_to_csv()
        # 保存文件对话框
        pass
```

#### 2.2 表格列定义
| 列 | 字段 | 宽度 | 排序 | 格式 |
|----|------|------|------|------|
| 合同ID | contract_id | 120 | ✓ | 文本 |
| 客户名 | customer_name | 100 | ✓ | 文本 |
| 电话 | customer_phone | 120 | ✗ | 文本 |
| 状态 | status | 80 | ✓ | 状态标签 |
| 开始日期 | contract_start_date | 100 | ✓ | 日期 |
| 结束日期 | contract_end_date | 100 | ✓ | 日期 |
| 总租金 | total_rent | 100 | ✓ | ¥xxx.xx |
| 已收 | paid_amount | 100 | ✓ | ¥xxx.xx |
| 未收 | unpaid_amount | 100 | ✓ | ¥xxx.xx |
| 逾期天数 | overdue_days | 80 | ✓ | 数字 |

#### 2.3 交互特性
- ✅ 按客户名搜索（模糊匹配）
- ✅ 双击行查看收款历史（弹出详情窗口）
- ✅ 按任意列排序
- ✅ 高亮逾期合同（红色背景）
- ✅ 导出选中行或全部
- ✅ 实时刷新（F5或刷新按钮）

---

### 任务3: 报表2 - 设备换机频率统计 (Day 2-3)

#### 3.1 ExchangeFrequencyReport 组件
```python
class ExchangeFrequencyReport:
    """设备换机频率统计报表"""
    
    def __init__(self, frame, engine):
        pass
    
    def load_summary(self, start_date=None, end_date=None):
        """加载客户维度统计"""
        # 调用: engine.get_hardware_exchange_summary(start_date, end_date)
        pass
    
    def load_detail(self, customer_name=None, reason=None, dates=None):
        """加载换机明细"""
        # 调用: engine.get_hardware_exchange_detail(...)
        pass
    
    def switch_view(self, view_type):
        """切换视图：汇总/明细"""
        if view_type == 'summary':
            self.load_summary()
        elif view_type == 'detail':
            self.load_detail()
```

#### 3.2 两种视图

**A. 汇总视图 (按客户统计)**
| 列 | 字段 | 格式 |
|----|------|------|
| 客户名 | customer_name | 文本 |
| 换机次数 | exchange_count | 数字 |
| 活跃天数 | exchange_days | 数字 |
| 最后换机日 | last_exchange_date | 日期 |
| 故障换机 | fault_count | 数字 |
| 升级换机 | upgrade_count | 数字 |
| 客户要求 | customer_request_count | 数字 |
| 人为损坏 | damage_count | 数字 |

**B. 明细视图 (按次记录)**
| 列 | 字段 | 格式 |
|----|------|------|
| 更换ID | change_id | 文本 |
| 合同ID | contract_id | 文本 |
| 客户名 | customer_name | 文本 |
| 换机日期 | change_date | 日期 |
| 原因 | change_reason | 标签 |
| 换机类型 | change_type | 文本 |
| 操作员 | operator_name | 文本 |

#### 3.3 过滤和交互
- ✅ 日期范围选择（汇总视图）
- ✅ 按原因筛选（故障/升级/要求/损坏）
- ✅ 按客户名搜索（明细视图）
- ✅ 视图切换（Tab或Combobox）
- ✅ 导出CSV

---

### 任务4: UI框架集成 (Day 3-4)

#### 4.1 修改 `core/app.py`
```python
# 在 MainWindow 中添加

def _setup_menu_bar(self):
    # 在"工具"菜单中添加
    tools_menu.add_command(
        label="📊 新版报表(v2)",
        command=self._switch_module("reports_v2")
    )

def _switch_module(self, key):
    if key == "reports_v2":
        self.current_module = ReportsV2Frame(
            self.module_frame,
            self.data_manager,
            self.report_engine  # 新增
        )
        self.current_module.pack(fill=tk.BOTH, expand=True)
```

#### 4.2 初始化ReportEngine
```python
# 在 MainWindow.__init__ 中
from core.report_engine import ReportEngine

self.report_engine = ReportEngine(self.data_manager)
```

#### 4.3 导航按钮
- 在导航栏添加 "📊 新版报表" 按钮
- 点击切换到ReportsV2Frame
- 保留菜单项访问方式

---

### 任务5: 单元测试 (Day 4-5)

#### 5.1 测试套件结构
```python
# tests/test_reports_ui.py

class TestReportsV2Frame(unittest.TestCase):
    """报表UI框架测试"""
    
    def test_frame_creation(self):
        """框架创建"""
        pass
    
    def test_report_type_switching(self):
        """报表类型切换"""
        pass
    
    def test_data_loading(self):
        """数据加载"""
        pass

class TestArrearsDetailReport(unittest.TestCase):
    """欠款明细报表测试"""
    
    def test_load_data_empty(self):
        """空数据处理"""
        pass
    
    def test_customer_filter(self):
        """客户筛选"""
        pass
    
    def test_csv_export(self):
        """CSV导出"""
        pass

class TestExchangeFrequencyReport(unittest.TestCase):
    """换机频率报表测试"""
    
    def test_summary_view(self):
        """汇总视图"""
        pass
    
    def test_detail_view(self):
        """明细视图"""
        pass
    
    def test_view_switching(self):
        """视图切换"""
        pass
```

#### 5.2 测试覆盖
- UI组件创建和销毁
- 数据加载和渲染
- 用户交互（筛选、排序、导出）
- 报表切换
- 边界情况（空数据、大数据）

---

## 关键技术点

### Tkinter Treeview 最佳实践
```python
# 1. 列定义
treeview.column('#0', width=100, minwidth=50)
treeview.column('col1', width=150, minwidth=80, anchor='center')

# 2. 数据绑定
for row in data:
    treeview.insert('', 'end', values=tuple(row.values()))

# 3. 排序
def sort_column(col, reverse):
    items = [(treeview.set(k, col), k) for k in treeview.get_children('')]
    items.sort(reverse=reverse)
    for index, (val, k) in enumerate(items):
        treeview.move(k, '', index)
    treeview.heading(col, command=lambda: sort_column(col, not reverse))

# 4. 行选中和高亮
def on_select(event):
    selected = treeview.selection()
    for item in selected:
        treeview.item(item, tags=('selected',))
```

### 日期选择器集成
- 使用 `tkcalendar.DateEntry` 或自定义Entry + 验证
- 格式：YYYY-MM-DD
- 验证：不允许结束日期早于开始日期

### 文件保存对话框
```python
from tkinter import filedialog

filename = filedialog.asksaveasfilename(
    defaultextension=".csv",
    filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
)
if filename:
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(csv_content)
```

---

## 时间规划

| Day | 任务 | 预期完成 |
|-----|------|---------|
| 1 | UI框架设计 + 欠款报表(开始) | 框架+部分UI |
| 2 | 欠款报表(完成) + 换机报表(开始) | 2个报表UI基本完成 |
| 3 | 换机报表(完成) + 集成到主应用 | 集成完成 |
| 4 | 测试和BUG修复 | 功能测试通过 |
| 5 | 最终验收和文档 | ✅ Week 6完成 |

---

## 依赖项和前置条件

### 已完成 ✅
- `core/report_engine.py` - 报表数据引擎
- `core/data_manager.py` - 数据接口
- Phase 2 UI基础 - Tkinter框架、DarkTheme

### 新增依赖
- 无额外第三方库（使用标准Tkinter）
- 可选：`tkcalendar` (DateEntry组件，如需要)

---

## 验收标准

### 功能完整性
- ✅ 欠款明细报表显示所有字段
- ✅ 换机频率报表支持两种视图切换
- ✅ 日期筛选功能正常
- ✅ CSV导出成功
- ✅ UI响应速度良好（< 1秒加载）

### UI/UX
- ✅ 表格列宽合理，不溢出
- ✅ 排序图标清晰
- ✅ 状态提示完整（如"正在加载..."）
- ✅ 错误提示友好

### 测试
- ✅ 单元测试覆盖 > 80%
- ✅ 所有测试通过
- ✅ 无未处理异常

### 代码质量
- ✅ 遵循PEP 8
- ✅ 文档注释完整
- ✅ 代码复用率高

---

## 风险与缓解

| 风险 | 影响 | 缓解方案 |
|-----|------|---------|
| Treeview性能 | 数据多时卡顿 | 分页或虚拟滚动 |
| 日期选择器 | 依赖问题 | 自定义简单Entry |
| 内存占用 | 大数据导入卡顿 | 分页加载 |
| 导出文件编码 | Windows显示乱码 | 使用UTF-8-BOM或GB2312 |

---

## 参考资源

### 类似功能参考
- Phase 2 `RentalContractsV2Frame` - UI框架模板
- Phase 2 `CreateContractWizard` - 表单设计
- `rental_mgmt.py` 中的 RecordListFrame - 列表展示

### Tkinter文档
- Treeview官方文档：表格组件
- StringVar/DoubleVar：数据绑定
- Style/ttk：主题设置

---

## 成果预览

### Week 6 完成后
- ✅ 报表UI完全可用
- ✅ 可在主应用中切换查看两个报表
- ✅ 支持常用筛选和导出
- ✅ 代码覆盖率 > 80%

### Week 7 衔接
Week 7 将专注于：
- 管理看板 (KPI卡片展示)
- 实时刷新和性能优化
- 告警指示器

---

**预计工时**: 40 小时 / 5 天  
**优先级**: 🔴 高（解锁Week 7依赖）  
**下一阶段**: Phase 3 Week 7 - 管理看板与KPI

---

*文档版本: v1.0 | 创建时间: 2026-06-17 | 预计开始: 2026-06-18*
