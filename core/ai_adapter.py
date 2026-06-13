#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM API 适配器
支持多种AI模型接入 (OpenAI, Claude, 本地模型)
通过配置文件管理 API Key 和模型选择
"""

import json
import os
from pathlib import Path
from datetime import datetime


class AIConfig:
    """AI 配置管理器"""
    
    def __init__(self, config_file=None):
        if config_file is None:
            config_file = Path(__file__).parent.parent / "ai_config.json"
        self.config_file = config_file
        self.config = self._load_config()
    
    def _load_config(self):
        """加载配置文件"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        return self._default_config()
    
    def _default_config(self):
        """默认配置"""
        return {
            "provider": "rule_based",  # rule_based, openai, claude, local
            "api_key": "",
            "model": "",
            "api_base": "",
            "max_tokens": 2000,
            "temperature": 0.7,
            "timeout": 30,
            "enabled": False,
            "usage_stats": {
                "total_queries": 0,
                "total_tokens": 0,
                "last_query": ""
            }
        }
    
    def save(self):
        """保存配置"""
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存配置失败: {e}")
            return False
    
    def get(self, key, default=None):
        return self.config.get(key, default)
    
    def set(self, key, value):
        self.config[key] = value
    
    def is_enabled(self):
        return self.config.get("enabled", False) and self.config.get("provider") != "rule_based"
    
    def update_usage(self, tokens_used=0, query=""):
        stats = self.config.get("usage_stats", {})
        stats["total_queries"] = stats.get("total_queries", 0) + 1
        stats["total_tokens"] = stats.get("total_tokens", 0) + tokens_used
        stats["last_query"] = query
        self.config["usage_stats"] = stats
        self.save()


class LLMAdapter:
    """LLM 适配器 - 统一接口"""
    
    def __init__(self, config=None):
        if config is None:
            config = AIConfig()
        self.config = config
        self._client = None
    
    def _get_client(self):
        """获取对应的AI客户端"""
        provider = self.config.get("provider", "rule_based")
        
        if provider == "openai":
            return self._get_openai_client()
        elif provider == "claude":
            return self._get_claude_client()
        elif provider == "local":
            return self._get_local_client()
        else:
            return None  # 规则引擎模式
    
    def _get_openai_client(self):
        """获取 OpenAI 客户端"""
        if self._client is None:
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    api_key=self.config.get("api_key", ""),
                    base_url=self.config.get("api_base", "https://api.openai.com/v1")
                )
            except ImportError:
                print("未安装 openai 库: pip install openai")
                return None
            except Exception as e:
                print(f"OpenAI 客户端初始化失败: {e}")
                return None
        return self._client
    
    def _get_claude_client(self):
        """获取 Claude 客户端"""
        if self._client is None:
            try:
                from anthropic import Anthropic
                self._client = Anthropic(
                    api_key=self.config.get("api_key", "")
                )
            except ImportError:
                print("未安装 anthropic 库: pip install anthropic")
                return None
            except Exception as e:
                print(f"Claude 客户端初始化失败: {e}")
                return None
        return self._client
    
    def _get_local_client(self):
        """获取本地模型客户端 (预留)"""
        return None
    
    def chat(self, messages, system_prompt="", **kwargs):
        """
        发送聊天请求
        
        Args:
            messages: 消息列表 [{"role": "user/assistant", "content": "..."}]
            system_prompt: 系统提示
            **kwargs: 其他参数 (model, temperature, max_tokens)
        
        Returns:
            str: AI 回复内容
        """
        if not self.config.is_enabled():
            return None  # 回退到规则引擎
        
        provider = self.config.get("provider", "rule_based")
        model = kwargs.get("model") or self.config.get("model", "gpt-3.5-turbo")
        temperature = kwargs.get("temperature", self.config.get("temperature", 0.7))
        max_tokens = kwargs.get("max_tokens", self.config.get("max_tokens", 2000))
        timeout = kwargs.get("timeout", self.config.get("timeout", 30))
        
        try:
            if provider == "openai":
                return self._chat_openai(messages, system_prompt, model, temperature, max_tokens, timeout)
            elif provider == "claude":
                return self._chat_claude(messages, system_prompt, model, temperature, max_tokens, timeout)
            else:
                return None
        except Exception as e:
            print(f"AI 请求失败: {e}")
            self.config.update_usage(0, f"Error: {str(e)[:50]}")
            return None
    
    def _chat_openai(self, messages, system_prompt, model, temperature, max_tokens, timeout):
        """OpenAI 对话"""
        client = self._get_client()
        if not client:
            return None
        
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)
        
        response = client.chat.completions.create(
            model=model,
            messages=full_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout
        )
        
        tokens_used = response.usage.total_tokens if response.usage else 0
        self.config.update_usage(tokens_used, messages[-1]["content"][:50])
        
        return response.choices[0].message.content
    
    def _chat_claude(self, messages, system_prompt, model, temperature, max_tokens, timeout):
        """Claude 对话"""
        client = self._get_client()
        if not client:
            return None
        
        # Claude 不需要 system 角色在消息中
        user_messages = [m for m in messages if m["role"] != "system"]
        
        response = client.messages.create(
            model=model,
            system=system_prompt,
            messages=user_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout
        )
        
        tokens_used = response.usage.input_tokens + response.usage.output_tokens
        self.config.update_usage(tokens_used, messages[-1]["content"][:50])
        
        return response.content[0].text
    
    def query_data(self, question: str, data_context: dict) -> str:
        """
        基于数据上下文的智能查询
        
        Args:
            question: 用户问题
            data_context: 数据上下文 (统计信息、记录等)
        
        Returns:
            str: AI 分析结果
        """
        if not self.config.is_enabled():
            return None
        
        context_str = json.dumps(data_context, ensure_ascii=False, indent=2)
        prompt = f"""你是一个租赁数据分析助手。基于以下数据回答用户的问题。

数据概览:
{context_str}

请用简洁、专业的语言回答，包含关键数据点。"""
        
        messages = [
            {"role": "user", "content": f"问题: {question}"}
        ]
        
        return self.chat(messages, system_prompt=prompt)
    
    def suggest_actions(self, records: list) -> list:
        """
        基于当前数据生成智能建议
        
        Args:
            records: 租赁记录列表
        
        Returns:
            list: 建议列表
        """
        if not self.config.is_enabled():
            return self._rule_based_suggestions(records)
        
        # 构建数据摘要
        summary = {
            "total_records": len(records),
            "overdue_count": sum(1 for r in records if r.get("status") == "已逾期"),
            "expiring_soon": 0,
            "unpaid_count": 0,
            "total_revenue": sum(float(r.get("lease_info", {}).get("total_rent", 0) or 0) for r in records),
        }
        
        today = datetime.now()
        from datetime import date
        for r in records:
            if r.get("status") != "在租": continue
            end_str = r.get("lease_info", {}).get("end_date", "")
            if not end_str: continue
            try:
                dt = datetime.strptime(end_str, "%Y-%m-%d").date()
                days = (dt - date.today()).days
                if days <= 7:
                    summary["expiring_soon"] += 1
            except: pass
            
            total = float(r.get("lease_info", {}).get("total_rent", 0) or 0)
            paid = float(r.get("paid_amount", 0) or 0)
            if paid < total:
                summary["unpaid_count"] += 1
        
        prompt = f"""你是一个租赁管理助手。根据以下业务数据，给出3-5条具体的行动建议。

业务数据:
- 总记录数: {summary['total_records']}
- 逾期未还: {summary['overdue_count']}
- 7天内到期: {summary['expiring_soon']}
- 未付清: {summary['unpaid_count']}
- 总租金: ¥{summary['total_revenue']:,.0f}

请给出具体的、可操作的建议。"""
        
        response = self.chat([{"role": "user", "content": "请给出行动建议"}], system_prompt=prompt)
        if response:
            return [line.strip() for line in response.split("\n") if line.strip()]
        return self._rule_based_suggestions(records)
    
    def _rule_based_suggestions(self, records: list) -> list:
        """基于规则的建议引擎"""
        suggestions = []
        today = date.today()
        
        overdue = [r for r in records if r.get("status") == "已逾期"]
        if overdue:
            suggestions.append(f"⚠️ 有 {len(overdue)} 条记录已逾期，建议及时联系客户")
        
        expiring = []
        for r in records:
            if r.get("status") != "在租": continue
            end_str = r.get("lease_info", {}).get("end_date", "")
            if not end_str: continue
            try:
                dt = datetime.strptime(end_str, "%Y-%m-%d").date()
                days = (dt - today).days
                if days <= 7:
                    expiring.append(r.get("renter", {}).get("name", ""))
            except: pass
        if expiring:
            suggestions.append(f"⏰ {', '.join(expiring[:3])}{' 等' if len(expiring) > 3 else ''} 的租赁即将到期，建议确认续租")
        
        unpaid = [r for r in records if float(r.get("paid_amount", 0) or 0) < float(r.get("lease_info", {}).get("total_rent", 0) or 0)]
        if unpaid:
            total_unpaid = sum(float(r.get("lease_info", {}).get("total_rent", 0) or 0) - float(r.get("paid_amount", 0) or 0) for r in unpaid)
            suggestions.append(f"💰 有 {len(unpaid)} 条记录未付清，涉及金额 ¥{total_unpaid:,.0f}")
        
        if not suggestions:
            suggestions.append("✅ 当前业务状态良好，无需特别处理")
        
        return suggestions


# 全局实例
_adapter_instance = None

def get_adapter():
    global _adapter_instance
    if _adapter_instance is None:
        _adapter_instance = LLMAdapter()
    return _adapter_instance

def reset_adapter():
    global _adapter_instance
    _adapter_instance = None
