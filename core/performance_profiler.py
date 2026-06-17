#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
性能分析器 - Phase 4 Week 8 Day 2
用于测量系统性能：仪表板加载、报表生成、数据库查询
"""

import time
import cProfile
import pstats
import io
import psutil
import os
from typing import Dict, List, Callable, Any, Optional
from datetime import datetime
from dataclasses import dataclass, field
import json


@dataclass
class PerformanceMetric:
    """单个性能指标"""
    name: str
    duration_ms: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    status: str = "success"  # success, warning, error
    
    def __post_init__(self):
        """确定性能状态"""
        if self.duration_ms < 500:
            self.status = "success"
        elif self.duration_ms < 2000:
            self.status = "warning"
        else:
            self.status = "error"


@dataclass
class PerformanceReport:
    """性能报告"""
    title: str
    metrics: List[PerformanceMetric] = field(default_factory=list)
    memory_usage_mb: float = 0.0
    cpu_percent: float = 0.0
    
    def add_metric(self, name: str, duration_ms: float):
        """添加指标"""
        self.metrics.append(PerformanceMetric(name, duration_ms))
    
    def get_summary(self) -> Dict[str, Any]:
        """获取汇总"""
        if not self.metrics:
            return {"metrics_count": 0, "avg_duration_ms": 0}
        
        durations = [m.duration_ms for m in self.metrics]
        return {
            "title": self.title,
            "metrics_count": len(self.metrics),
            "avg_duration_ms": sum(durations) / len(durations),
            "min_duration_ms": min(durations),
            "max_duration_ms": max(durations),
            "memory_usage_mb": self.memory_usage_mb,
            "cpu_percent": self.cpu_percent,
            "success_count": sum(1 for m in self.metrics if m.status == "success"),
            "warning_count": sum(1 for m in self.metrics if m.status == "warning"),
            "error_count": sum(1 for m in self.metrics if m.status == "error"),
        }


class PerformanceProfiler:
    """性能分析器"""
    
    def __init__(self):
        self.reports: Dict[str, PerformanceReport] = {}
        self.process = psutil.Process(os.getpid())
        
    def start_measurement(self, name: str) -> 'PerformanceMeasurement':
        """开始测量"""
        return PerformanceMeasurement(name, self)
    
    def add_report(self, title: str, report: PerformanceReport):
        """添加报告"""
        self.reports[title] = report
    
    def profile_function(self, func: Callable, *args, **kwargs) -> tuple:
        """分析函数性能"""
        profiler = cProfile.Profile()
        profiler.enable()
        
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        duration = (time.perf_counter() - start_time) * 1000
        
        profiler.disable()
        
        # 获取性能统计
        s = io.StringIO()
        ps = pstats.Stats(profiler, stream=s).sort_stats('cumulative')
        ps.print_stats(10)  # 打印前10个
        
        return result, duration, s.getvalue()
    
    def measure_query_performance(self, query_func: Callable, iterations: int = 5) -> Dict[str, Any]:
        """测量查询性能"""
        report = PerformanceReport(title="数据库查询性能")
        
        for i in range(iterations):
            with self.start_measurement(f"查询 #{i+1}") as measurement:
                query_func()
            report.add_metric(f"查询 #{i+1}", measurement.duration_ms)
        
        # 测量内存使用
        report.memory_usage_mb = self.process.memory_info().rss / 1024 / 1024
        report.cpu_percent = self.process.cpu_percent(interval=0.1)
        
        return report.get_summary()
    
    def get_system_status(self) -> Dict[str, Any]:
        """获取系统状态"""
        return {
            "memory_usage_mb": self.process.memory_info().rss / 1024 / 1024,
            "memory_percent": self.process.memory_percent(),
            "cpu_percent": self.process.cpu_percent(interval=0.1),
            "num_threads": self.process.num_threads(),
        }
    
    def print_all_reports(self):
        """打印所有报告"""
        for title, report in self.reports.items():
            print(f"\n{'='*60}")
            print(f"报告: {title}")
            print(f"{'='*60}")
            summary = report.get_summary()
            for key, value in summary.items():
                if isinstance(value, float):
                    print(f"{key}: {value:.2f}")
                else:
                    print(f"{key}: {value}")
            
            print(f"\n详细指标:")
            for metric in report.metrics:
                print(f"  {metric.name}: {metric.duration_ms:.2f}ms [{metric.status}]")
    
    def export_json(self, filepath: str):
        """导出为JSON"""
        data = {
            "timestamp": datetime.now().isoformat(),
            "system_status": self.get_system_status(),
            "reports": {
                title: report.get_summary()
                for title, report in self.reports.items()
            }
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)


class PerformanceMeasurement:
    """性能测量上下文管理器"""
    
    def __init__(self, name: str, profiler: PerformanceProfiler):
        self.name = name
        self.profiler = profiler
        self.start_time = None
        self.duration_ms = 0
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.duration_ms = (time.perf_counter() - self.start_time) * 1000
        if exc_type is None:
            # 测量成功
            pass
        return False


# 便捷函数
profiler = PerformanceProfiler()

def measure_time(func: Callable) -> Callable:
    """装饰器：测量函数执行时间"""
    def wrapper(*args, **kwargs):
        with profiler.start_measurement(func.__name__) as measurement:
            result = func(*args, **kwargs)
        print(f"{func.__name__}: {measurement.duration_ms:.2f}ms")
        return result
    return wrapper
