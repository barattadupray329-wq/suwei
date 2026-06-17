"""
Phase 3 Week 7 - Dashboard UI Module
管理看板UI实现 - 8个KPI卡片展示
"""

import threading
import tkinter as tk
from datetime import datetime
from tkinter import messagebox, ttk
from typing import Any, Callable, Dict, Optional


class KpiCard(tk.Frame):
    """单个KPI卡片组件，展示标题、数值、单位、趋势和加载/错误状态。"""

    TREND_SYMBOLS = {
        "up": "↑",
        "down": "↓",
        "flat": "→",
        None: "",
    }
    TREND_COLORS = {
        "up": "#4caf50",
        "down": "#f44336",
        "flat": "#9e9e9e",
        None: "#9e9e9e",
    }

    def __init__(
        self,
        parent,
        title: str,
        unit: str = "",
        width: int = 220,
        height: int = 130,
    ):
        """初始化KPI卡片。

        Args:
            parent: 父容器。
            title: KPI标题。
            unit: 单位，例如“元”、“%”、“个”。
            width: 卡片宽度。
            height: 卡片高度。
        """
        super().__init__(
            parent,
            bg="#2b2b2b",
            bd=1,
            relief="solid",
            width=width,
            height=height,
            cursor="hand2",
        )
        self.title = title
        self.unit = unit
        self.value: Any = 0
        self.trend: Optional[str] = None
        self.on_click: Optional[Callable[[str], None]] = None
        self.is_loading = False
        self.error_message: Optional[str] = None

        self.pack_propagate(False)
        self._create_card_ui()
        self._bind_click_handlers()

    def _create_card_ui(self):
        """创建卡片内部UI。"""
        self.title_label = tk.Label(
            self,
            text=self.title,
            bg="#2b2b2b",
            fg="#bdbdbd",
            font=("Microsoft YaHei UI", 10),
            anchor="w",
        )
        self.title_label.pack(fill="x", padx=12, pady=(10, 4))

        value_row = tk.Frame(self, bg="#2b2b2b")
        value_row.pack(fill="both", expand=True, padx=12, pady=(0, 4))

        self.value_label = tk.Label(
            value_row,
            text="0",
            bg="#2b2b2b",
            fg="#ffffff",
            font=("Microsoft YaHei UI", 24, "bold"),
            anchor="w",
        )
        self.value_label.pack(side="left", fill="both", expand=True)

        side_col = tk.Frame(value_row, bg="#2b2b2b")
        side_col.pack(side="right", fill="y", padx=(6, 0))

        self.trend_label = tk.Label(
            side_col,
            text="",
            bg="#2b2b2b",
            fg="#9e9e9e",
            font=("Microsoft YaHei UI", 16, "bold"),
        )
        self.trend_label.pack(anchor="e")

        self.unit_label = tk.Label(
            side_col,
            text=self.unit,
            bg="#2b2b2b",
            fg="#9e9e9e",
            font=("Microsoft YaHei UI", 10),
        )
        self.unit_label.pack(anchor="e")

        self.subtitle_label = tk.Label(
            self,
            text="",
            bg="#2b2b2b",
            fg="#757575",
            font=("Microsoft YaHei UI", 9),
            anchor="w",
        )
        self.subtitle_label.pack(fill="x", padx=12, pady=(0, 8))

    def _bind_click_handlers(self):
        """为卡片和内部控件绑定点击事件。"""
        widgets = [
            self,
            self.title_label,
            self.value_label,
            self.trend_label,
            self.unit_label,
            self.subtitle_label,
        ]
        for widget in widgets:
            widget.bind("<Button-1>", self._on_click)
            widget.bind("<Enter>", self._on_enter)
            widget.bind("<Leave>", self._on_leave)

    def set_value(
        self,
        value: Any,
        trend: Optional[str] = None,
        subtitle: str = "",
    ):
        """更新KPI数值。

        Args:
            value: KPI数值。
            trend: 趋势，可选值为 up/down/flat。
            subtitle: 卡片底部辅助说明。
        """
        self.value = value
        self.trend = trend
        self.is_loading = False
        self.error_message = None
        self.subtitle_label.config(text=subtitle)
        self._update_display()

    def set_loading(self, is_loading: bool = True):
        """设置加载状态。"""
        self.is_loading = is_loading
        self.error_message = None
        if is_loading:
            self.value_label.config(text="加载中", fg="#ffb74d")
            self.trend_label.config(text="")
            self.subtitle_label.config(text="正在刷新数据...")
        else:
            self._update_display()

    def set_error(self, error_msg: str):
        """设置错误状态。"""
        self.is_loading = False
        self.error_message = error_msg
        self.value_label.config(text="错误", fg="#f44336")
        self.trend_label.config(text="")
        self.subtitle_label.config(text=error_msg)

    def bind_click(self, callback: Callable[[str], None]):
        """绑定点击事件。"""
        self.on_click = callback

    def _update_display(self):
        """刷新卡片显示。"""
        if self.is_loading:
            return

        if self.error_message:
            self.value_label.config(text="错误", fg="#f44336")
            return

        self.value_label.config(text=self._format_value(self.value), fg="#ffffff")
        self.trend_label.config(
            text=self.TREND_SYMBOLS.get(self.trend, ""),
            fg=self.TREND_COLORS.get(self.trend, "#9e9e9e"),
        )

    def _format_value(self, value: Any) -> str:
        """格式化卡片数值。"""
        if isinstance(value, float):
            if self.unit == "%":
                return f"{value:.1f}"
            return f"{value:,.0f}"
        if isinstance(value, int):
            return f"{value:,}"
        return str(value)

    def _on_click(self, event=None):
        """处理卡片点击。"""
        if self.on_click:
            self.on_click(self.title)

    def _on_enter(self, event=None):
        """鼠标悬停效果。"""
        self.config(bg="#343434")
        for child in self.winfo_children():
            try:
                child.config(bg="#343434")
            except tk.TclError:
                pass

    def _on_leave(self, event=None):
        """鼠标离开效果。"""
        self.config(bg="#2b2b2b")
        for child in self.winfo_children():
            try:
                child.config(bg="#2b2b2b")
            except tk.TclError:
                pass


class DashboardV2Frame(tk.Frame):
    """管理看板主框架，展示8个核心KPI并提供刷新和数据加载能力。"""

    KPI_CONFIGS = [
        ("月度收入", "元", "monthly_revenue"),
        ("年度收入", "元", "annual_revenue"),
        ("活跃合同", "个", "active_contracts"),
        ("未收总额", "元", "unpaid_amount"),
        ("逾期合同", "个", "overdue_contracts"),
        ("收款率", "%", "payment_rate"),
        ("换机次数", "次", "monthly_exchanges"),
        ("高风险客户", "个", "high_risk_customers"),
    ]

    def __init__(self, parent, report_engine=None):
        """初始化Dashboard框架。

        Args:
            parent: 父容器。
            report_engine: ReportEngine实例。
        """
        super().__init__(parent, bg="#1e1e1e")
        self.report_engine = report_engine
        self.kpi_cards: Dict[str, KpiCard] = {}
        self.kpi_key_map = {
            title: key for title, _unit, key in self.KPI_CONFIGS
        }
        self.refresh_interval = 30000
        self.auto_refresh = True
        self.data_cache: Dict[str, Any] = {}
        self.previous_data: Dict[str, Any] = {}
        self.is_loading = False
        self.last_refresh_time: Optional[datetime] = None

        self._create_toolbar()
        self._create_kpi_grid()
        self._create_statusbar()
        self._setup_refresh_timer()

    def _create_toolbar(self):
        """创建工具栏。"""
        toolbar = ttk.Frame(self)
        toolbar.pack(fill="x", padx=8, pady=8)

        ttk.Label(
            toolbar,
            text="管理看板",
            font=("Microsoft YaHei UI", 14, "bold"),
        ).pack(side="left", padx=(0, 12))

        ttk.Button(toolbar, text="刷新", command=self.refresh).pack(side="left", padx=3)

        self.auto_refresh_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            toolbar,
            text="自动刷新",
            variable=self.auto_refresh_var,
            command=self._on_auto_refresh_toggle,
        ).pack(side="left", padx=3)

        ttk.Label(toolbar, text="刷新间隔：30秒").pack(side="left", padx=8)

        ttk.Button(toolbar, text="导出", command=self._export_data).pack(
            side="right", padx=3
        )

    def _create_kpi_grid(self):
        """创建2行4列KPI卡片网格。"""
        grid_frame = tk.Frame(self, bg="#1e1e1e")
        grid_frame.pack(fill="both", expand=True, padx=10, pady=6)

        for index, (title, unit, _key) in enumerate(self.KPI_CONFIGS):
            card = KpiCard(grid_frame, title, unit)
            card.bind_click(self._on_kpi_click)
            self.kpi_cards[title] = card

            row = index // 4
            col = index % 4
            card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")

        for row in range(2):
            grid_frame.grid_rowconfigure(row, weight=1)
        for col in range(4):
            grid_frame.grid_columnconfigure(col, weight=1)

    def _create_statusbar(self):
        """创建状态栏。"""
        statusbar = ttk.Frame(self)
        statusbar.pack(fill="x", side="bottom", padx=8, pady=6)

        self.status_label = ttk.Label(statusbar, text="就绪")
        self.status_label.pack(side="left")

        self.last_refresh_label = ttk.Label(statusbar, text="尚未刷新")
        self.last_refresh_label.pack(side="right")

    def _setup_refresh_timer(self):
        """设置自动刷新定时器。"""
        def auto_refresh():
            if self.auto_refresh and not self.is_loading:
                self.load_data()
            self.after(self.refresh_interval, auto_refresh)

        self.after(self.refresh_interval, auto_refresh)

    def load_data(self):
        """加载所有KPI数据。"""
        if self.is_loading:
            return

        self.is_loading = True
        self.status_label.config(text="正在加载数据...")
        for card in self.kpi_cards.values():
            card.set_loading(True)

        thread = threading.Thread(target=self._load_data_async, daemon=True)
        thread.start()

    def _load_data_async(self):
        """异步加载数据，并在主线程更新UI。"""
        try:
            metrics = self._collect_dashboard_metrics()
            self.after(0, lambda: self._apply_metrics(metrics))
        except Exception as exc:
            self.after(0, lambda: self._handle_load_error(str(exc)))

    def _collect_dashboard_metrics(self) -> Dict[str, Any]:
        """从ReportEngine收集Dashboard指标。"""
        if self.report_engine is None:
            return self._empty_metrics()

        if hasattr(self.report_engine, "get_dashboard_metrics"):
            metrics = self.report_engine.get_dashboard_metrics()
            if isinstance(metrics, dict):
                return self._normalize_metrics(metrics)

        return {
            "monthly_revenue": self._get_monthly_revenue(),
            "annual_revenue": self._get_annual_revenue(),
            "active_contracts": self._get_active_contracts(),
            "unpaid_amount": self._get_unpaid_amount(),
            "overdue_contracts": self._get_overdue_contracts(),
            "payment_rate": self._get_payment_rate(),
            "monthly_exchanges": self._get_monthly_exchanges(),
            "high_risk_customers": self._get_high_risk_customers(),
        }

    def _apply_metrics(self, metrics: Dict[str, Any]):
        """将指标数据应用到KPI卡片。"""
        self.previous_data = self.data_cache.copy()
        self.data_cache = metrics.copy()

        subtitles = self._build_subtitles(metrics)
        for title, _unit, key in self.KPI_CONFIGS:
            current = metrics.get(key, 0)
            previous = self.previous_data.get(key, current)
            trend = self._calculate_trend(current, previous)
            self.kpi_cards[title].set_value(
                current,
                trend=trend,
                subtitle=subtitles.get(key, ""),
            )

        self.is_loading = False
        self.last_refresh_time = datetime.now()
        self.status_label.config(text="数据加载完成")
        self.last_refresh_label.config(
            text=f"最后刷新：{self.last_refresh_time.strftime('%H:%M:%S')}"
        )

    def _handle_load_error(self, error_msg: str):
        """处理数据加载错误。"""
        self.is_loading = False
        self.status_label.config(text="数据加载失败")
        for card in self.kpi_cards.values():
            card.set_error(error_msg)
        messagebox.showerror("数据加载失败", error_msg)

    def refresh(self):
        """手动刷新数据。"""
        self.load_data()

    def set_auto_refresh(self, enabled: bool):
        """启用或禁用自动刷新。"""
        self.auto_refresh = enabled
        if hasattr(self, "auto_refresh_var"):
            self.auto_refresh_var.set(enabled)

    def _on_auto_refresh_toggle(self):
        """自动刷新开关事件。"""
        self.set_auto_refresh(self.auto_refresh_var.get())

    def _on_kpi_click(self, title: str):
        """KPI卡片点击事件，Day 3可扩展为钻取导航。"""
        self.status_label.config(text=f"已选择：{title}")

    def _export_data(self):
        """导出数据占位逻辑，Day 3扩展为CSV导出。"""
        if not self.data_cache:
            messagebox.showinfo("导出", "暂无可导出的看板数据")
            return
        messagebox.showinfo("导出", "看板数据导出功能将在交互阶段完善")

    def _get_monthly_revenue(self) -> float:
        """获取本月收入。"""
        return self._call_engine_method(
            ["get_monthly_revenue", "get_current_month_revenue"],
            default=0.0,
        )

    def _get_annual_revenue(self) -> float:
        """获取年度收入。"""
        return self._call_engine_method(
            ["get_annual_revenue", "get_yearly_revenue"],
            default=0.0,
        )

    def _get_active_contracts(self) -> int:
        """获取活跃合同数。"""
        return int(self._call_engine_method(["get_active_contracts"], default=0))

    def _get_unpaid_amount(self) -> float:
        """获取未收总额。"""
        return self._call_engine_method(["get_unpaid_amount"], default=0.0)

    def _get_overdue_contracts(self) -> int:
        """获取逾期合同数。"""
        return int(self._call_engine_method(["get_overdue_contracts"], default=0))

    def _get_payment_rate(self) -> float:
        """获取收款率。"""
        return self._call_engine_method(["get_payment_rate"], default=0.0)

    def _get_monthly_exchanges(self) -> int:
        """获取本月换机次数。"""
        return int(self._call_engine_method(["get_monthly_exchanges"], default=0))

    def _get_high_risk_customers(self) -> int:
        """获取高风险客户数。"""
        return int(self._call_engine_method(["get_high_risk_customers"], default=0))

    def _call_engine_method(self, method_names, default=0):
        """按候选方法名调用ReportEngine方法。"""
        if self.report_engine is None:
            return default

        for method_name in method_names:
            method = getattr(self.report_engine, method_name, None)
            if callable(method):
                value = method()
                return default if value is None else value
        return default

    def _normalize_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """兼容不同命名风格的Dashboard metrics字典。"""
        aliases = {
            "monthly_revenue": ["monthly_revenue", "month_revenue", "本月收入"],
            "annual_revenue": ["annual_revenue", "yearly_revenue", "年度收入"],
            "active_contracts": ["active_contracts", "active_contract_count", "活跃合同"],
            "unpaid_amount": ["unpaid_amount", "total_unpaid", "未收总额"],
            "overdue_contracts": ["overdue_contracts", "overdue_contract_count", "逾期合同"],
            "payment_rate": ["payment_rate", "collection_rate", "收款率"],
            "monthly_exchanges": ["monthly_exchanges", "month_exchanges", "换机次数"],
            "high_risk_customers": ["high_risk_customers", "risk_customer_count", "高风险客户"],
        }
        normalized = {}
        for target_key, source_keys in aliases.items():
            normalized[target_key] = 0
            for source_key in source_keys:
                if source_key in metrics:
                    normalized[target_key] = metrics[source_key]
                    break
        return normalized

    def _empty_metrics(self) -> Dict[str, Any]:
        """返回空指标，便于无数据源时稳定展示。"""
        return {key: 0 for _title, _unit, key in self.KPI_CONFIGS}

    def _build_subtitles(self, metrics: Dict[str, Any]) -> Dict[str, str]:
        """构建卡片辅助说明。"""
        return {
            "monthly_revenue": "本月已收款金额",
            "annual_revenue": "本年度累计收款",
            "active_contracts": "当前有效租赁合同",
            "unpaid_amount": "所有合同剩余未收",
            "overdue_contracts": "存在逾期的合同",
            "payment_rate": "已收 / 应收",
            "monthly_exchanges": "本月设备更换记录",
            "high_risk_customers": "逾期或高频换机客户",
        }

    def _format_currency(self, value: float, decimals: int = 0) -> str:
        """格式化货币值。"""
        return f"{value:,.{decimals}f}"

    def _calculate_trend(self, current: Any, previous: Any) -> str:
        """计算趋势。"""
        try:
            current_value = float(current)
            previous_value = float(previous)
        except (TypeError, ValueError):
            return "flat"

        if current_value > previous_value:
            return "up"
        if current_value < previous_value:
            return "down"
        return "flat"
