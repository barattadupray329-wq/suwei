#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI租赁助手模块 — 增强版
4大标签页：智能填写 / 自然语言查询 / 成本计算器 / 数据洞察
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import re
import json
from datetime import datetime, date, timedelta
from theme.colors import DarkTheme


class AIAssistantDialog:
    """AI助手弹窗"""

    def __init__(self, parent, app):
        self.app = app
        self.dm = app.data_manager
        self.extracted = {}
        self.components = []

        self.win = tk.Toplevel(parent)
        self.win.title("🤖 AI 租赁助手")
        self.win.geometry("1020x720")
        self.win.transient(parent)
        self.win.grab_set()
        self.win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center(1020, 720)
        self._build()

    def _center(self, w, h):
        x = (self.win.winfo_screenwidth() // 2) - (w // 2)
        y = (self.win.winfo_screenheight() // 2) - (h // 2)
        self.win.geometry(f"{w}x{h}+{x}+{y}")

    def _build(self):
        header = tk.Frame(self.win, bg=DarkTheme.BG_SECONDARY, height=50)
        header.pack(fill=tk.X)
        header.pack_propagate(False)
        tk.Label(header, text="🤖 AI 租赁信息助手", font=("微软雅黑", 15, "bold"),
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_SECONDARY).pack(side=tk.LEFT, padx=16, pady=8)

        nb = ttk.Notebook(self.win)
        nb.pack(fill=tk.BOTH, expand=True, padx=10, pady=8)
        self._tab_smart_fill(nb)
        self._tab_nl_query(nb)
        self._tab_cost_calc(nb)
        self._tab_insights(nb)

    def _scroll_text(self, parent, height=8):
        t = scrolledtext.ScrolledText(parent, height=height, font=DarkTheme.FONT_MONO,
                                       wrap=tk.WORD, bg=DarkTheme.BG_INPUT,
                                       fg=DarkTheme.TEXT_PRIMARY,
                                       insertbackground=DarkTheme.TEXT_PRIMARY)
        t.pack(fill=tk.BOTH, expand=True)
        return t

    def _btn(self, parent, text, cmd, color=DarkTheme.ACCENT_BLUE):
        b = tk.Button(parent, text=text, font=DarkTheme.FONT_BUTTON, fg="white",
                      bg=color, relief=tk.FLAT, cursor="hand2", command=cmd, padx=12, pady=6)
        b.pack(side=tk.LEFT, padx=3)
        DarkTheme.bind_hover(b, color)
        return b

    # ── 提取算法 ──

    def _extract_rental_info(self, text):
        d = {}
        m = re.search(r'(?:租赁人|姓名|承租.?人|客户)[:：]?\s*([\u4e00-\u9fa5]{2,6})', text)
        if m: d["租赁人"] = m.group(1).strip()
        m = re.search(r'(?:电话|手机|联系电话)[:：]?\s*([\d]{11})', text)
        if m: d["联系电话"] = m.group(1)
        if "联系电话" not in d:
            m = re.search(r'\b(1[3-9]\d{9})\b', text)
            if m: d["联系电话"] = m.group(1)
        m = re.search(r'(?:身份证|证件号)[:：]?\s*([\d]{18}|[\d]{17}[\dXx])', text)
        if m: d["身份证"] = m.group(1)
        m = re.search(r'(?:地址|住址)[:：]?\s*([\u4e00-\u9fa5].+)', text)
        if m: d["地址"] = m.group(1).strip().strip("，,。")
        m = re.search(r'(?:起租|开始|起始)(?:日期)?\s*[:：]?\s*(\d{4})[年.\-/](\d{1,2})[月.\-/](\d{1,2})日?', text)
        if m: d["起租日期"] = f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
        m = re.search(r'(?:到期|截止|结束)(?:日期)?\s*[:：]?\s*(\d{4})[年.\-/](\d{1,2})[月.\-/](\d{1,2})日?', text)
        if m: d["到期日期"] = f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
        dates = re.findall(r'(\d{4})[年.\-/](\d{1,2})[月.\-/](\d{1,2})日?', text)
        normalized_dates = [f"{y}-{mo.zfill(2)}-{day.zfill(2)}" for y, mo, day in dates]
        if "起租日期" not in d and normalized_dates:
            d["起租日期"] = normalized_dates[0]
        if "到期日期" not in d and len(normalized_dates) > 1:
            d["到期日期"] = normalized_dates[1]
        m = re.search(r'(?:月租|月费)[:：]?\s*(\d+(?:\.\d+)?)\s*(?:元|¥)?', text)
        if m: d["月租"] = m.group(1)
        if "月租" not in d:
            prices = re.findall(r'(?<!\d)(\d+(?:\.\d+)?)(?:\s*(?:元|¥))?(?!\d)', text)
            date_parts = {part for date_match in dates for part in date_match}
            candidates = [p for p in prices if p not in date_parts and not re.fullmatch(r'1[3-9]\d{9}', p)]
            if candidates:
                d["月租"] = candidates[-1]
        m = re.search(r'(?:总租|总租金|总额|合计)[:：]?\s*(\d+(?:\.\d+)?)\s*(?:元|¥)?', text)
        if m: d["总租金"] = m.group(1)
        m = re.search(r'(?:押金)[:：]?\s*(\d+(?:\.\d+)?)\s*(?:元|¥)?', text)
        if m: d["押金"] = m.group(1)

        hw = {}
        for key, pat in [
            ("cpu", r'CPU[:：]?\s*([^\n，,]+)'),
            ("mb", r'(?:主板|MB)[:：]?\s*([^\n，,]+)'),
            ("ram", r'(?:内存|RAM)[:：]?\s*(?:ddr\d\s*)?(\d+\s*[Gg][Bb]?\s*(?:×\d+)?)'),
            ("disk", r'(?:硬盘|SSD|固态)[:：]?\s*([^\n，,]+)'),
            ("gpu", r'(?:显卡|GPU)[:：]?\s*([^\n，,]+)'),
            ("case", r'(?:机箱)[:：]?\s*([^\n，,]+)'),
            ("psu", r'(?:电源|PSU)[:：]?\s*([^\n，,]+)'),
            ("cooler", r'(?:风扇|散热)[:：]?\s*([^\n，,]+)'),
            ("os", r'(?:系统|OS)[:：]?\s*([^\n，,]+)'),
        ]:
            m = re.search(pat, text, re.IGNORECASE)
            if m: hw[key] = m.group(1).strip()
        if hw:
            d["硬件信息"] = hw
        return d

    def _extract_components(self, text):
        components = []
        for line in text.strip().split("\n"):
            line = line.strip()
            if not line: continue
            m = re.search(r'([\u4e00-\u9fa5a-zA-Z0-9\s:：\-/＋+]+?)\s+(\d+(?:\.\d+)?)\s*$', line)
            if m:
                name = m.group(1).strip().rstrip(",，")
                price = float(m.group(2))
                if price > 0: components.append({"name": name, "price": price})
                continue
            m = re.search(r'([\u4e00-\u9fa5a-zA-Z0-9\s\-/]+)[:：](\d+(?:\.\d+)?)', line)
            if m:
                name = m.group(1).strip()
                price = float(m.group(2))
                if price > 0: components.append({"name": name, "price": price})
        return components

    # ═══ Tab 1: 智能填写 ═══

    def _tab_smart_fill(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="📝 智能填写")

        tk.Label(fr, text="粘贴租赁信息或硬件配置，AI 自动识别并提取 → 一键创建记录",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))

        top = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        top.pack(fill=tk.BOTH, expand=True)

        left = tk.Frame(top, bg=DarkTheme.BG_PRIMARY)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        tk.Label(left, text="📥 输入文本", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        self.af_input = self._scroll_text(left, 10)
        self.af_input.insert("1.0",
            "租赁人张三，电话13800000000，身份证110101199001011234\n"
            "地址北京市朝阳区，起租2024-01-01，到期2024-12-31，月租500元\n"
            "CPU:i5-13400F  内存:16GB  显卡:RTX4060  硬盘:1TB SSD")

        bf = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf, "🚀 智能提取", self._do_smart_fill, DarkTheme.ACCENT_BLUE)
        self._btn(bf, "🗑 清空", lambda: self.af_input.delete("1.0", tk.END), DarkTheme.BG_HOVER)

        right = tk.Frame(top, bg=DarkTheme.BG_PRIMARY, width=380)
        right.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(10, 0))
        right.pack_propagate(False)

        tk.Label(right, text="📤 提取结果", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        self.af_output = self._scroll_text(right, 12)
        self.af_output.config(state=tk.DISABLED)

        bf2 = tk.Frame(right, bg=DarkTheme.BG_PRIMARY)
        bf2.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf2, "📋 填充到新记录", self._fill_to_new, DarkTheme.ACCENT_GREEN)
        self._btn(bf2, "🧮 计算总价", self._calc_total, DarkTheme.ACCENT_YELLOW)

    def _do_smart_fill(self):
        txt = self.af_input.get("1.0", tk.END).strip()
        if not txt:
            messagebox.showwarning("提示", "请输入文本")
            return
        self.extracted = self._extract_rental_info(txt)
        self.components = self._extract_components(txt)

        self.af_output.config(state=tk.NORMAL)
        self.af_output.delete("1.0", tk.END)
        lines = [f"{'─'*40}", "📋  租 赁 信 息", f"{'─'*40}"]
        for k, v in self.extracted.items():
            if k == "硬件信息":
                lines.append("\n─ 硬件配置 ─")
                for hk, hv in v.items():
                    lines.append(f"  {hk}: {hv}")
            else:
                lines.append(f"  {k}: {v}")

        if self.components:
            lines.append(f"\n{'─'*40}\n💰  配 件 明 细\n{'─'*40}")
            total_price = sum(c['price'] for c in self.components)
            for i, comp in enumerate(self.components, 1):
                lines.append(f"  {i}. {comp['name']}: ¥{comp['price']:.2f}")
            lines.append(f"  {'─'*16}\n  合计: ¥{total_price:.2f}")

        self.af_output.insert("1.0", "\n".join(lines))
        self.af_output.config(state=tk.DISABLED)

    def _fill_to_new(self):
        if not self.extracted or "租赁人" not in self.extracted:
            messagebox.showwarning("提示", "请先提取租赁信息")
            return
        try:
            rec = {
                "renter": {
                    "name": self.extracted.get("租赁人", ""),
                    "phone": self.extracted.get("联系电话", ""),
                    "id_card": self.extracted.get("身份证", ""),
                    "address": self.extracted.get("地址", ""),
                },
                "lease_info": {
                    "start_date": self.extracted.get("起租日期", datetime.now().strftime("%Y-%m-%d")),
                    "end_date": self.extracted.get("到期日期",
                        (datetime.now().replace(year=datetime.now().year+1)).strftime("%Y-%m-%d")),
                    "monthly_rent": float(self.extracted.get("月租", 0)),
                    "total_rent": float(self.extracted.get("总租金", 0)),
                    "deposit": float(self.extracted.get("押金", 0)),
                    "lease_months": 12.0,
                },
                "status": "在租", "paid_amount": 0,
                "renew_history": [],
                "hardware": self.extracted.get("硬件信息", {}),
            }
            self.dm.add_record(rec)
            messagebox.showinfo("成功", f"已创建新记录\nID: {rec['id']}")
        except Exception as e:
            messagebox.showerror("错误", f"创建失败：{e}")

    def _calc_total(self):
        if not self.components:
            messagebox.showinfo("提示", "未检测到配件价格。\n格式: 配件名 价格")
            return
        total = sum(c['price'] for c in self.components)
        msg = "\n".join(f"{c['name']}: ¥{c['price']:.2f}" for c in self.components)
        messagebox.showinfo("合计", f"{msg}\n{'─'*20}\n总价: ¥{total:.2f}")

    # ═══ Tab 2: 自然语言查询 ──────────────────────────────────────

    def _tab_nl_query(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="💬 自然语言查询")

        tk.Label(fr,
            text="支持: 姓名/电话/状态 · 日期范围(本月/7天内/3天后) · 金额(大于/小于) · 硬件(RTX/三星) · 组合查询",
            font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
            bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 6))

        # 输入行
        qf = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        qf.pack(fill=tk.X, pady=(0, 6))
        self.nl_entry = ttk.Entry(qf, font=("微软雅黑", 13), width=50)
        self.nl_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=3)
        self.nl_entry.bind("<Return>", lambda e: self._do_nl_query())
        self._btn(qf, "🔍 查询", self._do_nl_query, DarkTheme.ACCENT_BLUE)
        self._btn(qf, "🗑", lambda: [self.nl_entry.delete(0, tk.END), self._clear_results()],
                  DarkTheme.BG_HOVER)

        # 快捷按钮（两行）
        quick_row1 = [("📋 全部", "全部"), ("⚠️ 逾期", "逾期"), ("✅ 在租", "在租"),
                      ("📅 本月", "本月新增"), ("🔙 退租", "已退租"), ("💎 买断", "已买断"),
                      ("🔴 3天内到期", "3天内到期")]
        quick_row2 = [("💰 未付清", "未付清"), ("⭐ 高价值", "高价值"), ("🆕 近7天", "近7天新增"),
                      ("📞 欠款", "欠款"), ("🗓️ 即将到期", "即将到期"), ("📊 统计", "统计")]

        for row_items in (quick_row1, quick_row2):
            qk = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
            qk.pack(fill=tk.X, pady=1)
            for txt, q in row_items:
                b = tk.Button(qk, text=txt, font=DarkTheme.FONT_SMALL, fg="white",
                             bg=DarkTheme.BG_TERTIARY, relief=tk.FLAT, cursor="hand2",
                             command=lambda v=q: self._quick_query(v), padx=8, pady=3)
                b.pack(side=tk.LEFT, padx=2)
                DarkTheme.bind_hover(b, DarkTheme.BG_TERTIARY, DarkTheme.ACCENT_BLUE)

        # 结果区：上部分摘要 + 下部分表格
        self.nl_summary = tk.Label(fr, text="", font=DarkTheme.FONT_SMALL,
                                   fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY,
                                   anchor=tk.W, justify=tk.LEFT)
        self.nl_summary.pack(fill=tk.X, pady=(6, 2))

        # Treeview 表格展示结果
        tbl_frame = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        tbl_frame.pack(fill=tk.BOTH, expand=True)

        cols = ("ID", "租赁人", "电话", "状态", "到期日", "总租金", "已付", "欠款")
        self.nl_tree = ttk.Treeview(tbl_frame, columns=cols, show="headings", height=10)
        col_widths = {"ID": 100, "租赁人": 90, "电话": 100, "状态": 70,
                      "到期日": 100, "总租金": 80, "已付": 70, "欠款": 70}
        for c in cols:
            self.nl_tree.heading(c, text=c)
            self.nl_tree.column(c, width=col_widths.get(c, 80), anchor="center")

        vbar = ttk.Scrollbar(tbl_frame, orient="vertical", command=self.nl_tree.yview)
        self.nl_tree.configure(yscrollcommand=vbar.set)
        self.nl_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)

        # 颜色标签
        for tag, color in [("overdue", DarkTheme.ACCENT_RED),
                           ("urgent", DarkTheme.ACCENT_YELLOW),
                           ("active", DarkTheme.ACCENT_GREEN)]:
            self.nl_tree.tag_configure(tag, foreground=color)

        self.nl_tree.bind("<Double-1>", self._nl_view_detail)

        # 操作按钮
        bf = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf, "📤 导出结果 CSV", self._nl_export_csv, DarkTheme.ACCENT_GREEN)
        self._btn(bf, "📋 复制 ID", self._nl_copy_ids, DarkTheme.ACCENT_PURPLE)
        self._btn(bf, "📊 返回统计", lambda: self._quick_query("统计"), DarkTheme.ACCENT_BLUE)
        self.nl_results = []

    # ── 查询引擎 ────────────────────────────────────────────────────

    def _parse_query(self, q: str):
        """解析自然语言为结构化查询意图。返回 dict，包含 filters 列表。"""
        intents = {}
        ql = q.lower().strip()
        words = ql.split()

        # ── 状态意图 ──
        status_map = {
            "逾期": "已逾期", "过期": "已逾期", "在租": "在租", "租用": "在租",
            "活跃": "在租", "退租": "已退租", "归还": "已退租", "丢失": "已丢失",
            "买断": "已买断", "全部": None, "所有": None,
        }
        for kw, status in status_map.items():
            if kw in ql:
                intents["status"] = status
                break

        # ── 姓名查找 (找张三 / 张三的 / 搜索张三) ──
        m = re.search(r'(?:找|搜索|查|查看|看)([\u4e00-\u9fa5]{2,4})', q)
        if m:
            intents["renter_name"] = m.group(1)
        else:
            # 没有动词前缀的中文人名（双字或三字）
            m = re.search(r'([\u4e00-\u9fa5]{2,3})(?:的|的租赁|的记录)', q)
            if m and m.group(1) not in ("本月", "今天", "昨天", "今天"):
                intents["renter_name"] = m.group(1)

        # ── 电话查找 ──
        m = re.search(r'(?:电话|手机|号[码]?)\s*(\d{4,11})', ql)
        if m:
            intents["phone_contains"] = m.group(1)

        # ── 身份证 ──
        m = re.search(r'(?:身份证|证件)\s*[:：]?\s*(\d{6,18}[\dXx]?)', ql)
        if m:
            intents["id_card_contains"] = m.group(1)

        # ── 日期意图 ──
        if any(w in ql for w in ("3天", "三天", "3日内", "三天内")):
            intents["expires_within"] = 3
        elif any(w in ql for w in ("7天", "七天", "7日内", "一周")):
            intents["expires_within"] = 7
        elif any(w in ql for w in ("15天", "十五天")):
            intents["expires_within"] = 15
        elif any(w in ql for w in ("30天", "三十天", "一个月", "一个月内")):
            intents["expires_within"] = 30
        elif "即将" in ql or "快到期" in ql or "到期" in ql:
            if "到期" in ql and any(w in ql for w in ("3天", "三天")):
                pass  # already handled
            else:
                intents["expires_within"] = 7

        # 注册日期
        if "本月" in ql or "这个月" in ql:
            if "新增" in ql or "新" in ql or "登记" in ql or "创建" in ql or "本月" in q:
                intents["registered_this_month"] = True
        if "上月" in ql or "上个月" in ql:
            intents["registered_last_month"] = True
        if "近7天" in ql or "最近7天" in ql or "7天内" in ql:
            if "新增" in ql or "登记" in ql or "创建" in ql:
                intents["registered_last_days"] = 7
        if "今天" in ql or "今日" in ql:
            intents["registered_today"] = True
        if "昨天" in ql or "昨日" in ql:
            intents["registered_yesterday"] = True

        # 3天后到期、1周后到期 → 触发 expires_within 逻辑上的组合
        m = re.search(r'(\d+)\s*天[后內内]', ql)
        if m:
            days = int(m.group(1))
            if days <= 90:
                intents["expires_within"] = days

        # ── 金额意图 ──
        m = re.search(r'(?:租金|金额|总租|总价|费用)[:：\s]*(?:大于|超过|高于|>)\s*(\d+(?:\.\d+)?)\s*(?:万|元|¥)?', ql)
        if m:
            intents["total_rent_gt"] = float(m.group(1))
        m = re.search(r'(?:租金|金额|总租|总价|费用)[:：\s]*(?:小于|低于|不足|<)\s*(\d+(?:\.\d+)?)\s*(?:万|元|¥)?', ql)
        if m:
            intents["total_rent_lt"] = float(m.group(1))

        # 简化形式：大于5000
        m = re.search(r'(?:大于|超过|高于)\s*(\d+(?:\.\d+)?)\s*(?:元|¥)?', ql)
        if m and "total_rent_gt" not in intents:
            intents["total_rent_gt"] = float(m.group(1))
        m = re.search(r'(?:小于|低于|不足)\s*(\d+(?:\.\d+)?)\s*(?:元|¥)?', ql)
        if m and "total_rent_lt" not in intents:
            intents["total_rent_lt"] = float(m.group(1))

        # ── 欠款/未付 ──
        if any(w in ql for w in ("未付", "欠款", "未付清", "没付", "没付完")):
            intents["unpaid"] = True

        # ── 高价值 ──
        if any(w in ql for w in ("高价值", "金额高", "高金额")):
            intents["top_by_value"] = 10
        m = re.search(r'(?:前|top|top\s*)\s*(\d+)\s*(?:名|个|条)', ql)
        if m:
            intents["top_by_value"] = int(m.group(1))

        # ── 硬件搜索 ──
        hw_keywords = ["i3", "i5", "i7", "i9", "ryzen", "r5", "r7", "r9",
                       "rtx", "gtx", "rx ", "ddr4", "ddr5", "nvme", "ssd",
                       "三星", "金士顿", "西数", "铠侠", "致态", "希捷",
                       "技嘉", "华硕", "微星", "华擎", "铭瑄", "七彩虹"]
        for kw in hw_keywords:
            if kw.lower() in ql:
                intents.setdefault("hardware_keywords", []).append(kw)

        # ── 统计意图 ──
        if any(w in ql for w in ("统计", "汇总", "概况", "分析")):
            intents["show_stats"] = True

        return intents

    def _execute_query(self, intents: dict):
        """执行结构化意图并返回 (results, stats_dict)。"""
        records = self.dm.get_records()
        results = list(records)
        today = date.today()

        # 1) 状态筛选
        if intents.get("status"):
            results = [r for r in results if r.get("status") == intents["status"]]

        # 2) 姓名查找
        if intents.get("renter_name"):
            name = intents["renter_name"]
            results = [r for r in results if name in r.get("renter", {}).get("name", "")]

        # 3) 电话包含
        if intents.get("phone_contains"):
            p = intents["phone_contains"]
            results = [r for r in results if p in r.get("renter", {}).get("phone", "")]

        # 4) 身份证包含
        if intents.get("id_card_contains"):
            ic = intents["id_card_contains"]
            results = [r for r in results if ic in r.get("renter", {}).get("id_card", "")]

        # 5) N天内到期
        if intents.get("expires_within"):
            n = intents["expires_within"]
            cutoff = today + timedelta(days=n)
            def expires_in_n(r):
                d = r.get("lease_info", {}).get("end_date", "")
                if not d:
                    return False
                try:
                    return today <= datetime.strptime(d, "%Y-%m-%d").date() <= cutoff
                except ValueError:
                    return False
            results = [r for r in results if expires_in_n(r)]

        # 6) 注册日期
        month_now = today.strftime("%Y-%m")
        if intents.get("registered_this_month"):
            results = [r for r in results
                       if (r.get("register_date", "") or "").startswith(month_now)]
        if intents.get("registered_last_month"):
            last_month_dt = today.replace(day=1) - timedelta(days=1)
            lm = last_month_dt.strftime("%Y-%m")
            results = [r for r in results
                       if (r.get("register_date", "") or "").startswith(lm)]
        if intents.get("registered_last_days"):
            nd = intents["registered_last_days"]
            cutoff = today - timedelta(days=nd - 1)
            def recent(r):
                rd = r.get("register_date", "")
                if not rd:
                    return False
                try:
                    return datetime.strptime(rd[:10], "%Y-%m-%d").date() >= cutoff
                except ValueError:
                    return False
            results = [r for r in results if recent(r)]
        if intents.get("registered_today"):
            ts = today.isoformat()
            results = [r for r in results
                       if (r.get("register_date", "") or "").startswith(ts)]
        if intents.get("registered_yesterday"):
            ys = (today - timedelta(days=1)).isoformat()
            results = [r for r in results
                       if (r.get("register_date", "") or "").startswith(ys)]

        # 7) 金额过滤
        if intents.get("total_rent_gt"):
            gt = intents["total_rent_gt"]
            results = [r for r in results
                       if float(r.get("lease_info", {}).get("total_rent", 0) or 0) > gt]
        if intents.get("total_rent_lt"):
            lt = intents["total_rent_lt"]
            results = [r for r in results
                       if float(r.get("lease_info", {}).get("total_rent", 0) or 0) < lt]

        # 8) 欠款
        if intents.get("unpaid"):
            results = [r for r in results
                       if float(r.get("paid_amount", 0) or 0) <
                          float(r.get("lease_info", {}).get("total_rent", 0) or 0)]

        # 9) 高价值 Top N
        if intents.get("top_by_value"):
            n = intents["top_by_value"]
            results = sorted(results,
                key=lambda r: float(r.get("lease_info", {}).get("total_rent", 0) or 0),
                reverse=True)[:n]

        # 10) 硬件关键词
        if intents.get("hardware_keywords"):
            kws = [k.lower() for k in intents["hardware_keywords"]]
            def has_hw(r):
                hw = r.get("hardware", {})
                if not hw:
                    return False
                text = json.dumps(hw, ensure_ascii=False).lower()
                data_text = json.dumps(r, ensure_ascii=False).lower()
                return any(kw in text or kw in data_text for kw in kws)
            results = [r for r in results if has_hw(r)]

        # 11) 纯关键词回退（当无其他意图时进行全字段模糊搜索）
        # 通过检查入参 q 原始字符串，但这里我们只处理掉上面没覆盖的技巧

        # 统计
        stats = {}
        if intents.get("show_stats"):
            totals = {
                "total": len(results),
                "total_rent": sum(float(r.get("lease_info", {}).get("total_rent", 0) or 0)
                                  for r in results),
                "paid": sum(float(r.get("paid_amount", 0) or 0) for r in results),
                "overdue": sum(1 for r in results if r.get("status") == "已逾期"),
                "active": sum(1 for r in results if r.get("status") == "在租"),
            }
            totals["unpaid"] = totals["total_rent"] - totals["paid"]
            stats = totals

        return results, stats

    def _do_nl_query(self):
        q = self.nl_entry.get().strip()
        if not q:
            return

        intents = self._parse_query(q)

        # 如果无匹配意图，做全字段模糊搜索
        if len(intents) <= 1:
            has_real_intent = any(k not in ("show_stats",) for k in intents)
            if not has_real_intent:
                # 全字段模糊搜索
                records = self.dm.get_records()
                ql = q.lower()
                matched = []
                for r in records:
                    hay = (str(r.get("id", "")) + " " +
                           str(r.get("renter", {}).get("name", "")) + " " +
                           str(r.get("renter", {}).get("phone", "")) + " " +
                           str(r.get("renter", {}).get("address", "")) + " " +
                           str(r.get("renter", {}).get("id_card", "")) + " " +
                           str(r.get("status", "")) + " " +
                           str(r.get("lease_info", {}).get("start_date", "")) + " " +
                           str(r.get("lease_info", {}).get("end_date", ""))).lower()
                    if any(w in hay for w in ql.split() if len(w) > 1):
                        matched.append(r)
                self._display_results(q, intents, matched, {})
                return

        results, stats = self._execute_query(intents)
        self._display_results(q, intents, results, stats)

    def _quick_query(self, query_text):
        self.nl_entry.delete(0, tk.END)
        self.nl_entry.insert(0, query_text)
        self._do_nl_query()

    # ── 结果展示 ────────────────────────────────────────────────────

    def _display_results(self, query: str, intents: dict, results: list, stats: dict):
        self.nl_results = results

        # 摘要
        parts = [f"查询「{query}」→ {len(results)} 条结果"]
        if stats:
            parts.append(
                f" | 总租金: ¥{stats['total_rent']:,.0f}  "
                f"已收: ¥{stats['paid']:,.0f}  "
                f"欠款: ¥{stats['unpaid']:,.0f}"
            )
            if stats.get("overdue", 0) > 0:
                parts.append(f" | ⚠️ 逾期: {stats['overdue']}条")
            if stats.get("active", 0) > 0:
                parts.append(f" | ✅ 在租: {stats['active']}条")
        self.nl_summary.config(text="  ".join(parts))

        # 表格
        self.nl_tree.delete(*self.nl_tree.get_children())
        today = date.today()
        for r in results:
            renter = r.get("renter", {})
            lease = r.get("lease_info", {})
            total = float(lease.get("total_rent", 0) or 0)
            paid = float(r.get("paid_amount", 0) or 0)
            unpaid = total - paid
            end_str = lease.get("end_date", "")
            status = r.get("status", "")

            # 过期日判断 tag
            tag = ""
            if status == "已逾期":
                tag = "overdue"
            elif status == "在租" and end_str:
                try:
                    days = (datetime.strptime(end_str, "%Y-%m-%d").date() - today).days
                    if days <= 3:
                        tag = "urgent"
                    else:
                        tag = "active"
                except ValueError:
                    pass

            self.nl_tree.insert("", tk.END, values=(
                r.get("id", ""), renter.get("name", ""), renter.get("phone", ""),
                status, end_str,
                f"¥{total:,.0f}", f"¥{paid:,.0f}", f"¥{unpaid:,.0f}"),
                tags=(tag,) if tag else ())

    def _clear_results(self):
        self.nl_results = []
        self.nl_tree.delete(*self.nl_tree.get_children())
        self.nl_summary.config(text="")

    def _nl_view_detail(self, event):
        sel = self.nl_tree.selection()
        if not sel:
            return
        vals = self.nl_tree.item(sel[0], "values")
        if not vals:
            return
        rid = vals[0]
        record = self.dm.get_record_by_id(rid)
        if not record:
            messagebox.showinfo("详情", f"未找到记录 {rid}")
            return
        renter = record.get("renter", {})
        lease = record.get("lease_info", {})
        hw = record.get("hardware", {})
        total = float(lease.get("total_rent", 0) or 0)
        paid = float(record.get("paid_amount", 0) or 0)

        info = (
            f"📋 记录 ID: {record.get('id', '')}\n"
            f"{'─' * 45}\n"
            f"👤 姓名: {renter.get('name', '')}\n"
            f"📞 电话: {renter.get('phone', '')}\n"
            f"🆔 身份证: {renter.get('id_card', '')}\n"
            f"📍 地址: {renter.get('address', '')}\n\n"
            f"📅 起租: {lease.get('start_date', '')}\n"
            f"📅 到期: {lease.get('end_date', '')}\n"
            f"💰 月租: ¥{float(lease.get('monthly_rent', 0) or 0):,.0f}\n"
            f"💰 总租金: ¥{total:,.0f}\n"
            f"💵 已付: ¥{paid:,.0f}\n"
            f"📊 欠款: ¥{total - paid:,.0f}\n"
            f"📌 状态: {record.get('status', '')}\n"
            f"🕐 登记: {record.get('register_date', '')}"
        )
        if hw:
            hw_lines = "\n".join(f"  • {k}: {v}" for k, v in hw.items())
            info += f"\n💻 硬件:\n{hw_lines}"

        messagebox.showinfo(f"记录详情 — {rid}", info)

    def _nl_export_csv(self):
        if not self.nl_results:
            messagebox.showinfo("提示", "没有可导出的结果")
            return
        fp = filedialog.asksaveasfilename(
            title="导出查询结果", defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
            initialfile=f"查询结果_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        if not fp:
            return
        try:
            with open(fp, "w", newline="", encoding="utf-8-sig") as f:
                import csv
                w = csv.writer(f)
                w.writerow(["ID", "租赁人", "电话", "状态", "到期日", "总租金", "已付", "欠款"])
                for r in self.nl_results:
                    renter = r.get("renter", {})
                    lease = r.get("lease_info", {})
                    total = float(lease.get("total_rent", 0) or 0)
                    paid = float(r.get("paid_amount", 0) or 0)
                    w.writerow([
                        r.get("id", ""), renter.get("name", ""), renter.get("phone", ""),
                        r.get("status", ""), lease.get("end_date", ""),
                        total, paid, total - paid
                    ])
            messagebox.showinfo("成功", f"已导出 {len(self.nl_results)} 条结果\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败：{e}")

    def _nl_copy_ids(self):
        if not self.nl_results:
            messagebox.showinfo("提示", "没有可复制的记录")
            return
        ids = [r.get("id", "") for r in self.nl_results]
        text = "\n".join(ids)
        self.win.clipboard_clear()
        self.win.clipboard_append(text)
        messagebox.showinfo("已复制", f"已复制 {len(ids)} 条记录 ID 到剪贴板")

    # ═══ Tab 3: 成本计算器 ═══

    def _tab_cost_calc(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="🧮 成本计算器")

        tk.Label(fr, text="输入配件和价格，自动计算总价。格式: 配件名 价格",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))

        top = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        top.pack(fill=tk.BOTH, expand=True)

        left = tk.Frame(top, bg=DarkTheme.BG_PRIMARY)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tk.Label(left, text="📥 配件清单", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        self.cc_input = self._scroll_text(left, 10)
        self.cc_input.insert("1.0",
            "CPU:i5 13400F  895\n主板:技嘉H610m  285\n内存:ddr4 8G×2  560\n"
            "硬盘:1000G固态  650\n显卡:4060 12G  1850\n机箱:商途  50\n"
            "电源:航嘉600W  135\n风扇:6铜管  55")

        bf = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf, "🧮 计算总价", self._do_cost_calc, DarkTheme.ACCENT_BLUE)
        self._btn(bf, "🗑 清空", lambda: self.cc_input.delete("1.0", tk.END), DarkTheme.BG_HOVER)

        right = tk.Frame(top, bg=DarkTheme.BG_PRIMARY)
        right.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(10, 0))
        tk.Label(right, text="📊 计算结果", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        self.cc_output = self._scroll_text(right, 12)
        self.cc_output.config(state=tk.DISABLED)

        bf2 = tk.Frame(right, bg=DarkTheme.BG_PRIMARY)
        bf2.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf2, "📋 复制为硬件记录", self._copy_hardware, DarkTheme.ACCENT_GREEN)

    def _do_cost_calc(self):
        txt = self.cc_input.get("1.0", tk.END).strip()
        if not txt:
            messagebox.showwarning("提示", "请输入配件和价格")
            return
        self.components = self._extract_components(txt)
        self.cc_output.config(state=tk.NORMAL)
        self.cc_output.delete("1.0", tk.END)
        lines = ["🧮 配件成本明细", "─" * 50]
        total = 0
        for i, comp in enumerate(self.components, 1):
            lines.append(f"  {i:2}. {comp['name']:<30} ¥{comp['price']:>8.2f}")
            total += comp['price']
        lines.append("─" * 50)
        lines.append(f"  {'合计':>6}                          ¥{total:>8.2f}")
        lines.append("")
        for months in [12, 18, 24]:
            lines.append(f"  {months}个月回本月租: ¥{total/months:.0f}/月")
        self.cc_output.insert("1.0", "\n".join(lines))
        self.cc_output.config(state=tk.DISABLED)
        messagebox.showinfo("计算结果", f"配件总价: ¥{total:.2f}\n共 {len(self.components)} 项")

    def _copy_hardware(self):
        if not self.components:
            messagebox.showwarning("提示", "请先计算配件")
            return
        text = "\n".join(f"{c['name']}: ¥{c['price']:.0f}" for c in self.components)
        self.win.clipboard_clear()
        self.win.clipboard_append(text)
        messagebox.showinfo("已复制", "配件清单已复制到剪贴板")

    # ═══ Tab 4: 数据洞察 ═══

    def _tab_insights(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="📊 数据洞察")

        bf = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(0, 10))
        self._btn(bf, "🔄 刷新分析", self._do_insights, DarkTheme.ACCENT_BLUE)
        self._btn(bf, "📤 导出报告", self._export_insights, DarkTheme.ACCENT_GREEN)
        self._btn(bf, "✓ 验证数据", self._validate_all, DarkTheme.ACCENT_PURPLE)

        self.in_output = self._scroll_text(fr, 20)
        self.in_output.config(state=tk.DISABLED)
        self._do_insights()

    def _do_insights(self):
        records = self.dm.get_records()
        stats = self.dm.get_stats()
        today = date.today()
        total_rent = sum(float(r.get("lease_info",{}).get("total_rent",0) or 0) for r in records)
        paid = sum(float(r.get("paid_amount",0) or 0) for r in records)
        unpaid = total_rent - paid

        lines = ["📊 数据洞察分析报告", "═" * 60, "",
            "【📦 基本统计】",
            f"  总记录: {stats['total']} | 在租: {stats['active']} | 逾期: {stats['expired']}",
            f"  退租: {stats['returned']} | 买断: {stats['bought']} | 丢失: {stats['lost']}", "",
            "【💰 财务分析】",
            f"  总租金: ¥{total_rent:,.2f}",
            f"  已收款: ¥{paid:,.2f}",
            f"  未收款: ¥{unpaid:,.2f}",
            f"  回款率: {paid/max(1,total_rent)*100:.1f}%", "",
        ]

        sorted_rec = sorted(records, key=lambda r: float(r.get("lease_info",{}).get("total_rent",0) or 0), reverse=True)
        lines.append("【⭐ 高价值客户 Top 5】")
        for i, r in enumerate(sorted_rec[:5], 1):
            renter = r.get("renter",{})
            total = float(r.get("lease_info",{}).get("total_rent",0) or 0)
            lines.append(f"  {i}. {renter.get('name','?'):　<6} | {r.get('status','')} | ¥{total:,.0f}")
        lines.append("")

        upcoming = []
        for r in [x for x in records if x.get("status")=="在租"]:
            end_str = r.get("lease_info",{}).get("end_date","")
            if not end_str: continue
            try:
                dt = datetime.strptime(end_str,"%Y-%m-%d").date()
                days = (dt - today).days
                if days <= 30:
                    upcoming.append((r.get("id",""), r.get("renter",{}).get("name",""), end_str, days))
            except ValueError: pass
        upcoming.sort(key=lambda x: x[3])

        if upcoming:
            lines.append(f"【⏰ 即将到期 ({len(upcoming)}条)】")
            for rid, name, end, days in upcoming[:8]:
                icon = "🔴" if days<=3 else ("🟡" if days<=7 else "🟢")
                lines.append(f"  {icon} {rid} {name} - {end} ({days}天)")
        else:
            lines.append("【⏰ 即将到期】暂无30天内到期记录 ✓")
        lines.extend(["", f"📅 报告生成: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])

        self.in_output.config(state=tk.NORMAL)
        self.in_output.delete("1.0", tk.END)
        self.in_output.insert("1.0", "\n".join(lines))
        self.in_output.config(state=tk.DISABLED)

    def _export_insights(self):
        text = self.in_output.get("1.0", tk.END)
        fp = filedialog.asksaveasfilename(title="导出分析报告", defaultextension=".txt",
            filetypes=[("文本文件","*.txt")],
            initialfile=f"数据洞察_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
        if not fp: return
        try:
            with open(fp, "w", encoding="utf-8") as f: f.write(text)
            messagebox.showinfo("成功", f"报告已导出\n{fp}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")

    # ── 数据验证 ──

    def _validate_data(self, data):
        errors, warns = [], []
        for f in ["租赁人","联系电话","起租日期","到期日期"]:
            if not str(data.get(f,"")).strip(): errors.append(f"缺少必填字段: {f}")
        phone = str(data.get("联系电话","")).strip()
        if phone and (not phone.isdigit() or len(phone)!=11): errors.append(f"电话格式错误: {phone}")
        id_card = str(data.get("身份证","")).strip()
        if id_card and not re.match(r"^\d{17}[\dXx]$", id_card): warns.append(f"身份证格式可疑")
        def parse_date(label):
            text = str(data.get(label,"")).strip()
            if not text: return None
            norm = text.replace("年","-").replace("月","-").replace("日","")
            try: return datetime.strptime(norm,"%Y-%m-%d")
            except ValueError: errors.append(f"{label}格式错误")
            return None
        start = parse_date("起租日期")
        end = parse_date("到期日期")
        if start and end and start>end: errors.append("起租日期晚于到期日期")
        def parse_amount(label):
            text = str(data.get(label,"")).strip()
            if not text: return None
            try:
                v = float(text)
                if v<0: errors.append(f"{label}不能为负数")
                return v
            except ValueError: errors.append(f"{label}不是数字")
            return None
        m = parse_amount("月租")
        t = parse_amount("总租金")
        if m is not None and t is not None and t<m: warns.append("总租金小于月租")
        return errors, warns

    def _record_to_flat(self, record):
        renter = record.get("renter", {})
        lease = record.get("lease_info", {})
        return {
            "租赁人": renter.get("name",""), "联系电话": renter.get("phone",""),
            "身份证": renter.get("id_card",""), "地址": renter.get("address",""),
            "起租日期": lease.get("start_date",""), "到期日期": lease.get("end_date",""),
            "月租": lease.get("monthly_rent",""), "总租金": lease.get("total_rent",""),
            "押金": lease.get("deposit",""),
        }

    def _validate_all(self):
        records = self.dm.get_records()
        report = ["【数据验证报告】", "", f"记录总数: {len(records)}"]
        valid = warn = err = 0
        for idx, rec in enumerate(records, 1):
            rid = rec.get("id", f"#{idx}")
            data = self._record_to_flat(rec)
            errors, warns = self._validate_data(data)
            if errors:
                err += 1
                report.extend(["", f"[记录 {rid}]"] + [f"  ❌ {e}" for e in errors])
            elif warns:
                warn += 1
                report.extend(["", f"[记录 {rid}]"] + [f"  ⚠️ {w}" for w in warns])
            else: valid += 1
        report.extend(["", f"✅ 通过:{valid} ⚠️ 警告:{warn} ❌ 错误:{err}"])
        if err==0: report.append("🎉 无阻断性错误")
        self.in_output.config(state=tk.NORMAL)
        self.in_output.delete("1.0", tk.END)
        self.in_output.insert("1.0", "\n".join(report))
        self.in_output.config(state=tk.DISABLED)
