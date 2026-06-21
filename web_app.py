#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""轻量级 Web 入口。

这是一个面向小数据量部署的最小可用 Web 版本：
- 浏览器登录
- 查看租赁记录
- 新增/删除记录
- 查看基础统计

后续可以继续扩展为完整的多页管理后台。
"""

from __future__ import annotations

import cgi
import html
import json
import os
from pathlib import Path
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from core.auth import AuthManager
from core.data_manager import DataManager


class WebApp:
    def __init__(self):
        self.dm = DataManager()
        self.auth = AuthManager(self.dm)
        self._sessions: dict[str, str] = {}
        self.upload_dir = self.dm.data_dir / "uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def render_layout(self, title: str, body: str, message: str = "") -> str:
        msg_html = f'<div class="msg">{html.escape(message)}</div>' if message else ""
        return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)}</title>
  <style>
    body {{ font-family: 'Microsoft YaHei', system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }}
    .topbar {{ padding: 18px 24px; background: #111827; border-bottom: 1px solid #1f2937; }}
    .container {{ max-width: 1200px; margin: 0 auto; padding: 24px; }}
    .card {{ background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 18px; margin-bottom: 18px; }}
    input, textarea, select {{ width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid #334155; background: #0b1220; color: #e2e8f0; }}
    button, .btn {{ display: inline-block; padding: 10px 14px; border: 0; border-radius: 10px; background: #2563eb; color: white; text-decoration: none; cursor: pointer; }}
    .btn-danger {{ background: #dc2626; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border-bottom: 1px solid #1f2937; padding: 10px; text-align: left; vertical-align: top; }}
    .muted {{ color: #94a3b8; }}
    .msg {{ padding: 12px 14px; border-radius: 10px; background: #1e293b; border: 1px solid #334155; margin-bottom: 16px; }}
    .row {{ display: flex; gap: 12px; flex-wrap: wrap; }}
    .row > * {{ flex: 1 1 220px; }}
  </style>
</head>
<body>
  <div class="topbar">
    <div class="container">
      <strong>豆宇科技电脑租赁管理系统 Web 版</strong>
      <span class="muted"> · 适合小数据量公网部署</span>
    </div>
  </div>
  <div class="container">
    {msg_html}
    {body}
  </div>
</body>
</html>"""

    def handle_request(self, handler: BaseHTTPRequestHandler):
        parsed = urlparse(handler.path)
        path = parsed.path
        if path == "/":
            self.page_login(handler)
        elif path == "/dashboard":
            self.page_dashboard(handler)
        elif path == "/add":
            self.page_add(handler)
        elif path == "/detail":
            self.page_detail(handler)
        elif path == "/upload":
            self.page_upload(handler)
        elif path == "/delete":
            self.page_delete(handler)
        else:
            self.send_html(handler, "404", "<h1>404</h1><p>页面不存在</p>", HTTPStatus.NOT_FOUND)

    def is_logged_in(self, handler: BaseHTTPRequestHandler) -> bool:
        cookie = handler.headers.get("Cookie", "")
        for item in cookie.split(";"):
            if item.strip().startswith("session="):
                sid = item.strip().split("=", 1)[1]
                return sid in self._sessions
        return False

    def current_user(self, handler: BaseHTTPRequestHandler) -> str:
        cookie = handler.headers.get("Cookie", "")
        for item in cookie.split(";"):
            if item.strip().startswith("session="):
                sid = item.strip().split("=", 1)[1]
                return self._sessions.get(sid, "")
        return ""

    def read_post(self, handler: BaseHTTPRequestHandler) -> dict[str, str]:
        ctype, pdict = cgi.parse_header(handler.headers.get("content-type", ""))
        if ctype == "multipart/form-data":
            pdict["boundary"] = pdict.get("boundary", "").encode("utf-8")
            form = cgi.FieldStorage(fp=handler.rfile, headers=handler.headers, environ={"REQUEST_METHOD": "POST"}, keep_blank_values=True)
            data = {}
            for key in form.keys():
                field = form[key]
                data[key] = field.value if not isinstance(field, list) else field[0].value
            return data
        length = int(handler.headers.get("Content-Length", "0") or 0)
        raw = handler.rfile.read(length).decode("utf-8", errors="ignore")
        return {k: v[0] for k, v in parse_qs(raw).items()}

    def _parse_attachments(self, raw: str):
        if not raw:
            return []
        items = []
        for part in raw.split(";"):
            part = part.strip()
            if part:
                items.append(part)
        return items

    def send_html(self, handler: BaseHTTPRequestHandler, title: str, body: str, status: HTTPStatus = HTTPStatus.OK, message: str = ""):
        data = self.render_layout(title, body, message).encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", "text/html; charset=utf-8")
        handler.send_header("Content-Length", str(len(data)))
        handler.end_headers()
        handler.wfile.write(data)

    def redirect(self, handler: BaseHTTPRequestHandler, location: str):
        handler.send_response(HTTPStatus.SEE_OTHER)
        handler.send_header("Location", location)
        handler.end_headers()

    def page_login(self, handler: BaseHTTPRequestHandler):
        if handler.command == "POST":
            form = self.read_post(handler)
            username = form.get("username", "").strip()
            password = form.get("password", "").strip()
            success, role = self.auth.verify_credentials(username, password)
            if success:
                sid = os.urandom(16).hex()
                self._sessions[sid] = username
                handler.send_response(HTTPStatus.SEE_OTHER)
                handler.send_header("Set-Cookie", f"session={sid}; HttpOnly; Path=/")
                handler.send_header("Location", "/dashboard")
                handler.end_headers()
                return
            self.send_html(handler, "登录失败", self.login_form(), message="用户名或密码错误")
            return
        self.send_html(handler, "登录", self.login_form())

    def login_form(self) -> str:
        return """
        <div class="card">
          <h2>登录系统</h2>
          <form method="post" action="/">
            <div class="row">
              <div><label>用户名</label><input name="username" value="admin" /></div>
              <div><label>密码</label><input name="password" type="password" value="admin123" /></div>
            </div>
            <p><button type="submit">登录</button></p>
          </form>
        </div>
        """

    def page_dashboard(self, handler: BaseHTTPRequestHandler):
        if not self.is_logged_in(handler):
            self.redirect(handler, "/")
            return
        stats = self.dm.get_stats()
        records = self.dm.get_records()[:30]
        rows = "".join(
            f"<tr><td><a href='/detail?id={html.escape(r.get('id',''))}'>{html.escape(r.get('id',''))}</a></td><td>{html.escape(r.get('renter',{}).get('name',''))}</td><td>{html.escape(r.get('status',''))}</td><td>{html.escape(r.get('lease_info',{}).get('end_date',''))}</td><td>{len(r.get('attachments',[]) or [])}</td><td><a class='btn' href='/detail?id={html.escape(r.get('id',''))}'>查看</a></td></tr>"
            for r in records
        )
        body = f"""
        <div class="card">
          <h2>概览</h2>
          <div class="grid">
            <div class="card"><h3>{stats['total']}</h3><div class="muted">总记录</div></div>
            <div class="card"><h3>{stats['active']}</h3><div class="muted">在租</div></div>
            <div class="card"><h3>{stats['expired']}</h3><div class="muted">已逾期</div></div>
            <div class="card"><h3>{stats['returned']}</h3><div class="muted">已退租</div></div>
          </div>
          <p><a class="btn" href="/add">新增记录</a></p>
        </div>
        <div class="card">
          <h2>最近记录</h2>
          <table>
            <thead><tr><th>ID</th><th>租户</th><th>状态</th><th>到期日</th><th>附件</th><th>操作</th></tr></thead>
            <tbody>{rows or '<tr><td colspan="6" class="muted">暂无数据</td></tr>'}</tbody>
          </table>
        </div>
        """
        self.send_html(handler, "仪表板", body, message=f"当前登录：{self.current_user(handler)}")

    def page_add(self, handler: BaseHTTPRequestHandler):
        if not self.is_logged_in(handler):
            self.redirect(handler, "/")
            return
        if handler.command == "POST":
            form = self.read_post(handler)
            try:
                attachments = self._save_uploads(form)
                record = {
                    "renter": {"name": form.get("name", ""), "phone": form.get("phone", "")},
                    "lease_info": {"start_date": form.get("start_date", ""), "end_date": form.get("end_date", ""), "total_rent": float(form.get("total_rent", 0) or 0)},
                    "hardware": {"pc_type": form.get("hardware", "")},
                    "status": form.get("status", "在租"),
                    "attachments": attachments,
                }
                self.dm.add_record(record)
                self.redirect(handler, "/dashboard")
                return
            except Exception:
                self.send_html(handler, "新增失败", self.add_form(), message="填写内容有误")
                return
        self.send_html(handler, "新增记录", self.add_form())

    def add_form(self) -> str:
        return """
        <div class="card">
          <h2>新增租赁记录</h2>
          <form method="post" action="/add">
            <div class="row">
              <div><label>租户姓名</label><input name="name" /></div>
              <div><label>电话</label><input name="phone" /></div>
              <div><label>开始日期</label><input name="start_date" placeholder="2026-06-21" /></div>
              <div><label>到期日期</label><input name="end_date" placeholder="2026-07-21" /></div>
            </div>
            <div class="row">
              <div><label>总租金</label><input name="total_rent" value="0" /></div>
              <div><label>状态</label><input name="status" value="在租" /></div>
            </div>
            <p><label>硬件描述</label><input name="hardware" placeholder="例如 i5 16G 512G" /></p>
            <p><label>上传附件</label><input type="file" name="files" multiple /></p>
            <p class="muted">支持图片、PDF 等文件，上传后自动保存到服务器本地目录</p>
            <p><button type="submit">保存</button> <a class="btn" href="/dashboard">返回</a></p>
          </form>
        </div>
        """

    def _save_uploads(self, form) -> list[str]:
        saved = []
        files = form.getlist("files") if hasattr(form, "getlist") else []
        for item in files:
            if not getattr(item, "filename", ""):
                continue
            filename = Path(item.filename).name
            target = self.upload_dir / f"{os.urandom(6).hex()}_{filename}"
            with open(target, "wb") as f:
                f.write(item.file.read())
            saved.append(f"uploads/{target.name}")
        return saved

    def page_detail(self, handler: BaseHTTPRequestHandler):
        if not self.is_logged_in(handler):
            self.redirect(handler, "/")
            return
        qs = parse_qs(urlparse(handler.path).query)
        record_id = qs.get("id", [""])[0].strip()
        record = self.dm.get_record_by_id(record_id) if record_id else None
        if not record:
            self.send_html(handler, "详情", "<div class='card'>未找到记录</div>")
            return
        attachments = record.get("attachments", []) or []
        att_html = "".join(
            f"<li>{html.escape(str(item))}</li>" for item in attachments
        ) or "<li class='muted'>暂无附件</li>"
        body = f"""
        <div class='card'>
          <h2>记录详情</h2>
          <p><strong>ID：</strong>{html.escape(record.get('id',''))}</p>
          <p><strong>租户：</strong>{html.escape(record.get('renter',{}).get('name',''))}</p>
          <p><strong>电话：</strong>{html.escape(record.get('renter',{}).get('phone',''))}</p>
          <p><strong>状态：</strong>{html.escape(record.get('status',''))}</p>
          <p><strong>硬件：</strong>{html.escape(record.get('hardware_summary',''))}</p>
          <p><strong>附件：</strong></p>
          <ul>{att_html}</ul>
          <form method='post' action='/upload' enctype='multipart/form-data'>
            <input type='hidden' name='record_id' value='{html.escape(record.get('id',''))}' />
            <p><label>上传图片/附件</label><input type='file' name='file' multiple /></p>
            <p><button type='submit'>上传到该记录</button></p>
          </form>
          <p><a class='btn' href='/dashboard'>返回</a></p>
        </div>
        """
        self.send_html(handler, "详情", body)

    def page_upload(self, handler: BaseHTTPRequestHandler):
        if not self.is_logged_in(handler):
            self.redirect(handler, "/")
            return
        if handler.command != "POST":
            self.redirect(handler, "/dashboard")
            return
        ctype, _ = cgi.parse_header(handler.headers.get("content-type", ""))
        if ctype != "multipart/form-data":
            self.redirect(handler, "/dashboard")
            return
        form = cgi.FieldStorage(fp=handler.rfile, headers=handler.headers, environ={"REQUEST_METHOD": "POST"}, keep_blank_values=True)
        files = self._save_uploads(form)
        body = "<div class='card'><h2>上传完成</h2><ul>" + "".join(f"<li>{html.escape(p)}</li>" for p in files) + "</ul><p><a class='btn' href='/dashboard'>返回</a></p></div>"
        self.send_html(handler, "上传完成", body)

    def page_upload(self, handler: BaseHTTPRequestHandler):
        if not self.is_logged_in(handler):
            self.redirect(handler, "/")
            return
        if handler.command != "POST":
            self.redirect(handler, "/dashboard")
            return
        ctype, pdict = cgi.parse_header(handler.headers.get("content-type", ""))
        if ctype != "multipart/form-data":
            self.redirect(handler, "/dashboard")
            return
        pdict["boundary"] = pdict.get("boundary", "").encode("utf-8")
        form = cgi.FieldStorage(fp=handler.rfile, headers=handler.headers, environ={"REQUEST_METHOD": "POST"}, keep_blank_values=True)
        record_id = form.getvalue("record_id", "").strip()
        record = self.dm.get_record_by_id(record_id)
        if not record:
            self.redirect(handler, "/dashboard")
            return
        uploaded = []
        file_field = form["file"] if "file" in form else None
        if file_field:
            fields = file_field if isinstance(file_field, list) else [file_field]
            for item in fields:
                filename = os.path.basename(item.filename or "upload.bin")
                if not filename:
                    continue
                save_name = f"{record_id}_{len(uploaded)+1}_{filename}"
                save_path = self.upload_dir / save_name
                with open(save_path, "wb") as f:
                    f.write(item.file.read())
                rel = str(Path("data") / "uploads" / save_name).replace("\\", "/")
                uploaded.append(rel)
        record.setdefault("attachments", [])
        record["attachments"].extend(uploaded)
        self.dm.update_record(record_id, {"attachments": record["attachments"]})
        self.redirect(handler, f"/detail?id={record_id}")

    def page_delete(self, handler: BaseHTTPRequestHandler):
        if not self.is_logged_in(handler):
            self.redirect(handler, "/")
            return
        form = self.read_post(handler) if handler.command == "POST" else parse_qs(urlparse(handler.path).query)
        record_id = (form.get("id", [""])[0] if isinstance(form.get("id"), list) else form.get("id", "")).strip()
        if record_id:
            self.dm.delete_record(record_id)
        self.redirect(handler, "/dashboard")


def run(host: str = "0.0.0.0", port: int = 8000):
    app = WebApp()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            app.handle_request(self)

        def do_POST(self):
            app.handle_request(self)

        def log_message(self, fmt, *args):
            return

    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Web 版已启动：http://{host}:{port}")
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
