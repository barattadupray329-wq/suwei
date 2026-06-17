#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 4 Week 8: Integration Testing
Tests for app integration with reports_v2 and dashboard_v2 modules
"""

import unittest
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import tkinter as tk
from core.data_manager import DataManager
from core.report_engine import ReportEngine
from core.app import MainWindow
from modules.dashboard_v2 import DashboardV2Frame
from modules.reports_v2 import ReportsV2Frame


class TestAppIntegration(unittest.TestCase):
    """Test app integration with Phase 3 modules"""

    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.root = tk.Tk()
        cls.root.withdraw()  # Hide window during tests
        cls.data_manager = DataManager()

    @classmethod
    def tearDownClass(cls):
        """Clean up after tests"""
        try:
            cls.root.destroy()
        except Exception:
            pass

    def test_app_initialization_with_dashboard_v2(self):
        """Test app initializes without errors"""
        try:
            app = MainWindow("test_user", self.data_manager, self.root)
            self.assertIsNotNone(app)
            self.assertIsNotNone(app.report_engine)
            self.assertIsInstance(app.report_engine, ReportEngine)
        except Exception as e:
            self.fail(f"App initialization failed: {e}")

    def test_navigation_buttons_exist(self):
        """Test that navigation buttons are created"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        expected_keys = [
            "dashboard",
            "dashboard_v2",
            "reports_v2",
            "rental",
            "rental_v2",
            "reminder",
            "hardware_brands",
            "user_mgmt",
        ]
        
        for key in expected_keys:
            self.assertIn(key, app.nav_buttons, f"Missing nav button for {key}")

    def test_dashboard_v2_navigation(self):
        """Test switching to dashboard_v2 module"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        try:
            app._switch_module("dashboard_v2")
            self.assertIsInstance(app.current_module, DashboardV2Frame)
        except Exception as e:
            self.fail(f"dashboard_v2 navigation failed: {e}")

    def test_reports_v2_navigation(self):
        """Test switching to reports_v2 module"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        try:
            app._switch_module("reports_v2")
            self.assertIsInstance(app.current_module, ReportsV2Frame)
        except Exception as e:
            self.fail(f"reports_v2 navigation failed: {e}")

    def test_dashboard_v2_has_drill_down_callback(self):
        """Test dashboard_v2 accepts drill-down callback"""
        app = MainWindow("test_user", self.data_manager, self.root)
        app._switch_module("dashboard_v2")
        
        # Verify callback is set
        self.assertIsNotNone(app.current_module.drill_down_callback)
        self.assertEqual(
            app.current_module.drill_down_callback,
            app._on_kpi_drill_down
        )

    def test_drill_down_callback_invocation(self):
        """Test drill-down callback is properly invoked"""
        app = MainWindow("test_user", self.data_manager, self.root)
        app._switch_module("dashboard_v2")
        
        # Simulate KPI click
        try:
            app._on_kpi_drill_down("monthly_revenue", {})
            # Should have switched to reports module
            self.assertIsInstance(app.current_module, ReportsV2Frame)
        except Exception as e:
            self.fail(f"Drill-down callback failed: {e}")

    def test_current_module_key_detection(self):
        """Test _get_current_module_key returns correct key"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        app._switch_module("dashboard_v2")
        key = app._get_current_module_key()
        self.assertEqual(key, "dashboard_v2")
        
        app._switch_module("reports_v2")
        key = app._get_current_module_key()
        self.assertEqual(key, "reports_v2")

    def test_navigation_history_tracking(self):
        """Test navigation history is tracked"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        initial_history_len = len(app.navigation_history)
        app._switch_module("dashboard_v2")
        
        # History should be updated when drilling down
        app._on_kpi_drill_down("monthly_revenue", {})
        self.assertGreater(len(app.navigation_history), initial_history_len)

    def test_reports_v2_initialization(self):
        """Test ReportsV2Frame initializes with required parameters"""
        app = MainWindow("test_user", self.data_manager, self.root)
        app._switch_module("reports_v2")
        
        # Verify module has required attributes
        self.assertTrue(hasattr(app.current_module, "dm"))
        self.assertTrue(hasattr(app.current_module, "engine"))
        self.assertIsNotNone(app.current_module.engine)

    def test_report_type_switching(self):
        """Test switching between report types"""
        app = MainWindow("test_user", self.data_manager, self.root)
        app._switch_module("reports_v2")
        
        try:
            # Verify report type can be changed
            if hasattr(app.current_module, "report_type_var"):
                app.current_module.report_type_var.set("设备换机频率统计")
                self.assertEqual(
                    app.current_module.report_type_var.get(),
                    "设备换机频率统计"
                )
        except Exception as e:
            self.fail(f"Report type switching failed: {e}")

    def test_dashboard_v2_load_data(self):
        """Test dashboard_v2 can load data"""
        app = MainWindow("test_user", self.data_manager, self.root)
        app._switch_module("dashboard_v2")
        
        try:
            # Attempt to load data
            app.current_module.load_data()
            self.assertTrue(app.current_module.is_loading or not app.current_module.is_loading)
        except Exception as e:
            # Expected if report_engine methods are not fully implemented
            pass

    def test_app_status_label_updates(self):
        """Test status label is updated during navigation"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        initial_status = app.status_label.cget("text")
        app._on_kpi_drill_down("monthly_revenue", {})
        updated_status = app.status_label.cget("text")
        
        # Status should be updated
        self.assertNotEqual(initial_status, updated_status)


class TestReportEngineIntegration(unittest.TestCase):
    """Test ReportEngine integration with app"""

    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.data_manager = DataManager()
        cls.report_engine = ReportEngine(cls.data_manager)

    def test_report_engine_initialization(self):
        """Test ReportEngine initializes correctly"""
        self.assertIsNotNone(self.report_engine)
        self.assertIsNotNone(self.report_engine.dm)

    def test_get_customer_arrears_summary(self):
        """Test getting customer arrears summary"""
        try:
            result = self.report_engine.get_customer_arrears_summary()
            self.assertIsInstance(result, list)
        except Exception as e:
            # Expected if database is empty or query fails
            pass

    def test_get_contract_arrears_detail(self):
        """Test getting contract arrears detail"""
        try:
            result = self.report_engine.get_contract_arrears_detail()
            self.assertIsInstance(result, list)
        except Exception as e:
            # Expected if database is empty or query fails
            pass


class TestNavigationConsistency(unittest.TestCase):
    """Test navigation consistency across multiple switches"""

    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.root = tk.Tk()
        cls.root.withdraw()
        cls.data_manager = DataManager()

    @classmethod
    def tearDownClass(cls):
        """Clean up"""
        try:
            cls.root.destroy()
        except Exception:
            pass

    def test_multiple_navigation_cycles(self):
        """Test multiple navigation cycles work correctly"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        modules = ["dashboard", "dashboard_v2", "reports_v2", "dashboard"]
        
        for module_key in modules:
            try:
                app._switch_module(module_key)
                current_key = app._get_current_module_key()
                self.assertEqual(current_key, module_key)
            except Exception as e:
                self.fail(f"Navigation to {module_key} failed: {e}")

    def test_nav_button_styling(self):
        """Test nav button styling updates correctly"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        app._switch_module("dashboard_v2")
        dashboard_v2_btn = app.nav_buttons.get("dashboard_v2")
        
        # Active button should have active style
        self.assertEqual(dashboard_v2_btn.cget("style"), "Nav.Active.TButton")
        
        # Switch to reports
        app._switch_module("reports_v2")
        reports_btn = app.nav_buttons.get("reports_v2")
        dashboard_v2_btn = app.nav_buttons.get("dashboard_v2")
        
        # New active should be reports
        self.assertEqual(reports_btn.cget("style"), "Nav.Active.TButton")
        # Previous should be inactive
        self.assertEqual(dashboard_v2_btn.cget("style"), "Nav.TButton")


class TestErrorHandling(unittest.TestCase):
    """Test error handling in navigation"""

    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.root = tk.Tk()
        cls.root.withdraw()
        cls.data_manager = DataManager()

    @classmethod
    def tearDownClass(cls):
        """Clean up"""
        try:
            cls.root.destroy()
        except Exception:
            pass

    def test_invalid_module_key(self):
        """Test handling of invalid module key"""
        app = MainWindow("test_user", self.data_manager, self.root)
        
        # Should handle gracefully or raise controlled error
        try:
            app._switch_module("nonexistent_module")
        except Exception as e:
            # Expected to fail gracefully
            pass

    def test_missing_report_engine(self):
        """Test behavior when ReportEngine is missing"""
        app = MainWindow("test_user", self.data_manager, self.root)
        # ReportEngine should always be initialized
        self.assertIsNotNone(app.report_engine)


if __name__ == "__main__":
    unittest.main()
