import { describe, expect, it } from "vitest";
import { allocatePayment, billOutstandingCents } from "../lib/payment-allocation";

const bills = [
  { id: 1, amount: "100.00", paidAmount: "20.00", dueDate: "2026-01-01" },
  { id: 2, amount: "150.00", paidAmount: "0", dueDate: "2026-02-01" },
];

describe("收款分配", () => {
  it("只把逐期收款分配到目标账单", () => {
    expect(allocatePayment(bills, 50, 2)).toEqual([{ billId: 2, amountCents: 5000, balanceAfterCents: 10000 }]);
  });

  it("按到期日分配全部待收金额", () => {
    expect(allocatePayment(bills, 230)).toEqual([
      { billId: 1, amountCents: 8000, balanceAfterCents: 0 },
      { billId: 2, amountCents: 15000, balanceAfterCents: 0 },
    ]);
  });

  it("支持跨账期部分收款", () => {
    expect(allocatePayment(bills, 100)).toEqual([
      { billId: 1, amountCents: 8000, balanceAfterCents: 0 },
      { billId: 2, amountCents: 2000, balanceAfterCents: 13000 },
    ]);
  });

  it("拒绝超出待收金额", () => {
    expect(() => allocatePayment(bills, 231)).toThrow("最多可收 230.00 元");
  });

  it("跳过已经结清的账单", () => {
    const settled = { id: 3, amount: "99.99", paidAmount: "99.99", dueDate: "2025-12-01" };
    expect(billOutstandingCents(settled)).toBe(0);
    expect(allocatePayment([settled, ...bills], 10)[0].billId).toBe(1);
  });

  it("优惠核销后按逐笔账单余额判定结清", () => {
    const discountedBills = [
      { id: 10, amount: "3300.00", paidAmount: "3300.00", dueDate: "2026-02-27" },
      { id: 11, amount: "3300.00", paidAmount: "3300.00", dueDate: "2026-05-27" },
    ];
    // 现金实收 5701 元，另有 899 元优惠；优惠已分配到账单 paidAmount，真实待收为 0。
    expect(discountedBills.reduce((sum, bill) => sum + billOutstandingCents(bill), 0)).toBe(0);
  });

  it("部分核销时只汇总各账单剩余余额", () => {
    const partiallySettled = [
      { id: 20, amount: "1000.00", paidAmount: "1000.00", dueDate: "2026-02-27" },
      { id: 21, amount: "800.00", paidAmount: "500.00", dueDate: "2026-03-27" },
      { id: 22, amount: "-100.00", paidAmount: "0", dueDate: "2026-03-27" },
    ];
    expect(partiallySettled.reduce((sum, bill) => sum + billOutstandingCents(bill), 0)).toBe(30000);
  });
});
