#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
报表引擎测试模块
验证：查询准确性、空数据处理、金额求和、逾期计算、导出格式
"""

import unittest
from datetime import datetime, timedelta
import sqlite3
import tempfile
import os
from core.data_manager import DataManager
from core.report_engine import ReportEngine


class TestReportEngine(unittest.TestCase):
    """报表引擎测试"""

    def setUp(self):
        """创建临时测试数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(self.temp_dir)
        self.engine = ReportEngine(self.dm)

    def tearDown(self):
        """清理临时文件"""
        self.dm.conn.close()
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    # ═══════════════════════════════════════
    # 欠款报表测试
    # ═══════════════════════════════════════

    def test_get_customer_arrears_summary_empty(self):
        """测试：空数据时的欠款汇总"""
        result = self.engine.get_customer_arrears_summary()
        self.assertEqual(len(result), 0)

    def test_get_customer_arrears_summary_with_data(self):
        """测试：正常的欠款汇总"""
        # 创建测试合同
        self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
            deposit=1000.0,
        )
        
        result = self.engine.get_customer_arrears_summary()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['customer_name'], '测试客户')
        self.assertEqual(result[0]['contract_count'], 1)
        self.assertEqual(result[0]['total_rent'], 10000.0)
        self.assertEqual(result[0]['unpaid_amount'], 4000.0)

    def test_get_contract_arrears_detail_empty(self):
        """测试：空数据时的合同明细"""
        result = self.engine.get_contract_arrears_detail()
        self.assertEqual(len(result), 0)

    def test_get_contract_arrears_detail_with_filter(self):
        """测试：按客户名称筛选"""
        # 创建多个合同
        for i in range(3):
            self.dm.create_contract(
                contract_id=f'C{i:03d}',
                customer_name=f'客户{i}' if i < 2 else '客户测试',
                customer_phone='1380013800',
                contact_person='张三',
                rental_mode='纯租赁',
                status='在租',
                contract_start_date='2025-06-01',
                contract_end_date='2025-12-31',
                total_rent=5000.0,
                paid_amount=3000.0,
                unpaid_amount=2000.0,
                deposit=500.0,
            )
        
        result = self.engine.get_contract_arrears_detail(customer_name='测试')
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['customer_name'], '客户测试')

    def test_get_contract_payment_detail_empty(self):
        """测试：合同无收款记录"""
        result = self.engine.get_contract_payment_detail('NONEXISTENT')
        self.assertEqual(len(result), 0)

    def test_get_contract_payment_detail_with_payments(self):
        """测试：合同收款明细"""
        # 创建合同
        self.dm.create_contract(
            contract_id='C001',
            customer_name='测试客户',
            customer_phone='13800138000',
            contact_person='张三',
            rental_mode='纯租赁',
            status='在租',
            contract_start_date='2025-06-01',
            contract_end_date='2025-12-31',
            total_rent=10000.0,
            paid_amount=0,
            unpaid_amount=10000.0,
            deposit=1000.0,
        )
        
        # 添加收款
        self.dm.add_payment(
            contract_id='C001',
            amount=5000.0,
            payment_date='2025-07-01',
            payment_method='转账',
            receipt_no='RCP001',
            operator_name='张三',
        )
        
        result = self.engine.get_contract_payment_detail('C001')
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['amount'], 5000.0)

    # ═══════════════════════════════════════
    # 设备更换统计测试
    # ═══════════════════════════════════════

    def test_get_hardware_exchange_summary_empty(self):
        """测试：空数据时的换机统计"""
        result = self.engine.get_hardware_exchange_summary()
        self.assertEqual(len(result), 0)

    def test_get_hardware_exchange_summary_with_data(self):
        """测试：正常的换机统计"""
        # 创建合同
        self.dm.create_contract(
            contract_id='C001',
            customer_name='测试客户',
            customer_phone='13800138000',
            contact_person='张三',
            rental_mode='纯租赁',
            status='在租',
            contract_start_date='2025-06-01',
            contract_end_date='2025-12-31',
            total_rent=10000.0,
            paid_amount=0,
            unpaid_amount=10000.0,
            deposit=1000.0,
        )
        
        # 添加换机记录
        self.dm.conn.execute("""
            INSERT INTO rental_hardware_change_logs 
            (exchange_id, contract_id, exchange_date, reason, 
             old_device_condition, new_device_condition, exchange_operator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ('EX001', 'C001', '2025-07-15', '故障', '正常', '正常', 'OP001'))
        self.dm.conn.commit()
        
        result = self.engine.get_hardware_exchange_summary()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['customer_name'], '测试客户')
        self.assertEqual(result[0]['exchange_count'], 1)
        self.assertEqual(result[0]['fault_count'], 1)

    def test_get_hardware_exchange_detail_with_filters(self):
        """测试：换机明细多条件筛选"""
        # 创建合同
        self.dm.create_contract(
            contract_id='C001',
            customer_name='测试客户',
            customer_phone='13800138000',
            contact_person='张三',
            rental_mode='纯租赁',
            status='在租',
            contract_start_date='2025-06-01',
            contract_end_date='2025-12-31',
            total_rent=10000.0,
            paid_amount=0,
            unpaid_amount=10000.0,
            deposit=1000.0,
        )
        
        # 添加多个换机记录
        for i in range(2):
            self.dm.conn.execute("""
                INSERT INTO rental_hardware_change_logs 
                (exchange_id, contract_id, exchange_date, reason, 
                 old_device_condition, new_device_condition, exchange_operator_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (f'EX{i:03d}', 'C001', f'2025-07-{10+i:02d}', 
                  '故障' if i == 0 else '升级', '正常', '正常', 'OP001'))
        self.dm.conn.commit()
        
        # 筛选特定原因
        result = self.engine.get_hardware_exchange_detail(reason='故障')
        self.assertEqual(len(result), 1)

    # ═══════════════════════════════════════
    # KPI 看板测试
    # ═══════════════════════════════════════

    def test_get_dashboard_metrics_empty(self):
        """测试：空数据时的 KPI"""
        metrics = self.engine.get_dashboard_metrics()
        
        self.assertEqual(metrics['month_revenue'], 0.0)
        self.assertEqual(metrics['year_revenue'], 0.0)
        self.assertEqual(metrics['active_contracts'], 0)
        self.assertEqual(metrics['total_unpaid'], 0.0)
        self.assertIn('generated_at', metrics)

    def test_get_dashboard_metrics_with_data(self):
        """测试：有数据时的 KPI"""
        # 创建合同
        self.dm.create_contract(
            contract_id='C001',
            customer_name='测试客户',
            customer_phone='13800138000',
            contact_person='张三',
            rental_mode='纯租赁',
            status='在租',
            contract_start_date='2025-06-01',
            contract_end_date='2025-12-31',
            total_rent=10000.0,
            paid_amount=0,
            unpaid_amount=10000.0,
            deposit=1000.0,
        )
        
        # 添加收款（本月）
        today = datetime.now()
        self.dm.add_payment(
            contract_id='C001',
            amount=5000.0,
            payment_date=today.strftime('%Y-%m-%d'),
            payment_method='转账',
            receipt_no='RCP001',
            operator_name='张三',
        )
        
        metrics = self.engine.get_dashboard_metrics()
        
        self.assertEqual(metrics['month_revenue'], 5000.0)
        self.assertEqual(metrics['active_contracts'], 1)
        self.assertEqual(metrics['total_unpaid'], 5000.0)  # 10000 - 5000

    # ═══════════════════════════════════════
    # 导出功能测试
    # ═══════════════════════════════════════

    def test_export_arrears_to_csv_empty(self):
        """测试：空数据导出"""
        result = self.engine.export_arrears_to_csv()
        self.assertEqual(result, "")

    def test_export_arrears_to_csv_with_data(self):
        """测试：有数据导出为 CSV"""
        # 创建合同
        self.dm.create_contract(
            contract_id='C001',
            customer_name='测试客户',
            customer_phone='13800138000',
            contact_person='张三',
            rental_mode='纯租赁',
            status='在租',
            contract_start_date='2025-06-01',
            contract_end_date='2025-12-31',
            total_rent=10000.0,
            paid_amount=3000.0,
            unpaid_amount=7000.0,
            deposit=1000.0,
        )
        
        result = self.engine.export_arrears_to_csv()
        
        self.assertIn('contract_id', result)
        self.assertIn('C001', result)
        self.assertIn('7000', result)

    def test_export_exchange_to_csv_empty(self):
        """测试：空换机数据导出"""
        result = self.engine.export_exchange_to_csv()
        self.assertEqual(result, "")

    def test_export_exchange_to_csv_with_data(self):
        """测试：有换机数据导出为 CSV"""
        # 创建合同
        self.dm.create_contract(
            contract_id='C001',
            customer_name='测试客户',
            customer_phone='13800138000',
            contact_person='张三',
            rental_mode='纯租赁',
            status='在租',
            contract_start_date='2025-06-01',
            contract_end_date='2025-12-31',
            total_rent=10000.0,
            paid_amount=0,
            unpaid_amount=10000.0,
            deposit=1000.0,
        )
        
        # 添加换机
        self.dm.conn.execute("""
            INSERT INTO rental_hardware_change_logs 
            (exchange_id, contract_id, exchange_date, reason, 
             old_device_condition, new_device_condition, exchange_operator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ('EX001', 'C001', '2025-07-15', '故障', '正常', '正常', 'OP001'))
        self.dm.conn.commit()
        
        result = self.engine.export_exchange_to_csv()
        
        self.assertIn('exchange_id', result)
        self.assertIn('EX001', result)

    # ═══════════════════════════════════════
    # 数据验证测试
    # ═══════════════════════════════════════

    def test_validate_report_data_clean(self):
        """测试：数据完整性验证 - 无问题"""
        issues = self.engine.validate_report_data()
        self.assertEqual(len(issues), 0)

    def test_validate_report_data_orphan_payments(self):
        """测试：检测孤立的收款记录"""
        # 直接插入孤立的收款记录
        self.dm.conn.execute("""
            INSERT INTO rental_payment_logs 
            (payment_id, contract_id, payment_date, amount, payment_method, 
             receipt_no, operator_name, created_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('PAY001', 'NONEXISTENT', '2025-07-01', 1000.0, '转账', 
              'RCP001', '张三', datetime.now().isoformat(), ''))
        self.dm.conn.commit()
        
        issues = self.engine.validate_report_data()
        self.assertIn('orphan_payments', issues)

    def test_get_data_statistics(self):
        """测试：数据统计"""
        # 添加测试数据
        self.dm.create_contract(
            contract_id='C001',
            customer_name='测试客户',
            customer_phone='13800138000',
            contact_person='张三',
            rental_mode='纯租赁',
            status='在租',
            contract_start_date='2025-06-01',
            contract_end_date='2025-12-31',
            total_rent=10000.0,
            paid_amount=0,
            unpaid_amount=10000.0,
            deposit=1000.0,
        )
        
        stats = self.engine.get_data_statistics()
        
        self.assertEqual(stats['total_contracts'], 1)
        self.assertIn('total_payments', stats)
        self.assertIn('total_exchanges', stats)


class TestReportEngineAccuracy(unittest.TestCase):
    """报表引擎准确性测试"""

    def setUp(self):
        """创建临时测试数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(self.temp_dir)
        self.engine = ReportEngine(self.dm)

    def tearDown(self):
        """清理临时文件"""
        self.dm.conn.close()
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_amount_summation_accuracy(self):
        """测试：金额求和准确性"""
        # 创建多个合同
        total_rent = 0
        total_paid = 0
        
        for i in range(5):
            rent = (i + 1) * 1000.0
            paid = rent * 0.6
            total_rent += rent
            total_paid += paid
            
            self.dm.create_contract(
                contract_id=f'C{i:03d}',
                customer_name=f'客户{i}',
                customer_phone='13800138000',
                contact_person='张三',
                rental_mode='纯租赁',
                status='在租',
                contract_start_date='2025-06-01',
                contract_end_date='2025-12-31',
                total_rent=rent,
                paid_amount=paid,
                unpaid_amount=rent - paid,
                deposit=100.0,
            )
        
        # 获取汇总
        summary = self.engine.get_customer_arrears_summary()
        total_rent_sum = sum(s['total_rent'] for s in summary)
        total_paid_sum = sum(s['paid_amount'] for s in summary)
        
        self.assertEqual(total_rent_sum, total_rent)
        self.assertEqual(total_paid_sum, total_paid)

    def test_overdue_calculation(self):
        """测试：逾期天数计算"""
        # 创建已逾期的合同
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        self.dm.create_contract(
            contract_id='C001',
            customer_name='逾期客户',
            customer_phone='13800138000',
            contact_person='张三',
            rental_mode='纯租赁',
            status='在租',
            contract_start_date='2025-06-01',
            contract_end_date=yesterday,  # 昨天到期
            total_rent=10000.0,
            paid_amount=0,
            unpaid_amount=10000.0,
            deposit=1000.0,
        )
        
        detail = self.engine.get_contract_arrears_detail()
        self.assertEqual(len(detail), 1)
        self.assertGreater(detail[0]['overdue_days'], 0)


if __name__ == '__main__':
    unittest.main()
