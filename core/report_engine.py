#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
报表数据引擎 - v2 租赁合同报表查询层
封装所有报表查询逻辑，避免 UI 直接拼 SQL
支持：客户欠款汇总、合同明细、设备更换统计、看板 KPI、CSV 导出
"""

from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
import csv
import io
from core.data_manager import DataManager


class ReportEngine:
    """报表数据引擎"""

    def __init__(self, data_manager: DataManager):
        self.dm = data_manager

    # ═══════════════════════════════════════
    # 客户欠款报表
    # ═══════════════════════════════════════

    def get_customer_arrears_summary(self) -> List[Dict]:
        """
        获取客户欠款汇总表
        
        Returns:
            List[Dict] - 客户维度的欠款信息
        """
        rows = self.dm.conn.execute("""
            SELECT 
                customer_name,
                COUNT(*) as contract_count,
                SUM(total_rent) as total_rent,
                SUM(paid_amount) as paid_amount,
                SUM(unpaid_amount) as unpaid_amount,
                SUM(CASE WHEN unpaid_amount > 0 AND 
                    datetime(contract_end_date) < datetime('now') 
                    THEN unpaid_amount ELSE 0 END) as overdue_amount,
                MAX(CASE WHEN unpaid_amount > 0 AND 
                    datetime(contract_end_date) < datetime('now')
                    THEN CAST((julianday('now') - julianday(contract_end_date)) as INTEGER)
                    ELSE 0 END) as max_overdue_days
            FROM rental_contracts
            GROUP BY customer_name
            ORDER BY unpaid_amount DESC
        """).fetchall()
        
        return [dict(r) for r in rows]

    def get_contract_arrears_detail(self, customer_name: str = None) -> List[Dict]:
        """
        获取合同欠款明细表
        
        Args:
            customer_name: 可选，筛选特定客户
            
        Returns:
            List[Dict] - 合同维度的欠款明细
        """
        query = """
            SELECT 
                contract_id,
                customer_name,
                customer_phone,
                status,
                contract_start_date,
                contract_end_date,
                total_rent,
                paid_amount,
                unpaid_amount,
                deposit,
                CASE WHEN unpaid_amount > 0 AND 
                    datetime(contract_end_date) < datetime('now')
                    THEN CAST((julianday('now') - julianday(contract_end_date)) as INTEGER)
                    ELSE 0 END as overdue_days
            FROM rental_contracts
            WHERE 1=1
        """
        params = []
        
        if customer_name:
            query += " AND customer_name LIKE ?"
            params.append(f"%{customer_name}%")
        
        query += " ORDER BY unpaid_amount DESC, contract_end_date ASC"
        
        rows = self.dm.conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def get_contract_payment_detail(self, contract_id: str) -> List[Dict]:
        """
        获取特定合同的收款明细
        
        Args:
            contract_id: 合同编号
            
        Returns:
            List[Dict] - 收款记录列表
        """
        rows = self.dm.conn.execute("""
            SELECT 
                payment_id,
                contract_id,
                payment_date,
                amount,
                payment_method,
                receipt_no,
                operator_name,
                created_at,
                notes
            FROM rental_payment_logs
            WHERE contract_id = ?
            ORDER BY payment_date DESC
        """, (contract_id,)).fetchall()
        
        return [dict(r) for r in rows]

    # ═══════════════════════════════════════
    # 设备更换频率统计
    # ═══════════════════════════════════════

    def get_hardware_exchange_summary(self, start_date: str = None, end_date: str = None) -> List[Dict]:
        """
        获取设备更换频率统计（客户维度）
        
        Args:
            start_date: 开始日期 (YYYY-MM-DD)，为空则不限制
            end_date: 结束日期 (YYYY-MM-DD)，为空则不限制
            
        Returns:
            List[Dict] - 客户维度的换机统计
        """
        query = """
            SELECT 
                c.customer_name,
                COUNT(h.change_id) as exchange_count,
                COUNT(DISTINCT DATE(h.change_date)) as exchange_days,
                MAX(h.change_date) as last_exchange_date,
                COUNT(CASE WHEN h.change_reason = '故障' THEN 1 END) as fault_count,
                COUNT(CASE WHEN h.change_reason = '升级' THEN 1 END) as upgrade_count,
                COUNT(CASE WHEN h.change_reason = '客户要求' THEN 1 END) as customer_request_count,
                COUNT(CASE WHEN h.change_reason = '人为损坑' THEN 1 END) as damage_count
            FROM rental_hardware_change_logs h
            LEFT JOIN rental_contracts c ON h.contract_id = c.contract_id
            WHERE 1=1
        """
        params = []
        
        if start_date:
            query += " AND DATE(h.change_date) >= ?"
            params.append(start_date)
        if end_date:
            query += " AND DATE(h.change_date) <= ?"
            params.append(end_date)
        
        query += " GROUP BY c.customer_name ORDER BY exchange_count DESC"
        
        rows = self.dm.conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def get_hardware_exchange_detail(self, customer_name: str = None, 
                                    reason: str = None,
                                    start_date: str = None,
                                    end_date: str = None) -> List[Dict]:
        """
        获取设备更换明细
        
        Args:
            customer_name: 客户名称，可选
            reason: 更换原因，可选
            start_date: 开始日期，可选
            end_date: 结束日期，可选
            
        Returns:
            List[Dict] - 换机明细列表
        """
        query = """
            SELECT 
                h.change_id,
                h.contract_id,
                c.customer_name,
                h.change_date,
                h.change_reason,
                h.change_type,
                h.operator_name
            FROM rental_hardware_change_logs h
            LEFT JOIN rental_contracts c ON h.contract_id = c.contract_id
            WHERE 1=1
        """
        params = []
        
        if customer_name:
            query += " AND c.customer_name LIKE ?"
            params.append(f"%{customer_name}%")
        if reason:
            query += " AND h.change_reason = ?"
            params.append(reason)
        if start_date:
            query += " AND DATE(h.change_date) >= ?"
            params.append(start_date)
        if end_date:
            query += " AND DATE(h.change_date) <= ?"
            params.append(end_date)
        
        query += " ORDER BY h.change_date DESC"
        
        rows = self.dm.conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    # ═══════════════════════════════════════
    # 管理看板 KPI
    # ═══════════════════════════════════════

    def get_dashboard_metrics(self) -> Dict:
        """
        获取管理看板关键指标
        
        Returns:
            Dict - 包含所有 KPI 的字典
        """
        today = datetime.now().strftime("%Y-%m-%d")
        month_start = datetime.now().replace(day=1).strftime("%Y-%m-%d")
        year_start = datetime.now().replace(month=1, day=1).strftime("%Y-%m-%d")
        
        # 本月收入
        month_payment = self.dm.conn.execute("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM rental_payment_logs
            WHERE DATE(payment_date) >= ? AND DATE(payment_date) <= ?
        """, (month_start, today)).fetchone()
        
        # 年度收入
        year_payment = self.dm.conn.execute("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM rental_payment_logs
            WHERE DATE(payment_date) >= ? AND DATE(payment_date) <= ?
        """, (year_start, today)).fetchone()
        
        # 活跃合同数（在租状态）
        active_contracts = self.dm.conn.execute("""
            SELECT COUNT(*) as count
            FROM rental_contracts
            WHERE status = '在租' OR (status = '进行中')
        """).fetchone()
        
        # 未收总额
        total_unpaid = self.dm.conn.execute("""
            SELECT COALESCE(SUM(unpaid_amount), 0) as total
            FROM rental_contracts
        """).fetchone()
        
        # 逾期合同数和逾期金额
        overdue_contracts = self.dm.conn.execute("""
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(unpaid_amount), 0) as total_amount
            FROM rental_contracts
            WHERE unpaid_amount > 0 AND 
                  datetime(contract_end_date) < datetime('now')
        """).fetchone()
        
        # 本月换机次数
        month_exchanges = self.dm.conn.execute("""
            SELECT COUNT(*) as count
            FROM rental_hardware_change_logs
            WHERE DATE(change_date) >= ? AND DATE(change_date) <= ?
        """, (month_start, today)).fetchone()
        
        # 高风险客户数（逾期 > 30 天）
        high_risk_customers = self.dm.conn.execute("""
            SELECT COUNT(DISTINCT customer_name) as count
            FROM rental_contracts
            WHERE unpaid_amount > 0 AND 
                  datetime(contract_end_date) < datetime('now', '-30 days')
        """).fetchone()
        
        # 收款率（本月）
        month_contracts_with_payment = self.dm.conn.execute("""
            SELECT 
                COUNT(*) as count,
                SUM(CASE WHEN paid_amount > 0 THEN 1 ELSE 0 END) as paid_count
            FROM rental_contracts
            WHERE DATE(created_at) >= ?
        """, (month_start,)).fetchone()
        
        return {
            "month_revenue": float(month_payment["total"]),
            "year_revenue": float(year_payment["total"]),
            "active_contracts": active_contracts["count"],
            "total_unpaid": float(total_unpaid["total"]),
            "overdue_contracts": overdue_contracts["count"],
            "overdue_amount": float(overdue_contracts["total_amount"]),
            "month_exchanges": month_exchanges["count"],
            "high_risk_customers": high_risk_customers["count"],
            "payment_rate": self._calculate_payment_rate(month_contracts_with_payment),
            "generated_at": datetime.now().isoformat(),
        }

    def _calculate_payment_rate(self, row: Dict) -> float:
        """计算收款率"""
        if row["count"] == 0:
            return 0.0
        return round((row["paid_count"] / row["count"]) * 100, 2)

    # ═══════════════════════════════════════
    # 导出功能
    # ═══════════════════════════════════════

    def export_arrears_to_csv(self, customer_name: str = None) -> str:
        """
        导出欠款明细为 CSV
        
        Args:
            customer_name: 可选，筛选特定客户
            
        Returns:
            str - CSV 内容
        """
        rows = self.get_contract_arrears_detail(customer_name)
        
        if not rows:
            return ""
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        
        return output.getvalue()

    def export_exchange_to_csv(self, customer_name: str = None,
                              reason: str = None,
                              start_date: str = None,
                              end_date: str = None) -> str:
        """
        导出换机明细为 CSV
        
        Args:
            customer_name: 客户名称，可选
            reason: 更换原因，可选
            start_date: 开始日期，可选
            end_date: 结束日期，可选
            
        Returns:
            str - CSV 内容
        """
        rows = self.get_hardware_exchange_detail(customer_name, reason, start_date, end_date)
        
        if not rows:
            return ""
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        
        return output.getvalue()

    # ═══════════════════════════════════════
    # 数据验证和清洗
    # ═══════════════════════════════════════

    def validate_report_data(self) -> Dict[str, str]:
        """
        验证报表数据完整性
        
        Returns:
            Dict - 验证结果和警告信息
        """
        issues = {}
        
        # 检查是否有孤立的payment_logs（无对应合同）
        orphan_payments = self.dm.conn.execute("""
            SELECT COUNT(*) as count
            FROM rental_payment_logs
            WHERE contract_id NOT IN (SELECT contract_id FROM rental_contracts)
        """).fetchone()
        
        if orphan_payments["count"] > 0:
            issues["orphan_payments"] = f"发现 {orphan_payments['count']} 条孤立的收款记录"
        
        # 检查是否有孤立的hardware_change_logs
        orphan_exchanges = self.dm.conn.execute("""
            SELECT COUNT(*) as count
            FROM rental_hardware_change_logs
            WHERE contract_id NOT IN (SELECT contract_id FROM rental_contracts)
        """).fetchone()
        
        if orphan_exchanges["count"] > 0:
            issues["orphan_exchanges"] = f"发现 {orphan_exchanges['count']} 条孤立的换机记录"
        
        # 检查是否有应收金额为负的合同（不应该发生）
        negative_unpaid = self.dm.conn.execute("""
            SELECT COUNT(*) as count
            FROM rental_contracts
            WHERE unpaid_amount < 0
        """).fetchone()
        
        if negative_unpaid["count"] > 0:
            issues["negative_unpaid"] = f"发现 {negative_unpaid['count']} 份合同应收金额为负"
        
        return issues

    def get_data_statistics(self) -> Dict:
        """
        获取数据统计信息
        
        Returns:
            Dict - 数据量统计
        """
        return {
            "total_contracts": self.dm.conn.execute(
                "SELECT COUNT(*) as count FROM rental_contracts"
            ).fetchone()["count"],
            "total_payments": self.dm.conn.execute(
                "SELECT COUNT(*) as count FROM rental_payment_logs"
            ).fetchone()["count"],
            "total_exchanges": self.dm.conn.execute(
                "SELECT COUNT(*) as count FROM rental_hardware_change_logs"
            ).fetchone()["count"],
            "total_audit_logs": self.dm.conn.execute(
                "SELECT COUNT(*) as count FROM rental_audit_logs"
            ).fetchone()["count"],
        }
