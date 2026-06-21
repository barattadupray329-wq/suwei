#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缓存管理器 - Phase 4 Week 8 Day 2
为仪表板KPI、报表数据和数据库查询结果提供高效缓存
"""

from typing import Any, Dict, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import hashlib
import json


@dataclass
class CacheEntry:
    """缓存条目"""
    key: str
    value: Any
    created_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    hit_count: int = 0
    
    def is_expired(self) -> bool:
        """检查是否过期"""
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at
    
    def record_hit(self):
        """记录命中"""
        self.hit_count += 1


class CacheManager:
    """缓存管理器 - 支持TTL和手动失效"""
    
    def __init__(self, max_size: int = 1000):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "total_queries": 0,
        }
    
    def _generate_key(self, *args, **kwargs) -> str:
        """生成缓存键"""
        # 创建键的字符串表示
        key_str = json.dumps({
            "args": [str(arg) for arg in args],
            "kwargs": {k: str(v) for k, v in sorted(kwargs.items())}
        }, sort_keys=True)
        
        # 使用哈希值作为键
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        self.stats["total_queries"] += 1
        
        if key not in self.cache:
            self.stats["misses"] += 1
            return None
        
        entry = self.cache[key]
        
        # 检查是否过期
        if entry.is_expired():
            del self.cache[key]
            self.stats["misses"] += 1
            return None
        
        # 记录命中
        self.stats["hits"] += 1
        entry.record_hit()
        return entry.value
    
    def put(self, key: str, value: Any, ttl_seconds: int = 300):
        """设置缓存值"""
        # 检查缓存大小
        if len(self.cache) >= self.max_size:
            self._evict_oldest()
        
        expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
        self.cache[key] = CacheEntry(key, value, expires_at=expires_at)
    
    def delete(self, key: str):
        """删除缓存项"""
        if key in self.cache:
            del self.cache[key]
    
    def clear(self):
        """清空缓存"""
        self.cache.clear()
    
    def _evict_oldest(self):
        """删除最旧的项"""
        if not self.cache:
            return
        
        # 找到最旧的项（基于创建时间）
        oldest_key = min(
            self.cache.keys(),
            key=lambda k: self.cache[k].created_at
        )
        del self.cache[oldest_key]
        self.stats["evictions"] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        if self.stats["total_queries"] == 0:
            hit_rate = 0.0
        else:
            hit_rate = self.stats["hits"] / self.stats["total_queries"] * 100
        
        return {
            "cache_size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.stats["hits"],
            "misses": self.stats["misses"],
            "total_queries": self.stats["total_queries"],
            "hit_rate_percent": hit_rate,
            "evictions": self.stats["evictions"],
        }
    
    def clear_expired(self):
        """清理过期的缓存项"""
        expired_keys = [
            key for key, entry in self.cache.items()
            if entry.is_expired()
        ]
        for key in expired_keys:
            del self.cache[key]
        return len(expired_keys)


class CachedFunction:
    """缓存装饰器 - 用于缓存函数结果"""
    
    def __init__(self, cache_manager: CacheManager, ttl_seconds: int = 300):
        self.cache_manager = cache_manager
        self.ttl_seconds = ttl_seconds
    
    def __call__(self, func: Callable) -> Callable:
        """装饰器实现"""
        def wrapper(*args, **kwargs):
            # 生成缓存键
            key = self.cache_manager._generate_key(func.__name__, *args, **kwargs)
            
            # 尝试从缓存获取
            cached_value = self.cache_manager.get(key)
            if cached_value is not None:
                return cached_value
            
            # 执行函数
            result = func(*args, **kwargs)
            
            # 存入缓存
            self.cache_manager.put(key, result, self.ttl_seconds)
            
            return result
        
        return wrapper


class KPICacheManager:
    """KPI专用缓存管理器"""
    
    def __init__(self):
        self.cache = CacheManager(max_size=100)
        self.kpi_keys = {
            "monthly_revenue",
            "annual_revenue",
            "active_contracts",
            "unpaid_amount",
            "overdue_contracts",
            "payment_rate",
            "monthly_exchanges",
            "high_risk_customers",
        }
    
    def get_kpi(self, kpi_key: str) -> Optional[Any]:
        """获取KPI值"""
        return self.cache.get(kpi_key)
    
    def set_kpi(self, kpi_key: str, value: Any, ttl_seconds: int = 300):
        """设置KPI值"""
        if kpi_key not in self.kpi_keys:
            raise ValueError(f"未知的KPI键: {kpi_key}")
        self.cache.put(kpi_key, value, ttl_seconds)
    
    def invalidate_all(self):
        """失效所有KPI缓存"""
        self.cache.clear()
    
    def invalidate_kpi(self, kpi_key: str):
        """失效特定KPI"""
        self.cache.delete(kpi_key)
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        return self.cache.get_stats()


class ReportCacheManager:
    """报表数据缓存管理器"""
    
    def __init__(self):
        self.cache = CacheManager(max_size=200)
    
    def get_report_data(self, report_type: str, filters: Dict = None) -> Optional[List]:
        """获取报表数据"""
        filters = filters or {}
        key = self._build_key(report_type, filters)
        return self.cache.get(key)
    
    def set_report_data(self, report_type: str, data: List, filters: Dict = None, ttl_seconds: int = 600):
        """缓存报表数据"""
        filters = filters or {}
        key = self._build_key(report_type, filters)
        self.cache.put(key, data, ttl_seconds)
    
    def invalidate_report(self, report_type: str):
        """失效特定类型的所有报表缓存"""
        keys_to_delete = [
            key for key in self.cache.cache.keys()
            if key.startswith(f"{report_type}:")
        ]
        for key in keys_to_delete:
            self.cache.delete(key)
    
    def _build_key(self, report_type: str, filters: Dict) -> str:
        """构建缓存键"""
        return self.cache._generate_key(report_type, filters)
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        return self.cache.get_stats()


class QueryCacheManager:
    """数据库查询结果缓存管理器"""
    
    def __init__(self):
        self.cache = CacheManager(max_size=500)
    
    def get_query_result(self, query: str, params: tuple = None) -> Optional[List]:
        """获取查询结果"""
        params = params or ()
        key = self.cache._generate_key(query, params)
        return self.cache.get(key)
    
    def set_query_result(self, query: str, result: List, params: tuple = None, ttl_seconds: int = 300):
        """缓存查询结果"""
        params = params or ()
        key = self.cache._generate_key(query, params)
        self.cache.put(key, result, ttl_seconds)
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计"""
        return self.cache.get_stats()


# 全局缓存实例
kpi_cache = KPICacheManager()
report_cache = ReportCacheManager()
query_cache = QueryCacheManager()
