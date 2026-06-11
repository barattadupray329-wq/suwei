#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI租赁助手模块 — 深色主题版
4大功能标签页：自动填充 / 智能问答 / 信息提取 / 数据验证
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog
import re
import json
from datetime import datetime
from theme.colors import DarkTheme


class AIAssistantDialog:
    """AI助手弹窗"""

    def __init__(self, parent, app):
        self.app = app
        self.dm = app.data_manager
        self.extracted = {}

        self.win = tk.Toplevel(parent)
        self.win.title("🤖 AI 租赁助手")
        self.win.geometry("960x680")
        self.win.transient(parent)
        self.win.grab_set()
        self.win.configure(bg=DarkTheme.BG_PRIMARY)
        self._center(960, 680)
        self._build()

    def _center(self, w, h):
        x = (self.win.winfo_screenwidth() // 2) - (w // 2)
        y = (self.win.winfo_screenheight() // 2) - (h // 2)
        self.win.geometry(f"{w}x{h}+{x}+{y}")

    def _build(self):
        header = tk.Frame(self.win, bg=DarkTheme.BG_SECONDARY, height=56)
        header.pack(fill=tk.X)
        header.pack_propagate(False)
        tk.Label(header, text="🤖 AI 租赁信息助手", font=("微软雅黑", 16, "bold"),
                 fg=DarkTheme.ACCENT_CYAN, bg=DarkTheme.BG_SECONDARY).pack(side=tk.LEFT, padx=16, pady=8)

        nb = ttk.Notebook(self.win)
        nb.pack(fill=tk.BOTH, expand=True, padx=12, pady=10)
        self._tab_auto_fill(nb)
        self._tab_qa(nb)
        self._tab_extract(nb)
        self._tab_validate(nb)

    def _scroll_text(self, parent, height=8):
        t = scrolledtext.ScrolledText(parent, height=height, font=DarkTheme.FONT_MONO,
                                       wrap=tk.WORD, bg=DarkTheme.BG_INPUT, fg=DarkTheme.TEXT_PRIMARY,
                                       insertbackground=DarkTheme.TEXT_PRIMARY)
        t.pack(fill=tk.BOTH, expand=True)
        return t

    def _btn(self, parent, text, cmd, color=DarkTheme.ACCENT_BLUE):
        b = tk.Button(parent, text=text, font=DarkTheme.FONT_LABEL, fg="white",
                      bg=color, relief=tk.FLAT, cursor="hand2", command=cmd, padx=14, pady=5)
        b.pack(side=tk.LEFT, padx=4)
        return b

    def _extract_rental_info(self, text):
        d = {}
        m = re.search(r'(?:租赁人|姓名|承租.?人)是?([\u4e00-\u9fa5]{2,4})', text)
        if m: d["租赁人"] = m.group(1).strip()
        m = re.search(r'(?:电话|手机|联系电话)([\d]{11})', text)
        if m: d["联系电话"] = m.group(1)
        m = re.search(r'(?:身份证)([\d]{18}|[\d]{17}[xX])', text)
        if m: d["身份证"] = m.group(1)
        m = re.search(r'(?:地址|住址)([\u4e00-\u9fa5]+)', text)
        if m: d["地址"] = m.group(1).strip()
        m = re.search(r'(?:起租|开始)(\d{4}[年-]\d{1,2}[月-]\d{1,2})', text)
        if m: d["起租日期"] = m.group(1).replace("年", "-").replace("月", "-")
        m = re.search(r'(?:到期|截止|到|至)(\d{4}[年-]\d{1,2}[月-]\d{1,2})', text)
        if m: d["到期日期"] = m.group(1).replace("年", "-").replace("月", "-")
        m = re.search(r'(?:月租|月费)(\d+)(?:元|¥)?', text)
        if m: d["月租"] = m.group(1)
        m = re.search(r'(?:总租|总租金|共)(\d+)(?:元|¥)?', text)
        if m: d["总租金"] = m.group(1)
        m = re.search(r'(?:押金)(\d+)(?:元|¥)?', text)
        if m: d["押金"] = m.group(1)
        return d

    def _validate_data(self, data):
        errors, warns = [], []
        for f in ["租赁人", "联系电话", "起租日期", "到期日期"]:
            if not str(data.get(f, "")).strip():
                errors.append(f"缺少必填字段: {f}")

        phone = str(data.get("联系电话", "")).strip()
        if phone and (not phone.isdigit() or len(phone) != 11):
            errors.append(f"联系电话格式错误: {phone}")

        id_card = str(data.get("身份证", "")).strip()
        if id_card:
            if not re.match(r"^\d{17}[\dXx]$", id_card):
                warns.append(f"身份证格式可疑: {id_card}")

        def parse_date(label):
            text = str(data.get(label, "")).strip()
            if not text:
                return None
            norm = text.replace("年", "-").replace("月", "-").replace("日", "")
            try:
                return datetime.strptime(norm, "%Y-%m-%d")
            except ValueError:
                errors.append(f"{label}格式错误: {text} (应为 YYYY-MM-DD)")
                return None

        start_dt = parse_date("起租日期")
        end_dt = parse_date("到期日期")
        if start_dt and end_dt and start_dt > end_dt:
            errors.append("起租日期晚于到期日期")

        def parse_amount(label):
            text = str(data.get(label, "")).strip()
            if not text:
                return None
            try:
                val = float(text)
            except ValueError:
                errors.append(f"{label}不是数字: {text}")
                return None
            if val < 0:
                errors.append(f"{label}不能为负数")
            return val

        m = parse_amount("月租")
        t = parse_amount("总租金")
        d = parse_amount("押金")
        if m is not None and t is not None and t < m:
            warns.append("总租金小于月租，请确认数据是否正确")
        if d is not None and m is not None and d > m * 6:
            warns.append("押金明显偏高，请确认")

        return errors, warns

    def _record_to_flat(self, record):
        renter = record.get("renter", {})
        lease = record.get("lease_info", {})
        return {
            "租赁人": renter.get("name", ""),
            "联系电话": renter.get("phone", ""),
            "身份证": renter.get("id_card", ""),
            "地址": renter.get("address", ""),
            "起租日期": lease.get("start_date", ""),
            "到期日期": lease.get("end_date", ""),
            "月租": lease.get("monthly_rent", ""),
            "总租金": lease.get("total_rent", ""),
            "押金": lease.get("deposit", ""),
        }

    def _tab_auto_fill(self, nb):
        fr = ttk.Frame(nb, padding=12)
        nb.add(fr, text="📝 自动填充")

        inp = ttk.LabelFrame(fr, text=" 输入  ", padding=8)
        inp.pack(fill=tk.BOTH, expand=True, pady=(0, 6))
        self.af_input = self._scroll_text(inp, 6)
        self.af_input.insert("1.0", "租赁人张三，电话13800000000，起租2024-01-01到2024-12-31，月租500元")

        out = ttk.LabelFrame(fr, text=" 结果  ", padding=8)
        out.pack(fill=tk.BOTH, expand=True, pady=(6, 0))
        self.af_output = self._scroll_text(out, 6)
        self.af_output.config(state=tk.DISABLED)

        bf = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(8, 0))
        self._btn(bf, "🚀 提取", self._do_auto_fill, DarkTheme.ACCENT_BLUE)
        self._btn(bf, "🗑️ 清空", lambda: self.af_input.delete("1.0", tk.END), DarkTheme.BG_HOVER)

    def _do_auto_fill(self):
        txt = self.af_input.get("1.0", tk.END).strip()
        if not txt:
            messagebox.showwarning("提示", "请输入文本")
            return
        self.extracted = self._extract_rental_info(txt)
        self.af_output.config(state=tk.NORMAL)
        self.af_output.delete("1.0", tk.END)
        lines = ["【提取结果】\n"]
        for k, v in self.extracted.items():
            lines.append(f"{k}: {v}")
        self.af_output.insert("1.0", "\n".join(lines))
        self.af_output.config(state=tk.DISABLED)

    def _tab_qa(self, nb):
        fr = ttk.Frame(nb, padding=12)
        nb.add(fr, text="💬 智能问答")

        qf = ttk.LabelFrame(fr, text=" 常见问题  ", padding=8)
        qf.pack(fill=tk.X, pady=(0, 8))
        for txt, ans in [("合同", "租赁合同包含：姓名、联系方式、期限、租金、押金等"), 
                         ("计算", "总租金 = 月租 × 月数"),
                         ("逾期", "逾期自动标记，发送通知，协商处理")]:
            tk.Button(qf, text=f"Q: {txt}", font=DarkTheme.FONT_NORMAL, fg="white",
                      bg=DarkTheme.ACCENT_PURPLE, relief=tk.FLAT, cursor="hand2",
                      command=lambda a=ans: self._show_qa(a)).pack(side=tk.LEFT, padx=4)

        out = ttk.LabelFrame(fr, text=" 回答  ", padding=8)
        out.pack(fill=tk.BOTH, expand=True, pady=(6, 0))
        self.qa_output = self._scroll_text(out, 12)
        self.qa_output.config(state=tk.DISABLED)

    def _show_qa(self, ans):
        self.qa_output.config(state=tk.NORMAL)
        self.qa_output.delete("1.0", tk.END)
        self.qa_output.insert("1.0", ans)
        self.qa_output.config(state=tk.DISABLED)

    def _tab_extract(self, nb):
        fr = ttk.Frame(nb, padding=12)
        nb.add(fr, text="🔍 信息提取")

        inp = ttk.LabelFrame(fr, text=" 输入  ", padding=8)
        inp.pack(fill=tk.BOTH, expand=True, pady=(0, 6))
        self.ex_input = self._scroll_text(inp, 5)

        out = ttk.LabelFrame(fr, text=" JSON输出  ", padding=8)
        out.pack(fill=tk.BOTH, expand=True, pady=(6, 0))
        self.ex_output = self._scroll_text(out, 10)
        self.ex_output.config(state=tk.DISABLED)

        bf = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(6, 0))
        self._btn(bf, "📊 提取", self._do_extract, DarkTheme.ACCENT_BLUE)

    def _do_extract(self):
        txt = self.ex_input.get("1.0", tk.END).strip()
        data = self._extract_rental_info(txt)
        self.ex_output.config(state=tk.NORMAL)
        self.ex_output.delete("1.0", tk.END)
        self.ex_output.insert("1.0", json.dumps(data, ensure_ascii=False, indent=2))
        self.ex_output.config(state=tk.DISABLED)

    def _tab_validate(self, nb):
        fr = ttk.Frame(nb, padding=12)
        nb.add(fr, text="✓ 验证")

        out = ttk.LabelFrame(fr, text=" 报告  ", padding=8)
        out.pack(fill=tk.BOTH, expand=True, pady=(0, 8))
        self.val_output = self._scroll_text(out, 16)
        self.val_output.config(state=tk.DISABLED)

        bf = tk.Frame(fr, bg=DarkTheme.BG_PRIMARY)
        bf.pack(fill=tk.X, pady=(0, 0))
        self._btn(bf, "✓ 验证全部", self._validate_all, DarkTheme.ACCENT_BLUE)

    def _validate_all(self):
        records = self.dm.get_records()
        report = []
        report.append("【数据验证报告】")
        report.append("")
        report.append(f"记录总数: {len(records)}")

        valid_count = 0
        warn_count = 0
        error_count = 0

        if self.extracted:
            e, w = self._validate_data(self.extracted)
            report.append("")
            report.append("【当前提取数据】")
            if not e and not w:
                report.append("  ✅ 通过")
            else:
                for item in e:
                    report.append(f"  ❌ {item}")
                for item in w:
                    report.append(f"  ⚠️ {item}")

        for idx, rec in enumerate(records, 1):
            rid = rec.get("id", f"#{idx}")
            data = self._record_to_flat(rec)
            errors, warns = self._validate_data(data)
            if errors:
                error_count += 1
                report.append("")
                report.append(f"[记录 {rid}]")
                for item in errors:
                    report.append(f"  ❌ {item}")
                for item in warns:
                    report.append(f"  ⚠️ {item}")
            elif warns:
                warn_count += 1
                report.append("")
                report.append(f"[记录 {rid}]")
                for item in warns:
                    report.append(f"  ⚠️ {item}")
            else:
                valid_count += 1

        report.append("")
        report.append("【汇总】")
        report.append(f"  ✅ 完全通过: {valid_count}")
        report.append(f"  ⚠️ 仅警告: {warn_count}")
        report.append(f"  ❌ 存在错误: {error_count}")
        if error_count == 0:
            report.append("  🎉 未发现阻断性错误")

        txt = "\n".join(report)
        self.val_output.config(state=tk.NORMAL)
        self.val_output.delete("1.0", tk.END)
        self.val_output.insert("1.0", txt)
        self.val_output.config(state=tk.DISABLED)
