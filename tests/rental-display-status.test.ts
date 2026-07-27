import { describe, expect, it } from "vitest"
import { isContractExpired, rentalDisplayStatus, rentalOverdueAmount } from "../lib/rental-display-status"

const base = {
  endDate: "2026-07-26",
  status: "在租",
  bills: [{ dueDate: "2026-07-26", amount: "640", paidAmount: "640" }],
}

describe("租赁合同展示状态", () => {
  it("到期日当天显示到期", () => {
    expect(rentalDisplayStatus(base, "2026-07-26")).toBe("到期")
  })

  it("到期次日无论是否结清均显示逾期", () => {
    expect(isContractExpired(base, "2026-07-27")).toBe(true)
    expect(rentalDisplayStatus(base, "2026-07-27")).toBe("逾期")
  })

  it("到期次日且存在到期欠款显示逾期及金额", () => {
    const rental = { ...base, bills: [{ dueDate: "2026-07-26", amount: "640", paidAmount: "120" }] }
    expect(rentalOverdueAmount(rental, "2026-07-27")).toBe(520)
    expect(rentalDisplayStatus(rental, "2026-07-27")).toBe("逾期")
  })

  it("未到付款日的账单不计入逾期金额", () => {
    const rental = { ...base, bills: [{ dueDate: "2026-08-01", amount: "640", paidAmount: "0" }] }
    expect(rentalOverdueAmount(rental, "2026-07-27")).toBe(0)
    expect(rentalDisplayStatus(rental, "2026-07-27")).toBe("逾期")
  })

  it.each(["买断", "已买断", "已退租", "已退回", "已结束", "已完成", "已关闭", "丢失", "已丢失"])("终态 %s 不被覆盖", (status) => {
    const rental = { ...base, status, bills: [{ dueDate: "2026-07-20", amount: "640", paidAmount: "0" }] }
    expect(rentalDisplayStatus(rental, "2026-07-27")).toBe(status)
  })
})
