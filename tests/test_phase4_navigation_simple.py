#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 4 Week 8: Simplified Navigation Tests
Tests for app module imports and basic initialization
"""

import unittest
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class TestModuleImports(unittest.TestCase):
    """Test that all required modules can be imported"""

    def test_import_app(self):
        """Test MainWindow can be imported"""
        try:
            from core.app import MainWindow
            self.assertIsNotNone(MainWindow)
        except Exception as e:
            self.fail(f"Failed to import MainWindow: {e}")

    def test_import_dashboard_v2(self):
        """Test DashboardV2Frame can be imported"""
        try:
            from modules.dashboard_v2 import DashboardV2Frame
            self.assertIsNotNone(DashboardV2Frame)
        except Exception as e:
            self.fail(f"Failed to import DashboardV2Frame: {e}")

    def test_import_reports_v2(self):
        """Test ReportsV2Frame can be imported"""
        try:
            from modules.reports_v2 import ReportsV2Frame
            self.assertIsNotNone(ReportsV2Frame)
        except Exception as e:
            self.fail(f"Failed to import ReportsV2Frame: {e}")

    def test_import_report_engine(self):
        """Test ReportEngine can be imported"""
        try:
            from core.report_engine import ReportEngine
            self.assertIsNotNone(ReportEngine)
        except Exception as e:
            self.fail(f"Failed to import ReportEngine: {e}")


class TestAppStructure(unittest.TestCase):
    """Test app structure and methods exist"""

    def test_app_has_navigation_methods(self):
        """Test MainWindow has required navigation methods"""
        from core.app import MainWindow
        
        required_methods = [
            "_switch_module",
            "_on_kpi_drill_down",
            "_apply_report_drill_down",
            "_get_current_module_key",
            "_get_user_role",
        ]
        
        for method_name in required_methods:
            self.assertTrue(
                hasattr(MainWindow, method_name),
                f"MainWindow missing method: {method_name}"
            )

    def test_dashboard_v2_has_callback_method(self):
        """Test DashboardV2Frame has set_drill_down_callback method"""
        from modules.dashboard_v2 import DashboardV2Frame
        
        self.assertTrue(
            hasattr(DashboardV2Frame, "set_drill_down_callback"),
            "DashboardV2Frame missing set_drill_down_callback method"
        )

    def test_dashboard_v2_has_kpi_click_handler(self):
        """Test DashboardV2Frame has _on_kpi_click method"""
        from modules.dashboard_v2 import DashboardV2Frame
        
        self.assertTrue(
            hasattr(DashboardV2Frame, "_on_kpi_click"),
            "DashboardV2Frame missing _on_kpi_click method"
        )

    def test_reports_v2_has_load_data_method(self):
        """Test ReportsV2Frame has load_data method"""
        from modules.reports_v2 import ReportsV2Frame
        
        self.assertTrue(
            hasattr(ReportsV2Frame, "load_data"),
            "ReportsV2Frame missing load_data method"
        )


class TestReportEngineStructure(unittest.TestCase):
    """Test ReportEngine structure and methods"""

    def test_report_engine_has_required_methods(self):
        """Test ReportEngine has required query methods"""
        from core.report_engine import ReportEngine
        
        required_methods = [
            "get_customer_arrears_summary",
            "get_contract_arrears_detail",
            "get_hardware_exchange_summary",
            "get_hardware_exchange_detail",
        ]
        
        for method_name in required_methods:
            self.assertTrue(
                hasattr(ReportEngine, method_name),
                f"ReportEngine missing method: {method_name}"
            )


class TestSyntaxAndImports(unittest.TestCase):
    """Test files compile correctly"""

    def test_app_file_syntax(self):
        """Test core/app.py has valid syntax"""
        import py_compile
        try:
            py_compile.compile("core/app.py", doraise=True)
        except py_compile.PyCompileError as e:
            self.fail(f"app.py has syntax errors: {e}")

    def test_dashboard_v2_file_syntax(self):
        """Test modules/dashboard_v2.py has valid syntax"""
        import py_compile
        try:
            py_compile.compile("modules/dashboard_v2.py", doraise=True)
        except py_compile.PyCompileError as e:
            self.fail(f"dashboard_v2.py has syntax errors: {e}")

    def test_reports_v2_file_syntax(self):
        """Test modules/reports_v2.py has valid syntax"""
        import py_compile
        try:
            py_compile.compile("modules/reports_v2.py", doraise=True)
        except py_compile.PyCompileError as e:
            self.fail(f"reports_v2.py has syntax errors: {e}")


class TestReportEngineInstantiation(unittest.TestCase):
    """Test ReportEngine can be instantiated"""

    def test_report_engine_init(self):
        """Test ReportEngine instantiation"""
        from core.report_engine import ReportEngine
        try:
            # Create a mock data_manager object
            class MockDataManager:
                def __init__(self):
                    self.conn = None
            
            dm = MockDataManager()
            engine = ReportEngine(dm)
            self.assertIsNotNone(engine)
            self.assertIsNotNone(engine.dm)
        except Exception as e:
            self.fail(f"ReportEngine instantiation failed: {e}")


if __name__ == "__main__":
    # Run tests with verbose output
    unittest.main(verbosity=2)
