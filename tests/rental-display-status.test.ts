import { describe, expect, it } from "vitest"
import { isContractExpired, rentalDisplayStatus, rentalOverdueAmount } from "../lib/rental-display-status"

const base = {
  endDate: "2026-07-26",
  status: "在租",
  bills: [{ dueDate: "2026-07-26", amount: "640", paidAmount: "640" }],
}

describe("租赁合同展示状态", () => {
  it("到期日当天仍显示原业务状态", () => {
    expect(rentalDisplayStatus(base, "2026-07-26")).toBe("在租")
  })

  it("到期次日且结清显示已到期", () => {
    expect(isContractExpired(base, "2026-07-27")).toBe(true)
    expect(rentalDisplayStatus(base, "2026-07-27")).toBe("已到期")
  })

  it("到期次日且存在到期欠款显示逾期及金额", () => {
    const rental = { ...base, bills: [{ dueDate: "2026-07-26", amount: "640", paidAmount: "120" }] }
    expect(rentalOverdueAmount(rental, "2026-07-27")).toBe(520)
    expect(rentalDisplayStatus(rental, "2026-07-27")).toBe("逾期")
  })

  it("未到付款日的账单不计入逾期金额", () => {
    const rental = { ...base, bills: [{ dueDate: "2026-08-01", amount: "640", paidAmount: "0" }] }
    expect(rentalOverdueAmount(rental, "2026-07-27")).toBe(0)
    expect(rentalDisplayStatus(rental, "2026-07-27")).toBe("已到期")
  })

  it("还款日当天不算逾期，次日只汇总正数租金账单余额", () => {
    const rental = {
      ...base,
      bills: [
        { dueDate: "2026-08-06", amount: "640", paidAmount: "0", billType: "逾期租金" },
        { dueDate: "2026-07-21", amount: "160", paidAmount: "0", billType: "逾期租金" },
        { dueDate: "2026-07-21", amount: "500", paidAmount: "0", billType: "押金" },
        { dueDate: "2026-07-21", amount: "-50", paidAmount: "0", billType: "租金调整" },
      ],
    }
    expect(rentalOverdueAmount(rental, "2026-08-06")).toBe(160)
    expect(rentalOverdueAmount(rental, "2026-08-07")).toBe(800)
  })

  it.each(["买断", "已退租", "已结束", "已关闭", "丢失"])("终态 %s 不被覆盖", (status) => {
    const rental = { ...base, status, bills: [{ dueDate: "2026-07-20", amount: "640", paidAmount: "0" }] }
    expect(rentalDisplayStatus(rental, "2026-07-27")).toBe(status)
  })
})
