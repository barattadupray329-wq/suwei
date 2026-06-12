#!/usr/bin/env python3
"""Full integration test - verifies all modules import and function correctly"""
import sys

print("=" * 60)
print("FULL INTEGRATION TEST")
print("=" * 60)
tests = []

# 1. Theme
from theme.colors import DarkTheme
print("[PASS] 01. theme.colors")
tests.append(True)

# 2. Logger
from modules.logger import get_logger
log = get_logger()
log.info("Integration test started")
print("[PASS] 02. modules.logger")
tests.append(True)

# 3. Hardware brands
from modules.hardware_brands import CPU_BRANDS, GPU_BRANDS, BRAND_MAP, REFERENCE_PRICES
print(f"[PASS] 03. modules.hardware_brands ({len(CPU_BRANDS)} CPUs, {len(GPU_BRANDS)} GPUs, {len(REFERENCE_PRICES)} prices)")
tests.append(True)

# 4. Token manager
from core.token_manager import TokenManager
tm = TokenManager("data/test_tokens.json")
token = tm.generate("test_user")
user = tm.validate(token)
assert user == "test_user", "Token validation failed"
tm.revoke_user("test_user")
print("[PASS] 04. core.token_manager")
tests.append(True)

# 5. Data manager
from core.data_manager import DataManager
dm = DataManager()
stats = dm.get_stats()
print(f"[PASS] 05. core.data_manager (records: {stats['total']})")
tests.append(True)

# 6. Auth
from core.auth import AuthManager
auth = AuthManager(dm)
print("[PASS] 06. core.auth")
tests.append(True)

# 7. Due reminder
from modules.due_reminder import DueReminderFrame
print("[PASS] 07. modules.due_reminder")
tests.append(True)

# 8. AI assistant - extraction test
from modules.ai_assistant import AIAssistantDialog
data = AIAssistantDialog._extract_rental_info(
    AIAssistantDialog,
    "租赁人张三，电话13800000000，CPU:i5-13400F 显卡:RTX4060"
)
assert "租赁人" in data, "Name not extracted"
assert "联系电话" in data, "Phone not extracted"
assert "硬件信息" in data, "Hardware not extracted"
print(f"[PASS] 08. modules.ai_assistant (extracted: {list(data.keys())})")
tests.append(True)

# 9. Hardware mgmt
from modules.hardware_mgmt import HardwareDialog
print("[PASS] 09. modules.hardware_mgmt")
tests.append(True)

# 10. Reports
from modules.reports import RenewHistoryDialog, AdvancedFilterDialog, ReportDialog
print("[PASS] 10. modules.reports")
tests.append(True)

# 11. Dashboard
from modules.dashboard import DashboardFrame
print("[PASS] 11. modules.dashboard")
tests.append(True)

# 12. Rental mgmt
from modules.rental_mgmt import RentalManagementFrame
print("[PASS] 12. modules.rental_mgmt")
tests.append(True)

# 13. Cost extraction
from modules.ai_assistant import AIAssistantDialog as AID
components = AID._extract_components(AID,
    "CPU:i5 13400F  895\n主板:技嘉H610m  285\n内存:ddr4 8Gx2  560\n硬盘:1000G固态  650\n显卡:4060 12G  1850\n机箱:商途  50\n电源:航嘉600W  135\n风扇:6铜管  55"
)
total = sum(c["price"] for c in components)
assert len(components) == 8, f"Expected 8 components, got {len(components)}"
assert abs(total - 4480) < 1, f"Expected 4480, got {total}"
print(f"[PASS] 13. ai_assistant cost calc ({len(components)} items, total: {total})")
tests.append(True)

# 14. App layout
from core.app import MainWindow
print("[PASS] 14. core.app (MainWindow importable)")
tests.append(True)

# Summary
passed = all(tests)
print()
print("=" * 60)
print(f"RESULT: {sum(1 for t in tests if t)}/{len(tests)} modules OK")
print("STATUS: ALL PASS" if passed else "FAIL")
print("=" * 60)
if not passed:
    sys.exit(1)
