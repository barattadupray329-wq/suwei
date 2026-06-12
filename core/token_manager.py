#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
登录令牌管理 - 24小时免登录
"""

import json
import os
import secrets
from datetime import datetime, timedelta


class TokenManager:
    """令牌管理器"""

    def __init__(self, token_file=None):
        if token_file is None:
            token_file = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       "..", "data", "tokens.json")
        self.token_file = token_file
        self.tokens = self._load()

    def _load(self):
        try:
            with open(self.token_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.token_file), exist_ok=True)
            with open(self.token_file, "w", encoding="utf-8") as f:
                json.dump(self.tokens, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存令牌失败: {e}")

    def generate(self, username: str) -> str:
        """生成24小时有效令牌"""
        token = secrets.token_urlsafe(32)
        expire = datetime.now() + timedelta(hours=24)
        self.tokens[token] = {
            "username": username,
            "expire_time": expire.isoformat(),
            "created_time": datetime.now().isoformat(),
        }
        self._save()
        return token

    def validate(self, token: str) -> str or None:
        """验证令牌，返回用户名或 None"""
        if token not in self.tokens:
            return None
        info = self.tokens[token]
        expire = datetime.fromisoformat(info["expire_time"])
        if datetime.now() > expire:
            del self.tokens[token]
            self._save()
            return None
        return info["username"]

    def revoke_user(self, username: str):
        """撤销某用户所有令牌"""
        to_remove = [t for t, i in self.tokens.items() if i["username"] == username]
        for t in to_remove:
            del self.tokens[t]
        self._save()

    def cleanup(self):
        """清理过期令牌"""
        now = datetime.now()
        expired = [t for t, i in self.tokens.items()
                    if now > datetime.fromisoformat(i["expire_time"])]
        for t in expired:
            del self.tokens[t]
        if expired:
            self._save()
