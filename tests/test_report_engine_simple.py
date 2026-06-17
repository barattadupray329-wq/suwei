#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
报表引擎简化测试
关注核心功能：查询、聚合、导出、验证
"""

import unittest
import tempfile
import shutil
from core.data_manager import DataManager
from core.report_engine import ReportEngine


class TestReportEngineBasic(unittest.TestCase):
    """报表引擎基础功能测试"""

    def setUp(self):
        """创建临时测试数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.dm = DataManager(self.temp_dir)
        self.engine = ReportEngine(self.dm)

    def tearDown(self):
        """清理临时文件"""
        self.dm.conn.close()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    # ═══════════════════════════════════════
    # 欠款报表基础测试
    # ═══════════════════════════════════════

    def test_arrears_summary_empty_data(self):
        """测试：空数据时欠款汇总返回空列表"""
        result = self.engine.get_customer_arrears_summary()
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 0)

    def test_arrears_summary_has_required_columns(self):
        """测试：欠款汇总包含必需列"""
        # 创建合同
        c_id = self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        # 添加项目以产生租金
        self.dm.add_line_item(
            contract_id=c_id,
            item_name='笔记本电脑',
            item_type='电脑',
            quantity=2,
            unit_monthly_rent=500.0,
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        result = self.engine.get_customer_arrears_summary()
        self.assertGreater(len(result), 0)
        
        required_cols = ['customer_name', 'contract_count', 'total_rent', 'unpaid_amount']
        row = result[0]
        for col in required_cols:
            self.assertIn(col, row)

    def test_contract_arrears_detail_filtering(self):
        """测试：合同明细按客户名称过滤"""
        # 创建多个合同
        for i in range(3):
            self.dm.create_contract(
                customer_name=f'客户{i}',
                customer_phone='138001380',
                start_date='2025-06-01',
                end_date='2025-12-31',
            )
        
        # 筛选特定客户
        result = self.engine.get_contract_arrears_detail(customer_name='客户1')
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['customer_name'], '客户1')

    def test_contract_payment_detail_empty(self):
        """测试：不存在的合同返回空列表"""
        result = self.engine.get_contract_payment_detail('NONEXISTENT')
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 0)

    def test_contract_payment_detail_with_payment(self):
        """测试：获取合同收款明细"""
        # 创建合同并添加收款
        c_id = self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        self.dm.add_payment(
            contract_id=c_id,
            amount=5000.0,
            payment_date='2025-07-01',
            payment_method='转账',
            receipt_no='RCP001',
        )
        
        result = self.engine.get_contract_payment_detail(c_id)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['amount'], 5000.0)
        self.assertEqual(result[0]['contract_id'], c_id)

    # ═══════════════════════════════════════
    # 硬件更换统计基础测试
    # ═══════════════════════════════════════

    def test_exchange_summary_empty_data(self):
        """测试：空数据时换机统计返回空列表"""
        result = self.engine.get_hardware_exchange_summary()
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 0)

    def test_exchange_summary_with_data(self):
        """测试：有换机数据时的统计"""
        # 创建合同
        c_id = self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        # 添加换机记录（直接操作数据库）
        self.dm.conn.execute("""
            INSERT INTO rental_hardware_change_logs 
            (change_id, contract_id, item_id, change_date, change_type, 
             change_reason, operator_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ('CH001', c_id, 'ITEM001', '2025-07-15', '更换', '故障', 
              '张三', '2025-07-15 10:00:00'))
        self.dm.conn.commit()
        
        result = self.engine.get_hardware_exchange_summary()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['customer_name'], '测试客户')
        self.assertGreater(result[0]['exchange_count'], 0)

    def test_exchange_detail_filtering(self):
        """测试：换机明细按原因过滤"""
        # 创建合同
        c_id = self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        # 添加不同原因的换机记录
        for i, reason in enumerate(['故障', '升级', '故障']):
            self.dm.conn.execute("""
                INSERT INTO rental_hardware_change_logs 
                (change_id, contract_id, item_id, change_date, change_type, 
                 change_reason, operator_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (f'CH{i:03d}', c_id, f'ITEM{i:03d}', '2025-07-15', '更换', 
                  reason, '张三', '2025-07-15 10:00:00'))
        self.dm.conn.commit()
        
        # 只查询故障相关的
        result = self.engine.get_hardware_exchange_detail(reason='故障')
        self.assertEqual(len(result), 2)

    # ═══════════════════════════════════════
    # KPI 看板测试
    # ═══════════════════════════════════════

    def test_dashboard_metrics_returns_dict(self):
        """测试：仪表板指标返回字典"""
        result = self.engine.get_dashboard_metrics()
        self.assertIsInstance(result, dict)
        self.assertIn('month_revenue', result)
        self.assertIn('year_revenue', result)
        self.assertIn('active_contracts', result)
        self.assertIn('generated_at', result)

    def test_dashboard_metrics_empty_data(self):
        """测试：空数据时仪表板返回零值"""
        result = self.engine.get_dashboard_metrics()
        self.assertEqual(result['month_revenue'], 0.0)
        self.assertEqual(result['year_revenue'], 0.0)
        self.assertEqual(result['active_contracts'], 0)
        self.assertEqual(result['total_unpaid'], 0.0)

    def test_dashboard_metrics_calculation(self):
        """测试：仪表板计算"""
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
        
        # 创建合同
        c_id = self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        # 添加收款（使用当前日期）
        self.dm.add_payment(
            contract_id=c_id,
            amount=1000.0,
            payment_date=today,
            payment_method='转账',
        )
        
        result = self.engine.get_dashboard_metrics()
        self.assertEqual(result['month_revenue'], 1000.0)
        self.assertEqual(result['active_contracts'], 1)

    # ═══════════════════════════════════════
    # 导出功能测试
    # ═══════════════════════════════════════

    def test_export_arrears_csv_empty(self):
        """测试：空数据导出为空字符串"""
        result = self.engine.export_arrears_to_csv()
        self.assertEqual(result, "")

    def test_export_arrears_csv_format(self):
        """测试：CSV 导出格式"""
        # 创建合同
        self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        result = self.engine.export_arrears_to_csv()
        self.assertIsInstance(result, str)
        self.assertGreater(len(result), 0)
        self.assertIn('contract_id', result)
        self.assertIn('customer_name', result)

    def test_export_exchange_csv_format(self):
        """测试：换机明细 CSV 导出"""
        # 创建合同和换机记录
        c_id = self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        self.dm.conn.execute("""
            INSERT INTO rental_hardware_change_logs 
            (change_id, contract_id, item_id, change_date, change_type, 
             change_reason, operator_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ('CH001', c_id, 'ITEM001', '2025-07-15', '更换', '故障', 
              '张三', '2025-07-15 10:00:00'))
        self.dm.conn.commit()
        
        result = self.engine.export_exchange_to_csv()
        self.assertGreater(len(result), 0)
        self.assertIn('change_id', result)

    # ═══════════════════════════════════════
    # 数据验证测试
    # ═══════════════════════════════════════

    def test_validate_clean_data(self):
        """测试：干净数据验证无问题"""
        issues = self.engine.validate_report_data()
        self.assertEqual(len(issues), 0)

    def test_validate_orphan_payment(self):
        """测试：检测孤立的收款记录"""
        # 直接插入孤立收款
        from datetime import datetime
        self.dm.conn.execute("""
            INSERT INTO rental_payment_logs 
            (payment_id, contract_id, payment_date, amount, operator_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ('PAY001', 'NONEXISTENT', '2025-07-01', 1000.0, '张三', 
              datetime.now().isoformat()))
        self.dm.conn.commit()
        
        issues = self.engine.validate_report_data()
        self.assertIn('orphan_payments', issues)

    def test_data_statistics(self):
        """测试：数据统计"""
        # 创建一些数据
        c_id = self.dm.create_contract(
            customer_name='测试客户',
            customer_phone='13800138000',
            start_date='2025-06-01',
            end_date='2025-12-31',
        )
        
        self.dm.add_payment(
            contract_id=c_id,
            amount=1000.0,
            payment_date='2025-06-17',
        )
        
        stats = self.engine.get_data_statistics()
        self.assertIsInstance(stats, dict)
        self.assertIn('total_contracts', stats)
        self.assertIn('total_payments', stats)
        self.assertEqual(stats['total_contracts'], 1)
        self.assertEqual(stats['total_payments'], 1)


if __name__ == '__main__':
    unittest.main()
