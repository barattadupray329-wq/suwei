#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
可嵌入的AI助手Frame版本 - 集成到右侧面板
5个标签页: 智能填写、自然语言查询、成本计算器、数据洞察、AI对话
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import re
import json
from datetime import datetime, date, timedelta
from theme.colors import DarkTheme
from core.ai_adapter import get_adapter


class AIAssistantFrame(ttk.Frame):
    """可嵌入右侧面板的AI助手界面"""

    def __init__(self, parent, app, data_manager, on_record_created=None, on_navigate_to_record=None):
        super().__init__(parent)
        self.app = app
        self.dm = data_manager
        self.extracted = {}
        self.components = []
        self.on_record_created = on_record_created
        self.on_navigate_to_record = on_navigate_to_record
        self.query_history = []
        self.configure(style="Main.TFrame")
        self._build()

    def _build(self):
        main = tk.Frame(self, bg=DarkTheme.BG_PRIMARY)
        main.pack(fill=tk.BOTH, expand=True)
        header = tk.Frame(main, bg=DarkTheme.BG_SECONDARY, height=48)
        header.pack(fill=tk.X, side=tk.TOP)
        header.pack_propagate(False)
        tk.Label(header, text="🤖 AI 租赁助手", font=("微软雅黑", 14, "bold"),
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_SECONDARY).pack(side=tk.LEFT, padx=16, pady=8)
        tk.Button(header, text="✕", font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                  bg=DarkTheme.BG_SECONDARY, relief=tk.FLAT, cursor="hand2",
                  command=self._close).pack(side=tk.RIGHT, padx=12, pady=8)

        nb = ttk.Notebook(main)
        nb.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)
        self._tab_smart_fill(nb)
        self._tab_nl_query(nb)
        self._tab_cost_calc(nb)
        self._tab_insights(nb)
        self._tab_ai_chat(nb)

    def _close(self):
        self.destroy()
        if hasattr(self.app, '_show_right_placeholder'):
            self.app._show_right_placeholder()

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

    def _tab_smart_fill(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="📝 智能填写")
        tk.Label(fr, text="粘贴租赁信息，AI 自动识别并提取",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))

        top = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        top.pack(fill=tk.BOTH, expand=True)
        left = tk.Frame(top, bg=DarkTheme.BG_PRIMARY)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tk.Label(left, text="📥 输入文本", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        self.af_input = self._scroll_text(left, 8)
        self.af_input.insert("1.0", "租赁人张三，电话13800000000\n"
            "地址北京市朝阳区，起租2024-01-01，到期2024-12-31，月租500元\n"
            "CPU:i5-13400F  内存:16GB  显卡:RTX4060  硬盘:1TB SSD")

        bf = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf, "🚀 智能提取", self._do_smart_fill, DarkTheme.ACCENT_BLUE)
        self._btn(bf, "🗑 清空", lambda: self.af_input.delete("1.0", tk.END), DarkTheme.BG_HOVER)

        right = tk.Frame(top, bg=DarkTheme.BG_PRIMARY, width=350)
        right.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(10, 0))
        right.pack_propagate(False)
        tk.Label(right, text="📤 提取结果", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        self.af_output = self._scroll_text(right, 10)
        self.af_output.config(state=tk.DISABLED)

        bf2 = tk.Frame(right, bg=DarkTheme.BG_PRIMARY)
        bf2.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf2, "📋 填充到新记录", self._fill_to_new, DarkTheme.ACCENT_GREEN)

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
        return d

    def _extract_components(self, text):
        """从成本计算器文本中提取配件和价格"""
        components = []
        for line in text.strip().split("\n"):
            line = line.strip()
            if not line: continue
            # 格式: 配件名 价格 (末尾)
            m = re.search(r'([\u4e00-\u9fa5a-zA-Z0-9\s:：\-/＋+]+?)\s+(\d+(?:\.\d+)?)\s*$', line)
            if m:
                name = m.group(1).strip().rstrip(",，")
                price = float(m.group(2))
                if price > 0: components.append({"name": name, "price": price})
                continue
            # 格式: 配件名: 价格
            m = re.search(r'([\u4e00-\u9fa5a-zA-Z0-9\s\-/]+)[:：](\d+(?:\.\d+)?)', line)
            if m:
                name = m.group(1).strip()
                price = float(m.group(2))
                if price > 0: components.append({"name": name, "price": price})
        return components

    def _do_smart_fill(self):
        txt = self.af_input.get("1.0", tk.END).strip()
        if not txt:
            messagebox.showwarning("提示", "请输入文本")
            return
        self.extracted = self._extract_rental_info(txt)
        self.af_output.config(state=tk.NORMAL)
        self.af_output.delete("1.0", tk.END)
        lines = ["📋 租赁信息"]
        for k, v in self.extracted.items():
            lines.append(f"  {k}: {v}")
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
                    "end_date": self.extracted.get("到期日期", (datetime.now().replace(year=datetime.now().year+1)).strftime("%Y-%m-%d")),
                    "monthly_rent": float(self.extracted.get("月租", 0)),
                    "total_rent": float(self.extracted.get("总租金", 0)),
                    "deposit": float(self.extracted.get("押金", 0)),
                    "lease_months": 12.0,
                },
                "status": "在租", "paid_amount": 0, "renew_history": [],
            }
            self.dm.add_record(rec)
            if self.on_record_created:
                self.on_record_created(rec)
            messagebox.showinfo("成功", f"已创建新记录\nID: {rec['id']}")
        except Exception as e:
            messagebox.showerror("错误", f"创建失败：{e}")

    def _tab_nl_query(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="💬 自然语言查询")
        qf = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        qf.pack(fill=tk.X, pady=(0, 6))
        self.nl_entry = ttk.Entry(qf, font=("微软雅黑", 13), width=40)
        self.nl_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=3)
        self.nl_entry.bind("<Return>", lambda e: self._do_nl_query())
        self._btn(qf, "🔍 查询", self._do_nl_query, DarkTheme.ACCENT_BLUE)
        
        self.nl_summary = tk.Label(fr, text="", font=DarkTheme.FONT_SMALL,
                                   fg=DarkTheme.TEXT_MUTED, bg=DarkTheme.BG_PRIMARY)
        self.nl_summary.pack(fill=tk.X, pady=(6, 2))
        
        tbl_frame = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        tbl_frame.pack(fill=tk.BOTH, expand=True)
        
        cols = ("ID", "租赁人", "电话", "状态", "到期日")
        self.nl_tree = ttk.Treeview(tbl_frame, columns=cols, show="headings", height=10)
        for c in cols:
            self.nl_tree.heading(c, text=c)
            self.nl_tree.column(c, width=100, anchor="center")
        
        vbar = ttk.Scrollbar(tbl_frame, orient="vertical", command=self.nl_tree.yview)
        self.nl_tree.configure(yscrollcommand=vbar.set)
        self.nl_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vbar.pack(side=tk.RIGHT, fill=tk.Y)
        # 颜色标签
        for tag, color in [("overdue", DarkTheme.ACCENT_RED),
                           ("urgent", DarkTheme.ACCENT_YELLOW),
                           ("warning", DarkTheme.ACCENT_YELLOW),
                           ("active", DarkTheme.ACCENT_GREEN)]:
            self.nl_tree.tag_configure(tag, foreground=color)
        self.nl_tree.bind("<<TreeviewSelect>>", self._nl_on_select)
        self.nl_results = []

    def _do_nl_query(self):
        q = self.nl_entry.get().strip()
        if not q: return
        
        intents = self._parse_query(q)
        results, stats = self._execute_query(intents)
        self.nl_results = results
        self.nl_tree.delete(*self.nl_tree.get_children())
        
        summary_text = f"找到 {len(results)} 条结果"
        if stats:
            summary_text += f" | 总租金: ¥{stats['total_rent']:,.0f} | 已收: ¥{stats['paid']:,.0f} | 未收: ¥{stats['unpaid']:,.0f}"
        self.nl_summary.config(text=summary_text)
        
        for r in results:
            renter = r.get("renter", {})
            lease = r.get("lease_info", {})
            tag = ""
            if r.get("status") == "已逾期":
                tag = "overdue"
            elif r.get("status") == "在租" and lease.get("end_date", ""):
                try:
                    days = (datetime.strptime(lease["end_date"], "%Y-%m-%d").date() - date.today()).days
                    if days <= 3:
                        tag = "urgent"
                    elif days <= 7:
                        tag = "warning"
                except: pass
            self.nl_tree.insert("", tk.END, values=(
                r.get("id", ""), renter.get("name", ""), renter.get("phone", ""),
                r.get("status", ""), lease.get("end_date", "")), tags=(tag,) if tag else ())

    def _parse_query(self, q: str):
        """解析自然语言查询为结构化意图"""
        intents = {}
        ql = q.lower().strip()
        
        status_map = {
            "逾期": "已逾期", "过期": "已逾期", "在租": "在租", "租用": "在租",
            "活跃": "在租", "退租": "已退租", "归还": "已退租", "丢失": "已丢失",
            "买断": "已买断", "全部": None, "所有": None,
        }
        for kw, status in status_map.items():
            if kw in ql:
                intents["status"] = status
                break
        
        m = re.search(r'(?:找|搜索|查|查看|看)([\u4e00-\u9fa5]{2,4})', q)
        if m:
            intents["renter_name"] = m.group(1)
        else:
            m = re.search(r'([\u4e00-\u9fa5]{2,3})(?:的|的租赁|的记录)', q)
            if m and m.group(1) not in ("本月", "今天", "昨天", "今天"):
                intents["renter_name"] = m.group(1)
        
        m = re.search(r'(?:电话|手机|号[码]?)\s*(\d{4,11})', ql)
        if m:
            intents["phone_contains"] = m.group(1)
        
        if any(w in ql for w in ("3天", "三天", "3日内")):
            intents["expires_within"] = 3
        elif any(w in ql for w in ("7天", "七天", "7日内", "一周")):
            intents["expires_within"] = 7
        elif any(w in ql for w in ("30天", "三十天", "一个月")):
            intents["expires_within"] = 30
        
        if any(w in ql for w in ("未付", "欠款", "未付清")):
            intents["unpaid"] = True
        
        if any(w in ql for w in ("高价值", "金额高", "top")):
            intents["top_by_value"] = 10
        
        if any(w in ql for w in ("统计", "汇总", "概况")):
            intents["show_stats"] = True
        
        return intents

    def _execute_query(self, intents: dict):
        """执行查询意图"""
        records = self.dm.get_records()
        results = list(records)
        today = date.today()
        
        if intents.get("status"):
            results = [r for r in results if r.get("status") == intents["status"]]
        
        if intents.get("renter_name"):
            name = intents["renter_name"]
            results = [r for r in results if name in r.get("renter", {}).get("name", "")]
        
        if intents.get("phone_contains"):
            p = intents["phone_contains"]
            results = [r for r in results if p in r.get("renter", {}).get("phone", "")]
        
        if intents.get("expires_within"):
            n = intents["expires_within"]
            cutoff = today + timedelta(days=n)
            def expires_in_n(r):
                d = r.get("lease_info", {}).get("end_date", "")
                if not d: return False
                try:
                    return today <= datetime.strptime(d, "%Y-%m-%d").date() <= cutoff
                except: return False
            results = [r for r in results if expires_in_n(r)]
        
        if intents.get("unpaid"):
            results = [r for r in results
                      if float(r.get("paid_amount", 0) or 0) <
                         float(r.get("lease_info", {}).get("total_rent", 0) or 0)]
        
        if intents.get("top_by_value"):
            n = intents["top_by_value"]
            results = sorted(results,
                key=lambda r: float(r.get("lease_info", {}).get("total_rent", 0) or 0),
                reverse=True)[:n]
        
        stats = {}
        if intents.get("show_stats"):
            stats = {
                "total": len(results),
                "total_rent": sum(float(r.get("lease_info", {}).get("total_rent", 0) or 0) for r in results),
                "paid": sum(float(r.get("paid_amount", 0) or 0) for r in results),
                "overdue": sum(1 for r in results if r.get("status") == "已逾期"),
                "active": sum(1 for r in results if r.get("status") == "在租"),
            }
            stats["unpaid"] = stats["total_rent"] - stats["paid"]
        
        return results, stats

    def _nl_on_select(self, event):
        sel = self.nl_tree.selection()
        if not sel: return
        vals = self.nl_tree.item(sel[0], "values")
        if not vals: return
        rid = vals[0]
        if self.on_navigate_to_record:
            self.on_navigate_to_record(rid)

    def _tab_cost_calc(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="🧮 成本计算器")
        tk.Label(fr, text="输入配件和价格，自动计算总价",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))
        top = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        top.pack(fill=tk.BOTH, expand=True)
        left = tk.Frame(top, bg=DarkTheme.BG_PRIMARY)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tk.Label(left, text="📥 配件清单", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        self.cc_input = self._scroll_text(left, 10)
        self.cc_input.insert("1.0", "CPU:i5 13400F  895\n主板:技嘉H610m  285\n内存:ddr4 8G×2  560\n硬盘:1000G固态  650\n显卡:4060 12G  1850")
        bf = tk.Frame(left, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf, "🧮 计算", self._do_cost_calc, DarkTheme.ACCENT_BLUE)
        
        right = tk.Frame(top, bg=DarkTheme.BG_PRIMARY)
        right.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(10, 0))
        tk.Label(right, text="📊 结果", font=DarkTheme.FONT_LABEL,
                 fg=DarkTheme.TEXT_SECONDARY, bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W)
        self.cc_output = self._scroll_text(right, 12)
        self.cc_output.config(state=tk.DISABLED)

    def _do_cost_calc(self):
        txt = self.cc_input.get("1.0", tk.END).strip()
        if not txt:
            messagebox.showwarning("提示", "请输入配件和价格")
            return
        components = []
        for line in txt.split("\n"):
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
        
        self.cc_output.config(state=tk.NORMAL)
        self.cc_output.delete("1.0", tk.END)
        lines = ["🧮 成本计算", "─" * 40]
        total = 0
        for i, comp in enumerate(components, 1):
            lines.append(f"  {i}. {comp['name']:<25} ¥{comp['price']:>8.2f}")
            total += comp['price']
        lines.append(f"  合计:                      ¥{total:>8.2f}")
        for months in [12, 18, 24]:
            lines.append(f"  {months}个月回本月租: ¥{total/months:.0f}/月")
        self.cc_output.insert("1.0", "\n".join(lines))
        self.cc_output.config(state=tk.DISABLED)
        messagebox.showinfo("计算结果", f"配件总价: ¥{total:.2f}\n共 {len(components)} 项")

    def _tab_insights(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="📊 数据洞察")
        bf = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(0, 10))
        self._btn(bf, "🔄 刷新", self._do_insights, DarkTheme.ACCENT_BLUE)
        self.in_output = self._scroll_text(fr, 18)
        self.in_output.config(state=tk.DISABLED)
        self._do_insights()

    def _do_insights(self):
        records = self.dm.get_records()
        stats = self.dm.get_stats()
        today = date.today()
        total_rent = sum(float(r.get("lease_info",{}).get("total_rent",0) or 0) for r in records)
        paid = sum(float(r.get("paid_amount",0) or 0) for r in records)
        lines = ["📊 数据洞察报告", "═" * 40, "",
            "【📦 基本统计】",
            f"  总记录: {stats['total']} | 在租: {stats['active']} | 逾期: {stats['expired']}",
            f"  退租: {stats['returned']} | 丢失: {stats['lost']} | 买断: {stats['bought']}", "",
            "【💰 财务分析】",
            f"  总租金: ¥{total_rent:,.2f}",
            f"  已收款: ¥{paid:,.2f}",
            f"  未收款: ¥{total_rent - paid:,.2f}",
            f"  回款率: {paid/max(1,total_rent)*100:.1f}%"]
        self.in_output.config(state=tk.NORMAL)
        self.in_output.delete("1.0", tk.END)
        self.in_output.insert("1.0", "\n".join(lines))
        self.in_output.config(state=tk.DISABLED)

    def _tab_ai_chat(self, nb):
        fr = ttk.Frame(nb, padding=10)
        nb.add(fr, text="💬 AI对话")
        tk.Label(fr, text="与AI对话获取租赁数据分析和建议",
                 font=DarkTheme.FONT_SMALL, fg=DarkTheme.TEXT_MUTED,
                 bg=DarkTheme.BG_PRIMARY).pack(anchor=tk.W, pady=(0, 8))
        self.chat_history = self._scroll_text(fr, 14)
        self.chat_history.config(state=tk.DISABLED)
        input_frame = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        input_frame.pack(fill=tk.X, pady=(8, 0))
        self.chat_entry = tk.Entry(input_frame, font=DarkTheme.FONT_NORMAL,
                                   bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY,
                                   insertbackground=DarkTheme.TEXT_PRIMARY)
        self.chat_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4)
        self.chat_entry.bind("<Return>", self._send_chat)
        self._btn(input_frame, "发送", lambda: self._send_chat(None), DarkTheme.ACCENT_BLUE)
        self._add_chat_message("AI", "您好！我是AI助手。\n\n• 问统计数据: \"统计一下总数据\"\n• 问逾期: \"有多少逾期记录？\"\n• 问到期: \"哪些即将到期？\"\n• 问高价值: \"高价值客户有哪些？\"", "💙")

    def _send_chat(self, event):
        msg = self.chat_entry.get().strip()
        if not msg: return
        self.chat_entry.delete(0, tk.END)
        self._add_chat_message("您", msg, "🧑")
        
        # 尝试使用LLM适配器
        adapter = get_adapter()
        response = None
        if adapter and adapter.config.is_enabled():
            try:
                response = adapter.chat(
                    [{"role": "user", "content": msg}],
                    system_prompt="你是一个租赁管理系统的AI助手。请基于系统数据回答用户的问题。"
                )
            except:
                response = None
        
        # 如果LLM不可用，回退到规则引擎
        if not response:
            response = self._generate_ai_response(msg)
        
        self._add_chat_message("AI", response, "🤖")

    def _add_chat_message(self, sender, message, icon):
        self.chat_history.config(state=tk.NORMAL)
        self.chat_history.insert(tk.END, f"\n{icon} {sender}:\n{message}\n{'─'*40}\n")
        self.chat_history.see(tk.END)
        self.chat_history.config(state=tk.DISABLED)

    def _generate_ai_response(self, query: str) -> str:
        ql = query.lower()
        records = self.dm.get_records()
        stats = self.dm.get_stats()
        today = date.today()
        
        # 数据统计
        if any(w in ql for w in ("统计", "多少", "数据", "汇总")):
            total_rent = sum(float(r.get("lease_info",{}).get("total_rent",0) or 0) for r in records)
            paid = sum(float(r.get("paid_amount",0) or 0) for r in records)
            avg_rent = total_rent / len(records) if records else 0
            return f"📊 数据统计结果：\n\n" \
                   f"• 总记录数: {stats['total']}\n" \
                   f"• 在租设备: {stats['active']}\n" \
                   f"• 逾期未还: {stats['expired']}\n" \
                   f"• 已退租: {stats['returned']}\n" \
                   f"• 已丢失: {stats['lost']}\n" \
                   f"• 已买断: {stats['bought']}\n" \
                   f"• 总租金: ¥{total_rent:,.0f}\n" \
                   f"• 已收款: ¥{paid:,.0f}\n" \
                   f"• 未收款: ¥{total_rent - paid:,.0f}\n" \
                   f"• 回款率: {paid/max(1,total_rent)*100:.1f}%\n" \
                   f"• 平均租金: ¥{avg_rent:,.0f}"
        
        # 逾期相关
        if any(w in ql for w in ("逾期", "过期", "超期")):
            overdue = [r for r in records if r.get("status") == "已逾期"]
            if not overdue:
                return "✅ 当前没有逾期记录。"
            total_overdue_rent = sum(float(r.get("lease_info",{}).get("total_rent",0) or 0) for r in overdue)
            return f"⚠️ 当前有 {len(overdue)} 条逾期记录：\n\n" + \
                   "\n".join(f"• {r.get('renter',{}).get('name','未知')} | 到期: {r.get('lease_info',{}).get('end_date','未知')} | 租金: ¥{float(r.get('lease_info',{}).get('total_rent',0) or 0):,.0f}" 
                            for r in overdue[:5]) + \
                   (f"\n... 等共{len(overdue)}条" if len(overdue) > 5 else "") + \
                   f"\n\n💰 逾期总金额: ¥{total_overdue_rent:,.0f}\n\n建议及时联系客户确认续租或归还事宜。"
        
        # 即将到期
        if any(w in ql for w in ("即将到期", "快到期", "到期提醒", "到期")):
            upcoming = []
            for r in records:
                if r.get("status") != "在租": continue
                end_str = r.get("lease_info",{}).get("end_date","")
                if not end_str: continue
                try:
                    dt = datetime.strptime(end_str,"%Y-%m-%d").date()
                    days = (dt - today).days
                    if days <= 30:
                        upcoming.append((r.get("renter",{}).get("name",""), end_str, days))
                except: pass
            upcoming.sort(key=lambda x: x[2])
            if not upcoming:
                return "✅ 30天内没有即将到期的记录。"
            urgent = [u for u in upcoming if u[2] <= 3]
            warning = [u for u in upcoming if 3 < u[2] <= 7]
            normal = [u for u in upcoming if u[2] > 7]
            response = f"⏰ 到期提醒：\n\n"
            if urgent:
                response += f"🔴 紧急({len(urgent)}条)：\n" + \
                           "\n".join(f"  • {name} - {end} (剩余{days}天)" for name, end, days in urgent[:3]) + "\n\n"
            if warning:
                response += f"🟡 警告({len(warning)}条)：\n" + \
                           "\n".join(f"  • {name} - {end} (剩余{days}天)" for name, end, days in warning[:3]) + "\n\n"
            if normal:
                response += f"🟢 正常({len(normal)}条)：\n" + \
                           "\n".join(f"  • {name} - {end} (剩余{days}天)" for name, end, days in normal[:3]) + \
                           (f"\n  ... 等共{len(normal)}条" if len(normal) > 3 else "")
            return response
        
        # 高价值客户
        if any(w in ql for w in ("高价值", "大客户", "金额高", "top")):
            sorted_rec = sorted(records, 
                               key=lambda r: float(r.get("lease_info",{}).get("total_rent",0) or 0), 
                               reverse=True)
            return f"⭐ 高价值客户 Top 5：\n\n" + \
                   "\n".join(f"{i}. {r.get('renter',{}).get('name','?')} | {r.get('status','')} | ¥{float(r.get('lease_info',{}).get('total_rent',0) or 0):,.0f}" 
                            for i, r in enumerate(sorted_rec[:5], 1))
        
        # 欠款/未付
        if any(w in ql for w in ("欠款", "未付", "未付清")):
            unpaid_records = []
            for r in records:
                total = float(r.get("lease_info",{}).get("total_rent",0) or 0)
                paid = float(r.get("paid_amount",0) or 0)
                if paid < total:
                    unpaid_records.append((r.get("renter",{}).get("name",""), total - paid, total, paid))
            if not unpaid_records:
                return "✅ 所有客户均已付清款项。"
            unpaid_records.sort(key=lambda x: x[1], reverse=True)
            total_unpaid = sum(u[1] for u in unpaid_records)
            return f"💰 欠款情况：\n\n" + \
                   "\n".join(f"• {name} | 未付: ¥{unpaid:,.0f} | 总租: ¥{total:,.0f} | 已付: ¥{paid:,.0f}" 
                            for name, unpaid, total, paid in unpaid_records[:5]) + \
                   (f"\n... 等共{len(unpaid_records)}条" if len(unpaid_records) > 5 else "") + \
                   f"\n\n总计未收款: ¥{total_unpaid:,.0f}"
        
        # 收入/财务
        if any(w in ql for w in ("收入", "财务", "金额", "钱")):
            total_rent = sum(float(r.get("lease_info",{}).get("total_rent",0) or 0) for r in records)
            paid = sum(float(r.get("paid_amount",0) or 0) for r in records)
            by_status = {}
            for r in records:
                status = r.get("status", "未知")
                rent = float(r.get("lease_info",{}).get("total_rent",0) or 0)
                by_status[status] = by_status.get(status, 0) + rent
            return f"💰 财务情况：\n\n" \
                   f"• 总租金: ¥{total_rent:,.0f}\n" \
                   f"• 已收款: ¥{paid:,.0f}\n" \
                   f"• 未收款: ¥{total_rent - paid:,.0f}\n" \
                   f"• 回款率: {paid/max(1,total_rent)*100:.1f}%\n\n" \
                   f"按状态分布：\n" + \
                   "\n".join(f"• {k}: ¥{v:,.0f}" for k, v in by_status.items())
        
        # 硬件
        if any(w in ql for w in ("硬件", "设备", "cpu", "显卡", "gpu")):
            hw_count = {}
            for r in records:
                hw = r.get("hardware", {})
                for k, v in hw.items():
                    hw_count[k] = hw_count.get(k, 0) + 1
            if not hw_count:
                return "📦 暂无硬件信息记录。"
            return f"💻 硬件统计：\n\n" + \
                   "\n".join(f"• {k}: {v}条记录" for k, v in hw_count.items())
        
        # 默认响应
        return f"🤔 我理解您的问题：{query}\n\n" \
               f"目前我支持以下查询：\n" \
               f"• 数据统计（总数、金额等）\n" \
               f"• 逾期提醒\n" \
               f"• 到期提醒\n" \
               f"• 高价值客户\n" \
               f"• 欠款情况\n" \
               f"• 财务收入\n" \
               f"• 硬件统计\n\n" \
               f"您可以尝试问我：\"统计一下总数据\" 或 \"有多少逾期记录？\""
