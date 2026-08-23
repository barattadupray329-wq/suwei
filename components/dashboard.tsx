"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BellRing,
  CheckSquare,
  ClipboardPenLine,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClockAlert,
  Copy,
  Download,
  FileText,
  LayoutDashboard,
  Monitor,
  Plus,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  buyoutRentalItem,
  changeStatus,
  collectPayment,
  confirmDraftsAsOfficial,
  correctRenewalPrice,
  createRental,
  deleteTestRental,
  getCustomerHistory,
  getCustomerOfferSuggestion,
  getNextRentalNumbers,
  getRentalFormSuggestions,
  recordDepositAction,
  buyoutRentalItems,
  renewRentalItems,
  reverseAllPayments,
  reverseAllRenewals,
  reversePayment,
  updateRentalAssignee,
  type InitialCollectionInput,
  type PaymentInput,
  type RentalAssignee,
  type RentalInput,
  type RentalItemInput,
  type RenewalInput,
  type SettlementInput,
} from "@/app/actions/rentals";
import {
  exchangeRentalItems,
  reportLostItems,
  returnRentalItems,
  type ExchangeInput,
  type LossInput,
  type ReturnInput,
} from "@/app/actions/operations";
import { sendRentalCreatedNotice, sendRentalReminders } from "@/app/actions/sms-reminders";
import {
  changeRentalContract,
  changeRentalItems,
  createRepairRecords,
  type ContractChangeInput,
  type RentalChangeInput,
  type RepairInput,
} from "@/app/actions/rental-events";
import { getDeviceConfigRows } from "@/lib/device-config";
import { RentalOperationWizard } from "@/components/rental-operation-wizard";
import type { RentalOperationType } from "@/lib/rental-operation-hub";
import { addCalendarDays, billCoverageLabel, billPeriodLabel, billPeriodRanges, billState, nextOpenBill, normalizeBillingUnit } from "@/lib/rental-calculations";
  import { rentalEndDate } from "@/lib/rental-calculations";
  import { calculateReturnRent } from "@/lib/return-settlement";
import { buildRentalNumberPreview } from "@/lib/rental-numbers";
import {
  START_DATE_REASONS,
  validateRentalItemFields,
} from "@/lib/rental-form-rules";
import { userErrorMessage } from "@/lib/errors";
  import { handleAuthExpired } from "@/lib/session-expiry";
import { isContractExpired, rentalDisplayStatus, rentalOverdueAmount } from "@/lib/rental-display-status";
import { allocatePayment, billOutstandingCents, centsToMoney } from "@/lib/payment-allocation";

type Item = {
  id: number;
  rentalId: number;
  deviceName: string;
  deviceType: string;
  deviceCode: string | null;
  deviceConfig: string | null;
  quantity: number;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: string;
  totalRent: string;
  boughtOutQuantity: number;
  returnedQuantity: number;
  lostQuantity: number;
  buyoutAmount: string;
  cpu: string | null;
  motherboard: string | null;
  memory: string | null;
  storage: string | null;
  graphicsCard: string | null;
  powerSupply: string | null;
  caseModel: string | null;
  monitorInfo: string | null;
  screenSize: string | null;
  screenResolution: string | null;
  refreshRate: string | null;
  panelType: string | null;
  ports: string | null;
  batteryInfo: string | null;
  adapterInfo: string | null;
  accessories: string | null;
  colorGamut: string | null;
};
type Buyout = {
  id: number;
  rentalItemId: number;
  quantity: number;
  unitPrice: string;
  amount: string;
  buyoutDate: string;
  notes: string | null;
};
type RenewalAdjustment = {
  id: number;
  previousUnitPrice: string;
  correctedUnitPrice: string;
  previousAmount: string;
  correctedAmount: string;
  differenceAmount: string;
  reason: string;
  operatorName: string;
  createdAt: Date | string;
};
type Renewal = {
  id: number;
  rentalId: number;
  sourceRentalItemId: number;
  renewedRentalItemId: number;
  quantity: number;
  renewalMonths: number | null;
  billingUnit: string | null;
  duration: number | null;
  unitPrice: string | null;
  oldMonthlyRent: string;
  newMonthlyRent: string;
  oldEndDate: string;
  newEndDate: string;
  renewalAmount: string;
  renewalDate: string;
  notes: string | null;
  status: string;
  reversedAt: Date | string | null;
  reversalReason: string | null;
  adjustments: RenewalAdjustment[];
};
type Payment = {
  id: number;
  rentalId: number;
  renewalRecordId: number | null;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  feeType: string;
  notes: string | null;
};
type RentalEvent = {
  id: number;
  eventType: string;
  status: string;
  eventDate: string;
  itemId: number | null;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  reason: string | null;
  feeAdjustment: string;
  repairCost: string;
  customerCharge: string;
  faultDescription: string | null;
  resolution: string | null;
  completedDate: string | null;
  operatorName: string;
  notes: string | null;
};
type BillAllocation = {
  id: number;
  amount: string;
  paymentRecordId: number;
  paymentDate: string;
  paymentMethod: string;
  operatorName: string | null;
  notes: string | null;
  receivedAt: Date | string;
};
type Bill = {
  id: number;
  billNo: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  billType: string;
  amount: string;
  paidAmount: string;
  status: string;
  notes: string | null;
  allocations: BillAllocation[];
};
type Ledger = {
  id: number;
  entryType: string;
  amount: string;
  entryDate: string;
  paymentRecordId: number | null;
  operatorName: string;
  notes: string | null;
};
type Rental = {
  id: number;
  orderType: string;
  lifecycleStatus: string;
  sourceUserId: string | null;
  sourceName: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  contractNo: string;
  customerCompany: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  deviceName: string;
  deviceType: string;
  quantity: number;
  billingType: string;
  duration: number;
  startDate: string;
  startDateReason: string | null;
  endDate: string;
  monthlyRent: string;
  totalRent: string;
  deposit: string;
  paidAmount: string;
  paymentStatus: string;
  status: string;
  notes: string | null;
  items: Item[];
  buyoutRecords: Buyout[];
  renewalRecords: Renewal[];
  paymentRecords: Payment[];
  events: RentalEvent[];
  bills: Bill[];
  ledger: Ledger[];
};
type Summary = {
  total: number;
  active: number;
  draft: number;
  overdue: number;
  dueSoon: number;
  repairPending: number;
  revenue: string;
  receivable: string;
  overdueReceivable: string;
  upcomingReceivable: string;
  receivableContracts: number;
  boughtOut: number;
  returned: number;
  deviceCounts: Record<string, number>;
  };
const money = (n: string | number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(Number(n));
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function validateBusinessBatch<T extends { rentalId: number }>(values: T[], itemId: (value: T) => number) {
  if (!values.length) throw new Error("请至少选择一项设备");
  if (values.length > 100) throw new Error("单次最多办理 100 项设备");
  const rentalId = values[0].rentalId;
  if (values.some((value) => value.rentalId !== rentalId)) throw new Error("批量业务必须属于同一合同");
  if (new Set(values.map(itemId)).size !== values.length) throw new Error("同一设备不能重复提交");
  return values;
}
function calculateEndDate(
  startDate: string,
  billingType: "monthly" | "daily",
  duration: number,
) {
  if (!startDate || !Number.isInteger(duration) || duration < 1) return "";
  return rentalEndDate(startDate, duration, billingType);
}
const emptyItem = (): RentalItemInput => ({
  deviceName: "",
  deviceType: "台式机",
  deviceCode: "",
  deviceConfig: "",
  quantity: 1,
  monthlyRent: 0,
  totalRent: 0,
  cpu: "",
  motherboard: "",
  memory: "",
  storage: "",
  graphicsCard: "",
  powerSupply: "",
  caseModel: "",
  monitorInfo: "",
  screenSize: "",
  screenResolution: "",
  refreshRate: "",
  panelType: "",
  ports: "",
  batteryInfo: "",
  adapterInfo: "",
  accessories: "",
  colorGamut: "",
});
const emptyRental = (): RentalInput => {
  const startDate = today();
  return {
    contractNo: "",
    customerCompany: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    billingType: "monthly",
    duration: 1,
    startDate,
    startDateReason: undefined,
    endDate: calculateEndDate(startDate, "monthly", 1),
    deposit: 0,
    notes: "",
    items: [emptyItem()],
  };
};

export function BusinessOverview({ summary, canViewFinance }: { summary: Summary; canViewFinance: boolean }) {
  const deviceTypes = ["台式机", "笔记本", "一体机", "显示器"];
  const statusCards = [
    { label: "在租", value: summary.active, href: "/rentals?status=在租", tone: "border-primary/30 bg-primary/10 text-primary" },
    { label: "逾期", value: summary.overdue, href: "/rentals?status=逾期", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
    { label: "买断", value: summary.boughtOut, href: "/rentals?status=已买断", tone: "border-accent bg-accent text-accent-foreground" },
    { label: "已退租", value: summary.returned, href: "/rentals?status=已退租", tone: "border-border bg-muted text-foreground" },
  ];
  return <main className="bg-background p-4 md:p-6"><div className="mx-auto flex max-w-7xl flex-col gap-6">
    <header><p className="text-sm font-medium text-primary">经营分析中心</p><h1 className="mt-1 text-2xl font-bold text-balance">经营总览</h1><p className="mt-1 text-sm text-muted-foreground">查看财务、在租设备、合同状态和经营提醒；点击卡片可进入对应明细。</p></header>
    <section aria-label="经营指标" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Link href="/rentals" className="rounded-xl border bg-card p-4 transition-colors hover:border-primary"><Stat label="正式合同" value={summary.total} icon={<Monitor />} /></Link>
      <Link href="/rentals/drafts" className="rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-primary">待审核草稿</p><p className="mt-2 text-2xl font-bold">{summary.draft}</p></div><ClipboardPenLine className="size-5 text-primary" /></div></Link>
      <Link href="/rentals?status=在租" className="rounded-xl border bg-card p-4 transition-colors hover:border-primary"><Stat label="在租合同" value={summary.active} icon={<LayoutDashboard />} /></Link>
      <Link href="/rentals?status=逾期" className="rounded-xl border bg-card p-4 transition-colors hover:border-destructive"><Stat label="逾期待处理" value={summary.overdue} icon={<ClockAlert />} /></Link>
      {canViewFinance ? <Link href="/finance" className="rounded-xl border bg-card p-4 transition-colors hover:border-primary"><Stat label="累计收款" value={money(summary.revenue)} icon={<WalletCards />} /></Link> : <Stat label="累计收款" value="无权限" icon={<WalletCards />} />}
      <Link href="/rentals?receivable=outstanding&sort=outstanding" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 transition-colors hover:border-destructive"><Stat label="待收金额" value={money(summary.receivable)} icon={<CircleDollarSign />} /></Link>
    </section>
    <section className="rounded-xl border bg-card p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-end"><div><p className="text-sm font-medium text-primary">应收作战台</p><h2 className="mt-1 text-xl font-bold text-balance">待收款清晰拆分，催收不漏单</h2><p className="mt-1 text-sm text-muted-foreground">只统计剩余应收大于 0 的正式合同；已结清合同不会进入待收明细。</p></div><Link href="/rentals?receivable=outstanding&sort=outstanding" className="primary-button">查看 {summary.receivableContracts} 份待收合同</Link></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Link href="/rentals?receivable=overdue&sort=outstanding" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 transition-colors hover:bg-destructive/10"><p className="text-sm font-semibold text-destructive">已到期应收</p><p className="mt-2 text-2xl font-bold text-destructive">{money(summary.overdueReceivable)}</p><p className="mt-1 text-xs text-muted-foreground">优先联系逾期客户</p></Link><Link href="/rentals?receivable=upcoming&sort=due" className="rounded-xl border bg-background p-4 transition-colors hover:border-primary"><p className="text-sm font-semibold">未到期待收</p><p className="mt-2 text-2xl font-bold">{money(summary.upcomingReceivable)}</p><p className="mt-1 text-xs text-muted-foreground">尚未到合同到期日</p></Link><Link href="/rentals?receivable=outstanding&sort=outstanding" className="rounded-xl border bg-muted p-4 transition-colors hover:border-primary"><p className="text-sm font-semibold">全部待收</p><p className="mt-2 text-2xl font-bold">{money(summary.receivable)}</p><p className="mt-1 text-xs text-primary">按欠款金额查看明细</p></Link></div></section>
    <section className="rounded-xl border bg-card p-4"><div><h2 className="font-semibold">在租设备</h2><p className="text-sm text-muted-foreground">按设备类型统计当前仍在客户处的可用数量</p></div><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{deviceTypes.map((type) => <Link key={type} href={`/rentals?query=${encodeURIComponent(type)}`} className="rounded-xl border bg-background p-4 transition-colors hover:border-primary"><p className="text-sm text-muted-foreground">{type}</p><p className="mt-2 text-2xl font-bold">{summary.deviceCounts[type] ?? 0} 台</p><p className="mt-1 text-xs text-primary">查看相关合同</p></Link>)}</div></section>
    <section className="rounded-xl border bg-card p-4"><div><h2 className="font-semibold">租赁状态</h2><p className="text-sm text-muted-foreground">点击彩色状态查看对应合同</p></div><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{statusCards.map((item) => <Link key={item.label} href={item.href} className={`rounded-xl border p-4 transition-opacity hover:opacity-80 ${item.tone}`}><p className="text-sm font-semibold">{item.label}</p><p className="mt-2 text-2xl font-bold">{item.value}</p></Link>)}</div></section>
    <section className="grid gap-3 md:grid-cols-3">{[{ label: "逾期合同", value: summary.overdue, href: "/rentals?status=逾期" }, { label: "7 天内到期", value: summary.dueSoon, href: "/rentals?sort=due" }, { label: "维修处理中", value: summary.repairPending, href: "/rentals?query=维修" }].map((item) => <Link key={item.label} href={item.href} className="rounded-xl bg-muted p-4 transition-colors hover:bg-border"><p className="text-2xl font-bold">{item.value}</p><p className="mt-1 font-medium">{item.label}</p></Link>)}</section>
  </div></main>;
}

export function Dashboard({
  role,
  permissions,
  currentActorId,
  currentActorName,
  assignees,
  summary,
  rentals,
  mode = "overview",
  initialNew = false,
  returnHref = "/rentals",
}: {
  role: "super_admin" | "admin" | "employee";
  permissions: string[];
  currentActorId: string;
  currentActorName: string;
  assignees: RentalAssignee[];
  summary: Summary;
  rentals: Rental[];
  mode?: "overview" | "management";
  initialNew?: boolean;
  returnHref?: string;
}) {
  const canManageContracts =
    role === "super_admin" || permissions.includes("合同管理");
  const canViewFinance =
    role === "super_admin" || permissions.includes("资金查看");
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedRental =
    rentals.find((item) => item.id === Number(searchParams.get("rental"))) ??
    null;
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部");
  const [sort, setSort] = useState<"newest" | "due" | "amount">("newest");
  const [checked, setChecked] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<
    | "new"
    | "detail"
    | "renew"
    | "correct-renewal"
    | "reverse-renewals"
    | "payment"
    | "buyout"
    | "history"
    | "return"
    | "loss"
    | "change"
    | "repair"
    | "deposit"
  | "exchange"
  | "change-guide"
  | "delete-confirm"
  | "confirm-draft"
    | null
  >(initialNew ? "new" : linkedRental ? "detail" : null);
  const [selected, setSelected] = useState<Rental | null>(linkedRental);
  const detailRefreshStarted = useRef(false);
  useEffect(() => {
    if (linkedRental) setSelected(linkedRental);
  }, [linkedRental]);
  useEffect(() => {
    if (!linkedRental || detailRefreshStarted.current) return;
    detailRefreshStarted.current = true;
    router.refresh();
  }, [linkedRental, router]);
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<number | "all" | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [renewalReversalReason, setRenewalReversalReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [form, setForm] = useState<RentalInput>(emptyRental());
  const todayValue = today();
  const overdueAmount = (r: Rental) => rentalOverdueAmount(r, todayValue);
  const isRentalOverdue = (r: Rental) => rentalDisplayStatus(r, todayValue) === "逾期";
  const isRentalExpired = (r: Rental) => isContractExpired(r, todayValue);
  const displayStatus = (r: Rental) => rentalDisplayStatus(r, todayValue);
  const filtered = useMemo(
    () =>
      rentals
        .filter(
          (r) =>
            (status === "全部" || displayStatus(r) === status) &&
            `${r.contractNo}${r.customerCompany || ""}${r.customerName}${r.customerPhone}${r.deviceName}${r.items.map((i) => `${i.deviceCode || ""}${i.deviceConfig || ""}`).join("")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "due"
            ? a.endDate.localeCompare(b.endDate)
            : sort === "amount"
              ? Number(b.totalRent) - Number(a.totalRent)
              : b.id - a.id,
        ),
    [rentals, query, status, sort],
  );
  const overdueCustomers = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; phone: string; company: string | null; dueAmount: number; contracts: Array<Rental & { overdueDays: number; dueAmount: number; dueBills: Array<Bill & { outstanding: number }> }> }>();
    for (const rental of rentals) {
      const phone = rental.customerPhone.replace(/\D/g, "");
      const key = phone || rental.customerCompany?.trim().toLowerCase() || rental.customerName.trim().toLowerCase();
      const bills = rental.bills.map((bill) => ({ ...bill, outstanding: Math.max(0, Number(bill.amount) - Number(bill.paidAmount)) }));
      const dueBills = bills.filter((bill) => bill.dueDate <= todayValue && bill.outstanding > 0);
      const dueAmount = dueBills.reduce((sum, bill) => sum + bill.outstanding, 0);
      const current = groups.get(key) ?? { key, name: rental.customerName, phone: rental.customerPhone, company: rental.customerCompany, dueAmount: 0, contracts: [] };
      if (rentalDisplayStatus(rental, todayValue) === "逾期" && dueAmount > 0) {
        current.dueAmount += dueAmount;
        current.contracts.push({ ...rental, overdueDays: Math.max(0, Math.floor((Date.parse(`${todayValue}T00:00:00+08:00`) - Date.parse(`${rental.endDate}T00:00:00+08:00`)) / 86400000)), dueAmount, dueBills });
      }
      groups.set(key, current);
    }
    return [...groups.values()]
      .filter((customer) => customer.contracts.length > 0 && `${customer.company || ""}${customer.name}${customer.phone}${customer.contracts.map((rental) => rental.contractNo).join("")}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.dueAmount - a.dueAmount);
  }, [rentals, query, todayValue]);
  const copyCollectionMessage = async (customer: (typeof overdueCustomers)[number]) => {
    const lines = customer.contracts.flatMap((rental) => rental.dueBills.map((bill) =>
      `合同 ${rental.contractNo}｜${rental.items.map((item) => `${item.deviceName}×${item.quantity}`).join("、")}｜账期 ${bill.periodStart} 至 ${bill.periodEnd}｜付款日 ${bill.dueDate}｜待付 ${money(bill.outstanding)}`,
    ));
    const message = `${customer.name}您好，您当前有以下已到付款日的租赁账单待支付：\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}\n本次合计应付：${money(customer.dueAmount)}。尚未到付款日的账单未计入本次应付，请您核对并安排付款，谢谢。`;
    await navigator.clipboard.writeText(message);
    toast.success("微信催款文案已复制");
  };
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const effectivePage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (effectivePage - 1) * pageSize,
    effectivePage * pageSize,
  );
  const run = (
    fn: () => Promise<void | { ok: boolean; message?: string }>,
    message: string,
    successDialog: typeof dialog = null,
  ) =>
    start(async () => {
      try {
        const result = await fn();
        if (result && "ok" in result && !result.ok) {
          if (handleAuthExpired(result.message)) return;
          toast.error(result.message || "操作失败，请稍后重试");
          return;
        }
        toast.success(message);
        setDialog(successDialog);
        router.refresh();
      } catch (error) {
        if (handleAuthExpired(error)) return;
        toast.error(userErrorMessage(error));
      }
    });
  const runInDetail = (
    fn: () => Promise<void | { ok: boolean; message?: string }>,
    message: string,
  ) => run(fn, message, "detail");
  const openDetail = (r: Rental) => {
    router.push(`/rentals?rental=${r.id}`);
  };
  const closeDetail = () => {
    if (searchParams.has("rental")) {
      window.location.assign(returnHref);
      return;
    }
    setDialog(null);
    setSelected(null);
  };
  const confirmSelectedDraft = () => {
    if (!selected || selected.orderType !== "draft") return;
    start(async () => {
      const result = await confirmDraftsAsOfficial([selected.id]);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const outcome = result.data?.succeeded[0];
      if (!outcome) {
        toast.error(result.data?.failed[0]?.message || "转为正式合同失败");
        return;
      }
      toast.success(`已转为正式合同：${outcome.contractNo}`);
      setDialog(null);
      setSelected(null);
      router.push("/rentals");
      router.refresh();
    });
  };
  const selectedRentals = rentals.filter((r) => checked.includes(r.id));
  const reminderText = selectedRentals
    .map(
      (r) =>
        `${r.customerCompany || r.customerName}（${r.customerPhone}）：合同 ${r.contractNo} 将于 ${r.endDate} 到期，待收 ${money(Math.max(0, Number(r.totalRent) - Number(r.paidAmount)))}。`,
    )
    .join("\n");
  const copyReminders = async () => {
    if (!reminderText) return toast.error("请选择合同");
    await navigator.clipboard.writeText(reminderText);
    toast.success(`已复制 ${selectedRentals.length} 条提醒`);
  };
  const sendReminders = () => {
    if (!checked.length) return toast.error("请先选择合同");
    if (!window.confirm(`确认向 ${checked.length} 位客户发送合同提醒短信？`))
      return;
    start(async () => {
      try {
        const results = await sendRentalReminders(checked);
        const success = results.filter((result) => result.ok).length;
        const failed = results.length - success;
        if (success) toast.success(`短信已发送 ${success} 条`);
        if (failed)
          toast.error(
            `${failed} 条未发送：${results.find((result) => !result.ok)?.message || "请查看记录"}`,
          );
      } catch (error) {
        toast.error(userErrorMessage(error, "短信发送失败，请稍后重试"));
      }
    });
  };
  const exportSelected = () => {
    if (!selectedRentals.length) return toast.error("请先选择合同");
    const rows = [
      [
        "合同编号",
        "客户",
        "联系人",
        "电话",
        "起租日期",
        "非当天起租原因",
        "到期日",
        "合同金额",
        "已收金额",
        "状态",
      ],
      ...selectedRentals.map((r) => [
        r.contractNo,
        r.customerCompany || r.customerName,
        r.customerName,
        r.customerPhone,
        r.startDate,
        r.startDateReason || "",
        r.endDate,
        r.totalRent,
        r.paidAmount,
        displayStatus(r),
      ]),
    ];
    const csv =
      "\ufeff" +
      rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `租赁合同-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${selectedRentals.length} 份合同`);
  };
  const dueSoon = summary.dueSoon;
  const repairPending = summary.repairPending;
  const overdueCount = rentals.filter((r) => displayStatus(r) === "逾期").length;
  const expiredCount = rentals.filter((r) => displayStatus(r) === "已到期").length;
  return (
    <div className="bg-background">
      <div className={linkedRental ? "hidden" : "p-4 md:p-6"}>
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-primary">{mode === "overview" ? "经营分析中心" : "合同全生命周期"}</p>
              <h1 className="mt-1 text-2xl font-bold text-balance">{mode === "overview" ? "经营总览" : "租赁管理"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "overview" ? "集中查看财务、统计、催收和经营提醒；合同办理统一前往租赁管理" : "统一办理租机登记、修改、续租、退租、买断和售后事项"}
              </p>
            </div>
            {mode === "management" && <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!checked.length || pending}
                onClick={sendReminders}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-primary px-4 font-semibold text-primary disabled:border-border disabled:text-muted-foreground"
              >
                <BellRing className="size-4" />
                发送短信提醒{checked.length ? `（${checked.length}）` : ""}
              </button>
              <button
                onClick={() => {
                  setForm({ ...emptyRental(), assigneeUserId: currentActorId });
                  setDialog("new");
                }}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Plus className="size-4" />
                登记新租赁
              </button>
            </div>}
          </div>
          <div className={mode === "management" ? "hidden" : "grid grid-cols-2 gap-3 lg:grid-cols-6"}>
            <Stat label="正式合同" value={summary.total} icon={<Monitor />} />
            <Link
              href="/rentals/drafts"
              className="rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary hover:bg-primary/10"
              aria-label={`查看 ${summary.draft} 份待审核草稿`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-primary">待审核草稿</p>
                  <p className="mt-2 text-2xl font-bold">{summary.draft}</p>
                </div>
                <ClipboardPenLine className="size-5 text-primary" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">点击审核并转为正式合同</p>
            </Link>
            <Stat
              label="在租合同"
              value={summary.active}
              icon={<LayoutDashboard />}
            />
            <Stat
              label="逾期待处理"
              value={overdueCount}
              icon={<ClockAlert />}
            />
            <Stat
              label="累计收款"
              value={money(summary.revenue)}
              icon={<WalletCards />}
            />
            <div className="col-span-2 lg:col-span-1">
              <Stat
                label="待收金额"
                value={money(summary.receivable)}
                icon={<CircleDollarSign />}
              />
            </div>
          </div>
          <section className={mode === "management" ? "hidden" : "rounded-xl border bg-card p-4"}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">经营待办</h2>
                <p className="text-sm text-muted-foreground">
                  需要优先跟进的合同、应收款项和设备服务事项
                </p>
              </div>
              <BellRing className="size-5 text-primary" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => router.push("/rentals?status=逾期")}
                className="rounded-xl bg-muted p-3 text-left hover:bg-border"
              >
                <p className="text-2xl font-bold">{overdueCount}</p>
                <p className="text-sm text-muted-foreground">逾期合同</p>
              </button>
              <button
                type="button"
                onClick={() => router.push("/rentals?sort=due")}
                className="rounded-xl bg-muted p-3 text-left hover:bg-border"
              >
                <p className="text-2xl font-bold">{dueSoon}</p>
                <p className="text-sm text-muted-foreground">7 天内到期</p>
              </button>
              <button
                type="button"
                onClick={() => setSort("amount")}
                className="rounded-xl bg-muted p-3 text-left hover:bg-border"
              >
                <p className="text-2xl font-bold">
                  {money(summary.receivable)}
                </p>
                <p className="text-sm text-muted-foreground">应收待跟进</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("全部");
                  setQuery("维修");
                }}
                className="rounded-xl border bg-muted p-3 text-left hover:border-primary hover:bg-border"
              >
                <p className="text-2xl font-bold">{repairPending}</p>
                <p className="text-sm text-muted-foreground">维修处理中</p>
              </button>
            </div>
          </section>
          {mode === "management" && (
            <section aria-label="租赁任务摘要" className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
              <span className="mr-1 text-sm font-semibold">当前任务</span>
              <button type="button" onClick={() => setStatus("逾期")} className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">逾期 {overdueCount}</button>
              <button type="button" onClick={() => setStatus("已到期")} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">已到期 {expiredCount}</button>
              <button type="button" onClick={() => router.push("/rentals?sort=due")} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">7 天到期 {dueSoon}</button>
              <button type="button" onClick={() => { setStatus("全部"); setQuery("维修"); }} className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">维修中 {repairPending}</button>
              <span className="ml-auto text-sm text-muted-foreground">待收 <strong className="text-foreground">{money(summary.receivable)}</strong></span>
            </section>
          )}
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            aria-label="合同快捷筛选"
          >
            {[
              ["全部", summary.total],
              ["在租", rentals.filter((r) => displayStatus(r) === "在租").length],
              ["逾期", overdueCount],
              ["已到期", expiredCount],
            ].map(([label, count]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => setStatus(String(label))}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${status === label ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              >
                <span>{label}</span>
                <span
                  className={`rounded-full px-1.5 text-xs ${status === label ? "bg-primary-foreground/15" : "bg-muted"}`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{mode === "management" ? "租赁任务列表" : "最近租赁合同"}</h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "management" ? "按风险和下一节点处理；点击合同进入唯一业务工作台" : "仅作经营摘要，具体业务请进入租赁管理"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/rentals" className="flex h-10 items-center rounded-lg border px-3 text-sm font-semibold text-primary hover:bg-muted">查看全部</Link>
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 sm:w-64">
                  <Search className="size-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder="合同、客户或设备"
                  />
                </label>
                <select
                  aria-label="租赁状态"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-10 rounded-lg border bg-background px-3"
                >
                  {[
                    "全部",
  "在租",
  "逾期",
  "已到期",
  "部分买断",
                    "部分退租",
                    "部分丢失",
                    "丢失",
                    "买断",
                    "已退租",
                    "已结束",
                    "已关闭",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="合同排序"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="h-10 rounded-lg border bg-background px-3"
                >
                  <option value="newest">最新创建</option>
                  <option value="due">到期优先</option>
                  <option value="amount">金额从高到低</option>
                </select>
                {(query || status !== "全部" || sort !== "newest") && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setStatus("全部");
                      setSort("newest");
                    }}
                    className="h-10 shrink-0 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>
            {mode === "management" && checked.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <CheckSquare className="size-4 text-primary" />
                <span className="mr-auto text-sm font-medium">
                  已选择 {checked.length} 份合同
                </span>
                <button
                  type="button"
                  onClick={copyReminders}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium"
                >
                  <Copy className="size-4" />
                  复制到期提醒
                </button>
                <button
                  type="button"
                  onClick={exportSelected}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                  <Download className="size-4" />
                  导出所选
                </button>
                <button
                  type="button"
                  onClick={() => setChecked([])}
                  className="h-9 px-2 text-sm text-muted-foreground"
                >
                  取消选择
                </button>
              </div>
            )}
            {status === "逾期" && (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-muted p-4">
                  <div>
                    <p className="font-semibold">客户催收汇总</p>
                    <p className="mt-1 text-sm text-muted-foreground">按手机号归并客户，只统计付款日已到且尚未结清的账单；未来付款日账单不会提前催收。</p>
                  </div>
                  <div className="flex gap-6 text-right">
                    <div><p className="text-xs text-muted-foreground">当前待催客户</p><p className="text-xl font-bold">{overdueCustomers.length}</p></div>
                    <div><p className="text-xs text-muted-foreground">截至今日应付</p><p className="text-xl font-bold text-destructive">{money(overdueCustomers.reduce((sum, customer) => sum + customer.dueAmount, 0))}</p></div>
                  </div>
                </div>
                {overdueCustomers.map((customer) => (
                  <article key={customer.key} className="overflow-hidden rounded-xl border">
                    <div className="flex flex-col justify-between gap-3 bg-card p-4 sm:flex-row sm:items-center">
                      <div><p className="font-semibold">{customer.company || customer.name}</p><p className="mt-1 text-sm text-muted-foreground">{customer.company ? `${customer.name} · ` : ""}{customer.phone} · {customer.contracts.length} 份待催合同</p></div>
                      <div className="flex flex-wrap items-center gap-3 sm:justify-end"><div className="sm:text-right"><p className="text-xs text-muted-foreground">截至今日应付</p><p className="font-bold text-destructive">{money(customer.dueAmount)}</p></div><button type="button" onClick={() => copyCollectionMessage(customer)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><Copy className="size-4" />复制微信催款</button></div>
                    </div>
                    <div className="divide-y border-t">
                      {customer.contracts.sort((a, b) => b.overdueDays - a.overdueDays).map((rental) => (
                        <button key={rental.id} type="button" onClick={() => openDetail(rental)} className="grid w-full gap-2 p-4 text-left hover:bg-muted/50 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
                          <div><p className="text-sm font-medium">{rental.contractNo}</p><p className="text-xs text-muted-foreground">{rental.quantity} 台 · {rental.items.map((item) => item.deviceName).join("、")}</p></div>
                          <div className="text-sm"><p>{rental.dueBills.length} 笔已到付款日</p><p className="text-xs text-muted-foreground">{rental.dueBills.map((bill) => `${bill.dueDate} · ${bill.billType} ${money(bill.outstanding)}`).join("；")}</p></div>
                          <div className="sm:text-right"><p className="text-xs text-muted-foreground">本合同当前应付</p><p className="font-semibold text-destructive">{money(rental.dueAmount)}</p></div>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
                {!overdueCustomers.length && <p className="p-10 text-center text-sm text-muted-foreground">暂无逾期客户</p>}
              </div>
            )}
            {status !== "逾期" && <div className="divide-y md:hidden">
              {visible.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => openDetail(r)}
                  className={`flex w-full flex-col gap-3 p-4 text-left hover:bg-muted/50 ${isRentalOverdue(r) ? "bg-destructive/5" : isRentalExpired(r) ? "bg-accent/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {r.customerCompany || r.customerName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.contractNo} · {r.customerPhone}
                      </p>
                    </div>
                    <Status value={displayStatus(r)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">设备</p>
                      <p className="mt-1 line-clamp-2">
                        {r.items.length} 项 · 共 {r.quantity} 台
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">合同金额</p>
                      <p className="mt-1 font-semibold">{money(r.totalRent)}</p>
                      {isRentalOverdue(r) && <p className="mt-1 font-semibold text-destructive">逾期需付 {money(overdueAmount(r))}</p>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    租期：{r.startDate} 至 {r.endDate}
                  </p>
                </button>
              ))}
            </div>}
            {status !== "逾期" && <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="w-12 p-3">
                      <input
                        type="checkbox"
                        aria-label="选择当前页全部合同"
                        checked={
                          visible.length > 0 &&
                          visible.every((r) => checked.includes(r.id))
                        }
                        onChange={(e) =>
                          setChecked(
                            e.target.checked
                              ? Array.from(
                                  new Set([
                                    ...checked,
                                    ...visible.map((r) => r.id),
                                  ]),
                                )
                              : checked.filter(
                                  (id) => !visible.some((r) => r.id === id),
                                ),
                          )
                        }
                      />
                    </th>
                    <th className="p-3">合同编号</th>
                    <th className="p-3">客户</th>
                    <th className="p-3">设备明细</th>
                    <th className="p-3">数量</th>
                    <th className="p-3">租期</th>
                    <th className="p-3">租金总额</th>
                    <th className="p-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr
                      key={r.id}
                      onDoubleClick={() => openDetail(r)}
                      title="双击查看租赁详情"
                      className={`cursor-pointer border-t hover:bg-muted/50 ${isRentalOverdue(r) ? "bg-destructive/5" : isRentalExpired(r) ? "bg-accent/40" : ""}`}
                    >
                      <td
                        className="p-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`选择合同 ${r.contractNo}`}
                          checked={checked.includes(r.id)}
                          onChange={(e) =>
                            setChecked(
                              e.target.checked
                                ? [...checked, r.id]
                                : checked.filter((id) => id !== r.id),
                            )
                          }
                        />
                      </td>
                      <td className="p-3 font-medium">{r.contractNo}</td>
                      <td className="p-3">
                        <p className="font-medium">
                          {r.customerCompany || r.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.customerCompany ? `${r.customerName} · ` : ""}
                          {r.customerPhone}
                        </p>
                      </td>
                      <td className="p-3">
                        {r.items.length} 项 ·{" "}
                        {r.items
                          .map((i) => `${i.deviceType} ${i.deviceName}`)
                          .join("、")}
                      </td>
                      <td className="p-3">{r.quantity}</td>
                      <td className="p-3">
                        {r.startDate} 至 {r.endDate}
                      </td>
                      <td className="p-3"><p>{money(r.totalRent)}</p>{isRentalOverdue(r) && <p className="mt-1 font-semibold text-destructive">逾期需付 {money(overdueAmount(r))}</p>}</td>
                      <td className="p-3">
                        <Status value={displayStatus(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  暂无符合条件的租赁记录
                </p>
              )}
            </div>}
            {status !== "逾期" && filtered.length > pageSize && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  第 {page} / {pageCount} 页
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="上一页"
                    disabled={page === 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="rounded-lg border p-2 disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="下一页"
                    disabled={page === pageCount}
                    onClick={() =>
                      setPage((value) => Math.min(pageCount, value + 1))
                    }
                    className="rounded-lg border p-2 disabled:opacity-40"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      <Dialog
        open={dialog === "new"}
        title="新增租赁合同"
        wide
        onClose={() => setDialog(null)}
      >
        <RentalForm
          form={form}
          setForm={setForm}
          pending={pending}
          currentActorName={currentActorName}
          assignees={assignees}
          allowTest={role !== "employee"}
          submit={(value, sendNow, orderType, initialCollection) => start(async () => {
                  const created = await createRental(value, orderType, initialCollection);
                  if (!created.ok) {
                    if (handleAuthExpired(created.message)) return;
                    toast.error(created.message);
                    return;
                  }
                  if (orderType === "official" && sendNow && created.data) {
                    try {
                      const notice = await sendRentalCreatedNotice(created.data);
                      if (notice.ok) toast.success("正式合同已创建，初始租赁通知已发送");
                      else toast.error(`正式合同已创建，但短信未发送：${notice.message}`);
                    } catch (error) {
                      toast.error(`正式合同已创建，但短信未发送：${error instanceof Error ? error.message : "请稍后在合同详情中补发"}`);
                    }
                  } else toast.success(orderType === "draft" ? "草稿已保存，不计入经营与财务数据" : orderType === "test" ? "测试合同已创建，不计入经营与财务数据" : "正式租赁合同已创建");
                  sessionStorage.removeItem("suwei:new-rental-draft");
                  delete document.documentElement.dataset.unsavedRental;
                  setDialog(null);
                  router.replace("/rentals");
                })}
        />
      </Dialog>
      <Dialog
        open={dialog === "detail"}
        title={selected?.contractNo || "租赁详情"}
        wide
        fixedHeight
        embedded={Boolean(linkedRental)}
        onClose={closeDetail}
      >
        {selected && (
          <Detail
            rental={selected}
            role={role}
            assignees={assignees}
            canManageContracts={canManageContracts}
canViewFinance={canViewFinance}
  onSendNotice={() => start(async () => {
    const result = await sendRentalCreatedNotice(selected.id);
    if (result.ok) toast.success("初始租赁通知已发送");
    else toast.error(result.message);
  })}
  onAssignee={(assigneeId) =>
  runInDetail(
                () => updateRentalAssignee(selected.id, assigneeId),
                "维护负责人已更新",
              )
            }
            onDelete={() => {
  setDeleteReason("");
  setAdminPassword("");
  setDialog("delete-confirm");
}}
            onConfirmDraft={() => setDialog("confirm-draft")}
            onRentalChange={() => setDialog("change-guide")}
            onPayment={(target) => {
              setPaymentTarget(target);
              setDialog("payment");
            }}
            onRenew={() => setDialog("renew")}
            onCorrectRenewal={(record) => {
              setSelectedRenewal(record);
              setDialog("correct-renewal");
            }}
            onReverseRenewals={() => {
              setRenewalReversalReason("");
              setDialog("reverse-renewals");
            }}
            onBuyout={() => setDialog("buyout")}
            onHistory={() => setDialog("history")}
            onReturn={() => setDialog("return")}
            onLoss={() => setDialog("loss")}
            onChange={() => setDialog("change")}
            onRepair={() => setDialog("repair")}
            onDeposit={() => setDialog("deposit")}
            onExchange={() => setDialog("exchange")}
            onReverse={(paymentId) =>
              runInDetail(() => reversePayment(paymentId, "收款录入错误"), "收款已冲正")
            }
            onReverseAll={() =>
              runInDetail(() => reverseAllPayments(selected.id, "本单全部收款录入错误，重新收款"), "全部有效收款已冲正")
            }
            onStatus={(s) =>
              runInDetail(() => changeStatus(selected.id, s), "状态已更新")
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "confirm-draft"}
        title="确认转为正式合同"
        onClose={() => !pending && setDialog("detail")}
      >
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <ClipboardPenLine className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">请在转正前完成最后核对</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    这项操作会将草稿纳入正式经营和财务数据，转正后不能删除。
                  </p>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4 text-sm">
              <Info l="草稿编号" v={selected.contractNo} />
              <Info l="客户" v={selected.customerCompany || selected.customerName} />
              <Info l="租赁金额" v={money(Number(selected.totalRent))} />
              <Info l="设备数量" v={`${selected.items.reduce((total, item) => total + item.quantity, 0)} 台`} />
            </dl>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">确认后系统将自动完成</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                  <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>生成正式合同号</span>
                </div>
                <div className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                  <WalletCards className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>生成应收账单</span>
                </div>
                <div className="flex items-start gap-2 rounded-xl border p-3 text-sm">
                  <CheckSquare className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>计入经营数据</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={() => setDialog("detail")}
                className="h-11 rounded-xl border bg-background px-5 text-sm font-medium disabled:opacity-50"
              >
                暂不转正
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmSelectedDraft}
                className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {pending ? "正在生成正式合同…" : "确认转为正式合同"}
              </button>
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        open={dialog === "change-guide"}
        title="办理租赁变更"
        wide
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <RentalChangeGuide
            rental={selected}
            pending={pending}
            onNavigate={(target) => setDialog(target)}
            submit={(value) => runInDetail(() => changeRentalContract(value), "租赁变更已登记")}
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "delete-confirm"}
        title={selected?.orderType === "official" ? "撤销重复合同" : "确认移入回收站"}
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () => deleteTestRental({ id: selected.id, reason: deleteReason, adminPassword: selected.orderType === "official" ? adminPassword : undefined }),
                  selected.orderType === "official" ? "重复合同及初始收款已撤销" : "订单已移入回收站",
                );
              }}
            >
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="font-semibold text-destructive">{selected.orderType === "official" ? "重复合同及初始账务将一并撤销" : "订单将进入回收站"}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selected.orderType === "official"
                    ? "仅限撤销今天重复创建、且没有续租、退租、买断、丢失、维修、变更或额外收款的正式合同。合同会保留在回收站，操作记录会永久保留。"
                    : "草稿与测试订单只会移入回收站并支持恢复；测试订单仅限创建后 24 小时内处理。"}
                </p>
                {selected.orderType === "official" && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-background p-3"><span className="text-muted-foreground">撤销租金收款</span><p className="mt-1 font-semibold">{money(selected.paidAmount)}</p></div>
                    <div className="rounded-lg bg-background p-3"><span className="text-muted-foreground">撤销押金收款</span><p className="mt-1 font-semibold">{money(selected.deposit)}</p></div>
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium">
                删除原因
                <textarea
                  required
                  minLength={4}
                  maxLength={200}
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  placeholder="例如：当天录入了错误的设备和租期"
                  className="min-h-24 resize-y rounded-lg border bg-background px-3 py-2 font-normal outline-none focus:border-primary"
                />
              </label>
              {selected.orderType === "official" && (
                <label className="flex flex-col gap-2 text-sm font-medium">
                  当前管理员登录密码
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    placeholder="请输入您当前账号的登录密码"
                    className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus:border-primary"
                  />
                  <span className="font-normal text-muted-foreground">密码仅用于本次身份验证，不会保存或写入业务记录。</span>
                </label>
              )}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setDialog("detail")} className="h-10 rounded-lg border px-4 text-sm font-medium">取消</button>
                <button
                  type="submit"
                  disabled={pending || deleteReason.trim().length < 4 || (selected.orderType === "official" && !adminPassword)}
                  className="h-10 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {pending ? "正在验证并撤销…" : selected.orderType === "official" ? "验证密码并撤销重复合同" : "确认移入回收站"}
                </button>
              </div>
            </form>
        )}
      </Dialog>
      <Dialog
        open={dialog === "payment"}
        title="登记收款"
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <PaymentForm
            pending={pending}
            bills={selected.bills}
            target={paymentTarget}
            submit={(value) =>
              runInDetail(() => collectPayment(selected.id, value), "收款已登记")
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "renew"}
        title="办理部分设备续租"
        wide
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <RenewalForm
            rental={selected}
            pending={pending}
            submit={(values, settlement) =>
              runInDetail(() => renewRentalItems(selected.id, values, settlement), "续租已办理")
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "correct-renewal"}
        title="更正续租价格"
        onClose={() => !pending && setDialog("detail")}
      >
        {selectedRenewal && (
          <RenewalCorrectionForm
            record={selectedRenewal}
            pending={pending}
            submit={(correctedUnitPrice, reason) =>
              runInDetail(() => correctRenewalPrice({ renewalRecordId: selectedRenewal.id, correctedUnitPrice, reason }), "续租价格已更正")
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "reverse-renewals"}
        title="全部冲正续租"
        onClose={() => !pending && setDialog("detail")}
      >
        {selected && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              runInDetail(
                () => reverseAllRenewals({ rentalId: selected.id, reason: renewalReversalReason }),
                "续租已全部冲正，合同日期与账务已重新计算",
              );
            }}
          >
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="font-semibold text-destructive">此操作会一次性冲正全部有效续租</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                系统会保留历史记录并标记为“已冲正”，同时回滚关联账单、收款、设备租期、合同到期日和合同金额。任一关联数据无法核对时，整次操作不会修改任何数据。
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">有效续租</dt><dd className="font-semibold">{selected.renewalRecords.filter((record) => record.status !== "已冲正").length} 笔</dd></div>
                <div><dt className="text-muted-foreground">当前到期日</dt><dd className="font-semibold">{selected.endDate}</dd></div>
              </dl>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium">
              冲正原因
              <textarea
                required
                minLength={2}
                maxLength={200}
                value={renewalReversalReason}
                onChange={(event) => setRenewalReversalReason(event.target.value)}
                placeholder="请说明为什么需要全部冲正"
                className="min-h-24 rounded-xl border bg-background px-3 py-2 font-normal outline-none focus:border-primary"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setDialog("detail")} className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50">取消</button>
              <button type="submit" disabled={pending || renewalReversalReason.trim().length < 2} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50">{pending ? "正在核对并冲正…" : "确认全部冲正"}</button>
            </div>
          </form>
        )}
      </Dialog>
      <Dialog
        open={dialog === "history"}
        title="客户历史记录"
        wide
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && <CustomerHistory phone={selected.customerPhone} />}
      </Dialog>
      <Dialog
        open={dialog === "return"}
        title="办理设备退租"
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <OperationForm
            rental={selected}
            mode="return"
            pending={pending}
            submit={(values) =>
              runInDetail(
                () => returnRentalItems(validateBusinessBatch(values as ReturnInput[], (value) => value.rentalItemId)),
                "退租已登记",
              )
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "loss"}
        title="登记设备丢失"
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <OperationForm
            rental={selected}
            mode="loss"
            pending={pending}
            submit={(values) =>
              runInDetail(() => reportLostItems(validateBusinessBatch(values as LossInput[], (value) => value.rentalItemId)), "丢失已登记")
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "change"}
        title="变更配置与租金"
        wide
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <ChangeForm
            rental={selected}
            pending={pending}
            submit={(values) =>
              runInDetail(
                () => changeRentalItems(validateBusinessBatch(values, (value) => value.itemId)),
                "配置与应收已更新",
              )
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "repair"}
        title="登记维修单"
        wide
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <RepairForm
            rental={selected}
            pending={pending}
            submit={(values) =>
              runInDetail(() => createRepairRecords(validateBusinessBatch(values, (value) => value.itemId)), "维修记录已保存")
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "deposit"}
        title="押金退还或抵扣"
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <DepositForm
            rental={selected}
            pending={pending}
            submit={(type, amount, date, notes) =>
              runInDetail(
                () =>
                  recordDepositAction(selected.id, type, amount, date, notes),
                "押金流水已登记",
              )
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "exchange"}
        title="设备换机调拨"
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <ExchangeForm
            rental={selected}
            pending={pending}
            submit={(values) =>
              runInDetail(
                () => exchangeRentalItems(values),
                "换机调拨已登记",
              )
            }
          />
        )}
      </Dialog>
      <Dialog
        open={dialog === "buyout"}
        title="办理部分买断"
        embedded={Boolean(linkedRental)}
        onClose={() => setDialog("detail")}
      >
        {selected && (
          <BuyoutForm
            rental={selected}
            pending={pending}
            submit={(values, settlement) =>
              runInDetail(
                () => buyoutRentalItems(validateBusinessBatch(values.map((value) => ({ ...value, rentalId: selected.id })), (value) => value.itemId), settlement),
                "买断已登记",
              )
            }
          />
        )}
      </Dialog>
    </div>
  );
}

const configs: Record<string, [keyof RentalItemInput, string, string][]> = {
  台式机: [
    ["cpu", "CPU", "Intel i5-12400"],
    ["motherboard", "主板", "华硕 B660M"],
    ["memory", "内存", "16GB DDR4"],
    ["storage", "硬盘", "512GB SSD"],
    ["graphicsCard", "显卡", "RTX 3060"],
    ["powerSupply", "电源", "550W"],
    ["caseModel", "机箱", "MATX 机箱"],
  ],
  笔记本: [
    ["cpu", "CPU", "Core Ultra 7"],
    ["memory", "内存", "16GB"],
    ["storage", "硬盘", "1TB SSD"],
    ["graphicsCard", "显卡", "Intel Arc"],
    ["screenSize", "屏幕尺寸", "14 英寸"],
    ["screenResolution", "分辨率", "2560 × 1600"],
    ["batteryInfo", "电池信息", "57Wh / 健康度 95%"],
    ["adapterInfo", "适配器", "65W Type-C"],
  ],
  显示器: [
    ["screenSize", "屏幕尺寸", "27 英寸"],
    ["screenResolution", "分辨率", "2560 × 1440"],
    ["refreshRate", "刷新率", "165Hz"],
    ["panelType", "面板", "IPS"],
    ["colorGamut", "色域", "99% sRGB"],
    ["ports", "接口", "HDMI / DP"],
    ["monitorInfo", "支架功能", "升降旋转"],
    ["accessories", "配件", "电源线、DP 线"],
  ],
  一体机: [
    ["cpu", "CPU", "Intel i5"],
    ["memory", "内存", "16GB"],
    ["storage", "硬盘", "512GB SSD"],
    ["graphicsCard", "显卡", "Intel UHD"],
    ["screenSize", "屏幕尺寸", "24 英寸"],
    ["screenResolution", "分辨率", "1920 × 1080"],
    ["ports", "接口", "USB / HDMI / 网口"],
    ["accessories", "配件", "无线键鼠"],
  ],
};
const configTemplates: Record<
  string,
  Array<{ name: string; values: Partial<RentalItemInput> }>
> = {
  台式机: [
    {
      name: "办公基础款",
      values: {
        deviceName: "办公台式机",
        cpu: "Intel i5-12400",
        motherboard: "B660M",
        memory: "16GB DDR4",
        storage: "512GB SSD",
        graphicsCard: "核芯显卡",
        powerSupply: "500W",
        caseModel: "商务机箱",
      },
    },
    {
      name: "设计性能款",
      values: {
        deviceName: "设计台式机",
        cpu: "Intel i7-12700",
        motherboard: "B660M",
        memory: "32GB DDR4",
        storage: "1TB SSD",
        graphicsCard: "RTX 3060",
        powerSupply: "650W",
        caseModel: "MATX 机箱",
      },
    },
  ],
  笔记本: [
    {
      name: "商务办公款",
      values: {
        deviceName: "商务笔记本",
        cpu: "Intel i5",
        memory: "16GB",
        storage: "512GB SSD",
        graphicsCard: "核芯显卡",
        screenSize: "14 英寸",
        screenResolution: "1920 × 1080",
        adapterInfo: "65W 电源适配器",
      },
    },
    {
      name: "移动性能款",
      values: {
        deviceName: "高性能笔记本",
        cpu: "Intel i7",
        memory: "32GB",
        storage: "1TB SSD",
        graphicsCard: "RTX 4060",
        screenSize: "16 英寸",
        screenResolution: "2560 × 1600",
        adapterInfo: "原装电源适配器",
      },
    },
  ],
  显示器: [
    {
      name: "办公显示器",
      values: {
        deviceName: "办公显示器",
        screenSize: "24 英寸",
        screenResolution: "1920 × 1080",
        refreshRate: "75Hz",
        panelType: "IPS",
        ports: "HDMI",
        accessories: "电源线、HDMI 线",
      },
    },
    {
      name: "设计显示器",
      values: {
        deviceName: "设计显示器",
        screenSize: "27 英寸",
        screenResolution: "2560 × 1440",
        refreshRate: "100Hz",
        panelType: "IPS",
        colorGamut: "99% sRGB",
        ports: "HDMI / DP",
        accessories: "电源线、DP 线",
      },
    },
  ],
  一体机: [
    {
      name: "办公一体机",
      values: {
        deviceName: "办公一体机",
        cpu: "Intel i5",
        memory: "16GB",
        storage: "512GB SSD",
        graphicsCard: "核芯显卡",
        screenSize: "24 英寸",
        screenResolution: "1920 × 1080",
        accessories: "无线键鼠",
      },
    },
  ],
};
function RentalForm({
  form,
  setForm,
  submit,
  pending,
  currentActorName,
  assignees,
  allowTest,
  }: {
  form: RentalInput;
  setForm: React.Dispatch<React.SetStateAction<RentalInput>>;
  submit: (form: RentalInput, sendNow: boolean, orderType: "draft" | "test" | "official", initialCollection?: InitialCollectionInput) => void;
  pending: boolean;
  currentActorName: string;
  assignees: RentalAssignee[];
  allowTest: boolean;
  }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [sendNoticeNow, setSendNoticeNow] = useState(true);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [initialCollection, setInitialCollection] = useState<InitialCollectionInput>({
    collectRent: false,
    collectDeposit: false,
    paymentDate: today(),
    paymentMethod: "微信",
  });
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [customerOffer, setCustomerOffer] = useState<{ name: string; level: string; label: string; discount: number; suggestion: string; note: string | null } | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [historySuggestions, setHistorySuggestions] = useState<Awaited<ReturnType<typeof getRentalFormSuggestions>>>({ contacts: [], configurations: {} });
  const draftReady = useRef(false);
  useEffect(() => {
    document.documentElement.dataset.unsavedRental = "true";
    try {
      const saved = sessionStorage.getItem("suwei:new-rental-draft");
      if (saved) {
        const draft = JSON.parse(saved) as { form?: RentalInput; step?: number };
        if (draft.form) setForm(draft.form);
        if (typeof draft.step === "number") setStep(Math.min(3, Math.max(0, draft.step)));
        toast.info("已恢复上次未完成的租赁录入");
      }
    } catch {
      sessionStorage.removeItem("suwei:new-rental-draft");
    }
    return () => { delete document.documentElement.dataset.unsavedRental; };
  }, [setForm]);
  useEffect(() => {
    if (!draftReady.current) {
      draftReady.current = true;
      return;
    }
    sessionStorage.setItem("suwei:new-rental-draft", JSON.stringify({ form, step }));
  }, [form, step]);
  useEffect(() => {
    let active = true;
    getRentalFormSuggestions().then((value) => { if (active) setHistorySuggestions(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const applyContact = (name: string) => {
    const matches = historySuggestions.contacts.filter((contact) => contact.name === name.trim());
    if (!matches.length) return;
    const selected = matches[0];
    setForm((current) => ({ ...current, customerName: selected.name, customerPhone: selected.phone, customerCompany: selected.company, customerAddress: selected.address }));
    setCustomerOffer(null);
  };
  const checkCustomerOffer = async () => {
    if (!/^1\d{10}$/.test(form.customerPhone.trim())) { setCustomerOffer(null); return; }
    setOfferLoading(true);
    try { setCustomerOffer(await getCustomerOfferSuggestion(form.customerPhone)); }
    catch { setCustomerOffer(null); }
    finally { setOfferLoading(false); }
  };
  const billingType = form.billingType || "monthly";
  const duration = Math.max(1, form.duration || 1);
  const suggestedTotal = (item: RentalItemInput) =>
    Math.max(0, item.quantity * item.monthlyRent * duration);
  useEffect(() => {
    let active = true;
    const startDate = form.startDate;
    const itemNumbers = form.items.map((item) => ({
      deviceType: item.deviceType,
      quantity: Math.max(1, item.quantity || 1),
    }));
    const preview = buildRentalNumberPreview(startDate, itemNumbers);
    setForm((current) => ({
      ...current,
      contractNo: preview.contractNo,
      items: current.items.map((item, index) => ({
        ...item,
        deviceCode: preview.deviceCodes[index] || item.deviceCode,
      })),
    }));
    setNumbersLoading(true);
    const timer = setTimeout(() => {
      getNextRentalNumbers(startDate, itemNumbers)
        .then((numbers) => {
          if (active)
            setForm((current) => ({
              ...current,
              contractNo: numbers.contractNo,
              items: current.items.map((item, index) => ({
                ...item,
                deviceCode: numbers.deviceCodes[index] || item.deviceCode,
              })),
            }));
        })
        .catch(() => {})
        .finally(() => {
          if (active) setNumbersLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    form.startDate,
    form.items.map((item) => `${item.deviceType}:${item.quantity}`).join("|"),
    setForm,
  ]);
  const updateItem = (
    index: number,
    key: keyof RentalItemInput,
    value: string | number,
  ) => {
    const items = form.items.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [key]: value };
      if (key === "deviceType" && value === "台式机") next.deviceName = "";
      if (key === "quantity" || key === "monthlyRent")
        next.totalRent = suggestedTotal(next);
      return next;
    });
    setForm({ ...form, items });
  };
  useEffect(() => {
    const endDate = calculateEndDate(form.startDate, billingType, duration);
    const items = form.items.map((item) => ({
      ...item,
      totalRent: suggestedTotal(item),
    }));
    if (
      endDate !== form.endDate ||
      items.some(
        (item, index) => item.totalRent !== form.items[index].totalRent,
      )
    )
      setForm({ ...form, endDate, items });
  }, [form.startDate, billingType, duration]);
  const totals = form.items.reduce(
    (a, i) => ({
      qty: a.qty + i.quantity,
      monthly: a.monthly + i.monthlyRent * i.quantity,
      total: a.total + i.totalRent,
    }),
    { qty: 0, monthly: 0, total: 0 },
  );
  const calculatedEndDate = calculateEndDate(
    form.startDate,
    billingType,
    form.duration,
  );
  const normalizedForm = {
    ...form,
    billingType,
    duration: form.duration,
    endDate: calculatedEndDate,
  };
  const validate = () => {
    if (step === 0 && form.customerName.trim().length < 2)
      return "联系人姓名至少需要 2 个字";
    if (step === 0 && !/^1\d{10}$/.test(form.customerPhone.trim()))
      return "请输入正确的 11 位手机号";
    if (step === 1) {
      const itemError = form.items.map(validateRentalItemFields).find(Boolean);
      if (itemError) return itemError;
    }
    if (step === 2 && !form.startDate) return "请选择起租日期";
    if (step === 2 && (!Number.isInteger(form.duration) || form.duration < 1))
      return `请输入正确的租赁时间（至少 1 ${billingType === "daily" ? "天" : "个月"}）`;
    if (step === 2 && form.startDate !== today() && !form.startDateReason)
      return "非当天起租必须选择原因";
    return "";
  };
  const next = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(3, current + 1));
  };
  const confirmSubmit = (orderType: "draft" | "test" | "official") => {
  const customerError = form.customerName.trim().length < 2
    ? "联系人姓名至少需要 2 个字，请返回第 1 步修改"
    : !/^1\d{10}$/.test(form.customerPhone.trim())
      ? "请输入正确的 11 位手机号，请返回第 1 步修改"
      : "";
  const itemError = form.items.map(validateRentalItemFields).find(Boolean) || "";
  const contractError = !form.startDate
    ? "请选择起租日期"
    : !Number.isInteger(form.duration) || form.duration < 1
      ? `请输入正确的租赁时间（至少 1 ${billingType === "daily" ? "天" : "个月"}）`
      : form.startDate !== today() && !form.startDateReason
        ? "非当天起租必须选择原因"
        : "";
  const message = customerError || itemError || contractError;
  if (message) {
  setError(message);
  return;
  }

    if (orderType === "official" && step < 3) {
      setError("");
      setForm(normalizedForm);
      setStep(3);
      return;
    }
    if (orderType === "official" && !reviewConfirmed) {
      setError("请确认时间日期、租赁金额及收款选项均已核对无误");
      return;
    }
    setError("");
    setForm(normalizedForm);
    submit(normalizedForm, orderType === "official" && sendNoticeNow, orderType, orderType === "official" ? initialCollection : undefined);
  };
  const steps = ["客户与合同", "设备明细", "租期与费用", "复核与收款"];
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          !e.nativeEvent.isComposing &&
          e.keyCode !== 229 &&
          e.target instanceof HTMLInputElement
        )
          e.preventDefault();
      }}
      className="flex min-h-[34rem] flex-col gap-5"
    >
      <nav
        aria-label="新增租赁步骤"
        className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-2 sm:grid-cols-4"
      >
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => index < step && setStep(index)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${index === step ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <span className="mr-1">{index + 1}.</span>
            {label}
          </button>
        ))}
      </nav>
      {step === 0 && (
        <FormSection
          title="合同与客户"
          description="一份合同可包含多项不同设备配置"
        >
          <div className="grid gap-3 rounded-xl border bg-muted/40 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">订单来源人</p>
              <p className="mt-1 font-medium">{currentActorName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                创建后固定保留，便于业绩追溯
              </p>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium">
              后续维护负责人
              <select
                className="h-10 rounded-lg border bg-background px-3"
                value={form.assigneeUserId || ""}
                onChange={(e) =>
                  setForm({ ...form, assigneeUserId: e.target.value })
                }
              >
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} ·{" "}
                    {person.role === "admin" ? "业务主管" : "客户经理"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="合同编号"
              value={numbersLoading ? "正在生成…" : form.contractNo}
              onChange={() => {}}
              readOnly
              placeholder="按起租日期自动生成"
            />
            <Field
              label="客户公司名称"
              value={form.customerCompany || ""}
              onChange={(v) => setForm({ ...form, customerCompany: v })}
              required={false}
              placeholder="选填，如某某科技有限公司"
            />
            <label className="flex flex-col gap-2 text-sm font-medium"><span>联系人姓名<span className="ml-1 text-destructive" aria-hidden="true">*</span></span><input className="h-10 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" list="rental-contact-history" value={form.customerName} onChange={(event) => { const name = event.target.value; setForm({ ...form, customerName: name }); const matches = historySuggestions.contacts.filter((contact) => contact.name === name.trim()); if (matches.length === 1 && !form.customerPhone) applyContact(name); }} onBlur={(event) => applyContact(event.currentTarget.value)} placeholder="输入或选择历史联系人" /><datalist id="rental-contact-history">{[...new Set(historySuggestions.contacts.map((contact) => contact.name))].map((name) => <option key={name} value={name} />)}</datalist></label>
            <label className="flex flex-col gap-2 text-sm font-medium"><span>联系电话<span className="ml-1 text-destructive" aria-hidden="true">*</span></span><input className="h-10 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" list="rental-phone-history" value={form.customerPhone} inputMode="numeric" onChange={(event) => { setCustomerOffer(null); setForm({ ...form, customerPhone: event.target.value.replace(/\D/g, "").slice(0, 11) }); }} onBlur={checkCustomerOffer} placeholder="输入或选择历史电话" /><datalist id="rental-phone-history">{historySuggestions.contacts.filter((contact) => !form.customerName.trim() || contact.name === form.customerName.trim()).map((contact) => <option key={`${contact.name}-${contact.phone}`} value={contact.phone}>{contact.name}</option>)}</datalist></label>
            <div className="flex flex-col justify-center rounded-lg border bg-muted/40 px-4 py-3" aria-live="polite">{offerLoading ? <p className="text-sm text-muted-foreground">正在查询客户等级…</p> : customerOffer ? <><p className="text-sm font-medium">{customerOffer.name} · {customerOffer.label}客户</p><p className="mt-1 text-xs text-muted-foreground">本单优惠建议：{customerOffer.suggestion}。仅供业务参考，合同金额仍由经办人确认。</p>{customerOffer.note ? <p className="mt-1 text-xs text-muted-foreground">等级备注：{customerOffer.note}</p> : null}</> : <><p className="text-sm font-medium">客户优惠建议</p><p className="mt-1 text-xs text-muted-foreground">输入已登记客户手机号后自动显示等级与建议折扣。</p></>}</div>
            <Field
              label="客户地址"
              value={form.customerAddress || ""}
              onChange={(v) => setForm({ ...form, customerAddress: v })}
              required={false}
              placeholder="选填，设备交付地址"
            />
          </div>
        </FormSection>
      )}
      {step === 1 && (
        <FormSection
          title={`设备明细（${form.items.length} 项）`}
          description={`每项设备可独立设置配置、数量、${billingType === "daily" ? "日租" : "月租"}单价和合同金额`}
        >
          <div className="flex flex-col gap-4">
            {form.items.map((item, index) => (
              <div key={index} className="rounded-xl border bg-muted/30 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">设备明细 {index + 1}</h3>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      aria-label={`删除设备明细 ${index + 1}`}
                      onClick={() =>
                        setForm({
                          ...form,
                          items: form.items.filter((_, i) => i !== index),
                        })
                      }
                      className="rounded-lg border p-2 text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    设备类型
                    <select
                      className="h-10 rounded-lg border bg-background px-3"
                      value={item.deviceType}
                      onChange={(e) =>
                        updateItem(index, "deviceType", e.target.value)
                      }
                    >
                      {["台式机", "笔记本", "显示器", "一体机", "其他"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </label>
                  {item.deviceType !== "台式机" && (
                    <Field
                      label={
                        item.deviceType === "显示器"
                          ? "品牌"
                          : "设备名称 / 型号"
                      }
                      value={item.deviceName}
                      onChange={(v) => updateItem(index, "deviceName", v)}
                    />
                  )}
                  <Field
                    label="设备编号 / 编号范围"
                    value={numbersLoading ? "正在生成…" : item.deviceCode || ""}
                    onChange={() => {}}
                    readOnly
                    placeholder="按类型和数量自动生成"
                  />
                  <Field
                    label="数量"
                    type="number"
                    value={item.quantity}
                    onChange={(v) => updateItem(index, "quantity", Number(v))}
                  />
                  <Field
                    label={`${billingType === "daily" ? "日租" : "月租"}单价（元/台）`}
                    type="number"
                    value={item.monthlyRent}
                    onChange={(v) =>
                      updateItem(index, "monthlyRent", Number(v))
                    }
                  />
                  <div className="flex flex-col gap-2">
                    <Field
                      label="明细租金总额（自动计算）"
                      type="number"
                      value={item.totalRent}
                      onChange={() => {}}
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground">
                      按数量 × 单价 × 租期自动计算：
                      {money(suggestedTotal(item))}
                    </p>
                  </div>
                </div>
                {configTemplates[item.deviceType]?.length && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      常用配置：
                    </span>
                    {configTemplates[item.deviceType].map((template) => (
                      <button
                        key={template.name}
                        type="button"
                        onClick={() => {
                          const items = form.items.map((current, i) =>
                            i === index
                              ? { ...current, ...template.values }
                              : current,
                          );
                          setForm({ ...form, items });
                        }}
                        className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                )}
                {configs[item.deviceType] && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {configs[item.deviceType].map(
                      ([key, label, placeholder]) => (
                        <Field
                          key={key}
                          label={label}
                          value={String(item[key] || "")}
                          placeholder={placeholder}
                          onChange={(v) => updateItem(index, key, v)}
                          suggestions={historySuggestions.configurations[key] || []}
                          listId={`rental-config-${index}-${key}`}
                          required={
                            item.deviceType !== "显示器" || key === "screenSize"
                          }
                        />
                      ),
                    )}
                  </div>
                )}
                <div className="mt-4">
                  <Field
                    label="其他配置"
                    value={item.deviceConfig || ""}
                    onChange={(v) => updateItem(index, "deviceConfig", v)}
                    suggestions={historySuggestions.configurations.deviceConfig || []}
                    listId={`rental-config-${index}-deviceConfig`}
                    required={false}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm({ ...form, items: [...form.items, emptyItem()] })
              }
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed font-medium"
            >
              <Plus className="size-4" />
              添加另一项设备
            </button>
          </div>
        </FormSection>
      )}
      {step === 2 && (
        <>
          <FormSection
            title="租期与费用"
            description="选择计费方式并填写租赁时间，到期日和合同金额将自动计算"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-medium">
                计费方式
                <select
                  className="h-10 rounded-lg border bg-background px-3"
                  value={billingType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      billingType: e.target.value as "monthly" | "daily",
                    })
                  }
                >
                  <option value="monthly">月租</option>
                  <option value="daily">日租</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                {`租赁时间（${billingType === "daily" ? "天" : "个月"}）`}
                <input
                  className="h-10 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={form.duration || ""}
                  placeholder="必填，至少 1"
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duration:
                        e.target.value === ""
                          ? 0
                          : Math.max(0, Math.floor(Number(e.target.value))),
                    })
                  }
                  onBlur={() => {
                    if (form.duration < 1) setForm({ ...form, duration: 1 });
                  }}
                />
              </label>
              <Field
                label="起租日期"
                type="date"
                value={form.startDate}
                onChange={(v) =>
                  setForm({
                    ...form,
                    startDate: v,
                    startDateReason:
                      v === today() ? undefined : form.startDateReason,
                  })
                }
              />
              {form.startDate !== today() && (
                <label className="flex flex-col gap-2 text-sm font-medium">
                  <span>
                    非当天起租原因
                    <span className="ml-1 text-destructive" aria-hidden="true">
                      *
                    </span>
                  </span>
                  <select
                    className="h-10 rounded-lg border bg-background px-3"
                    value={form.startDateReason || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        startDateReason: e.target
                          .value as RentalInput["startDateReason"],
                      })
                    }
                    required
                  >
                    <option value="">请选择原因</option>
                    {START_DATE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Field
                label="到期日期（自动计算）"
                type="date"
                value={calculatedEndDate}
                onChange={() => {}}
                readOnly
              />
              <Field
                label="押金（元）"
                type="number"
                value={form.deposit}
                onChange={(v) => setForm({ ...form, deposit: Number(v) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-4 text-sm sm:grid-cols-4">
              <Info l="设备总数" v={`${totals.qty} 台`} />
              <Info
                l={`${billingType === "daily" ? "日租" : "月租"}单价合计`}
                v={money(totals.monthly)}
              />
              <Info l="租金总额" v={money(totals.total)} />
              <Info
                l="应收总额（含押金）"
                v={money(totals.total + Number(form.deposit || 0))}
              />
            </div>
          </FormSection>
          <label className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <input type="checkbox" checked={sendNoticeNow} onChange={(event) => setSendNoticeNow(event.target.checked)} className="mt-1 size-4 accent-primary" />
            <span><strong className="block text-foreground">合同保存成功后立即发送初始租赁通知</strong><span className="mt-1 block leading-6 text-muted-foreground">已默认勾选，将发送至 {form.customerPhone || "客户手机号"}。如无需通知可取消；短信失败不会影响合同保存，也可在合同详情中稍后补发。</span></span>
          </label>
          <FormSection
            title="业务备注"
            description="填写交付要求、软件环境或其他约定"
          >
            <textarea
              className="min-h-24 rounded-lg border bg-background p-3"
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </FormSection>
        </>
      )}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-warning/40 bg-warning/10 p-4">
            <h3 className="font-semibold">请操作员逐项核对后再创建正式合同</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">正式合同创建后会立即生成应收账单；勾选即时收款后，还会同步生成不可随意删除的收款与资金流水。</p>
          </section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">起租日期</p><p className="mt-2 font-semibold">{form.startDate}</p></div>
            <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">到期日期</p><p className="mt-2 font-semibold">{calculatedEndDate}</p></div>
            <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">租赁金额</p><p className="mt-2 font-semibold">{money(totals.total)}</p></div>
            <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">约定押金</p><p className="mt-2 font-semibold">{money(form.deposit)}</p></div>
          </div>
          <FormSection title="是否现在收款" description="租金与押金分别确认；不勾选的费用将保留为待收账单">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex items-start gap-3 rounded-xl border p-4 ${initialCollection.collectRent ? "border-primary bg-primary/5" : ""}`}><input type="checkbox" checked={initialCollection.collectRent} onChange={(event) => setInitialCollection({ ...initialCollection, collectRent: event.target.checked })} className="mt-1 size-4 accent-primary" /><span><strong className="block">现在收取全部租金</strong><span className="mt-1 block text-sm text-muted-foreground">本次收取 {money(totals.total)}</span></span></label>
              <label className={`flex items-start gap-3 rounded-xl border p-4 ${initialCollection.collectDeposit ? "border-primary bg-primary/5" : ""}`}><input type="checkbox" disabled={Number(form.deposit) <= 0} checked={initialCollection.collectDeposit} onChange={(event) => setInitialCollection({ ...initialCollection, collectDeposit: event.target.checked })} className="mt-1 size-4 accent-primary" /><span><strong className="block">现在收取全部押金</strong><span className="mt-1 block text-sm text-muted-foreground">本次收取 {money(form.deposit)}</span></span></label>
            </div>
            {(initialCollection.collectRent || initialCollection.collectDeposit) && <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="收款日期" type="date" value={initialCollection.paymentDate} onChange={(paymentDate) => setInitialCollection({ ...initialCollection, paymentDate })} /><label className="flex flex-col gap-2 text-sm font-medium">收款方式<select className="h-10 rounded-lg border bg-background px-3" value={initialCollection.paymentMethod} onChange={(event) => setInitialCollection({ ...initialCollection, paymentMethod: event.target.value as InitialCollectionInput["paymentMethod"] })}>{["现金", "微信", "支付宝", "银行卡", "其他"].map((method) => <option key={method}>{method}</option>)}</select></label></div>}
            <div className="mt-4 rounded-xl bg-muted p-4"><p className="text-sm text-muted-foreground">本单即时收款合计</p><p className="mt-1 text-xl font-bold">{money((initialCollection.collectRent ? totals.total : 0) + (initialCollection.collectDeposit ? Number(form.deposit) : 0))}</p></div>
          </FormSection>
          <label className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-1 size-4 accent-primary" /><span><strong className="block">我已确认日期、租期、租赁金额和收款选择正确</strong><span className="mt-1 block leading-6 text-muted-foreground">请根据客户实际付款情况勾选，不要将“准备收款”登记为“已经收款”。</span></span></label>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="sticky bottom-0 -mx-1 mt-auto flex items-center justify-between border-t bg-background/95 px-1 py-4 backdrop-blur">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => {
            setError("");
            setStep((current) => Math.max(0, current - 1));
          }}
          className="h-10 rounded-lg border px-5 font-medium disabled:opacity-40"
        >
          上一步
        </button>
        <span className="text-sm text-muted-foreground">
          第 {step + 1} / 4 步
        </span>
        {step < 2 ? (
          <button type="button" onClick={next} className="h-10 rounded-lg bg-primary px-5 font-medium text-primary-foreground">下一步</button>
        ) : step === 2 ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => confirmSubmit("draft")} className="h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-60">保存草稿</button>
            {allowTest && <button type="button" disabled={pending} onClick={() => confirmSubmit("test")} className="h-10 rounded-lg border border-warning/40 bg-warning/10 px-4 text-sm font-medium text-foreground disabled:opacity-60">创建测试合同</button>}
            <button type="button" onClick={() => confirmSubmit("official")} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">复核并决定收款</button>
          </div>
        ) : (
          <button type="button" disabled={pending || !reviewConfirmed} onClick={() => confirmSubmit("official")} className="h-10 rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50">{pending ? "正在保存" : "确认创建正式合同"}</button>
        )}
      </div>
    </form>
  );
}

type ChangeScenario = "客户资料变更" | "租期调整";

function RentalChangeGuide({ rental, pending, onNavigate, submit }: {
  rental: Rental;
  pending: boolean;
  onNavigate: (target: "return" | "exchange" | "change" | "renew" | "delete-confirm") => void;
  submit: (value: ContractChangeInput) => void;
}) {
  const [scenario, setScenario] = useState<ChangeScenario | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [feeAdjustment, setFeeAdjustment] = useState("0");
  const [feeNote, setFeeNote] = useState("双方协商确认，按实际差额调整");
  const [customerConfirmed, setCustomerConfirmed] = useState(false);
  const [customerName, setCustomerName] = useState(rental.customerName);
  const [customerPhone, setCustomerPhone] = useState(rental.customerPhone);
  const [startDate, setStartDate] = useState(rental.startDate);
  const [endDate, setEndDate] = useState(rental.endDate);
  const routes = [
    { title: "客户少要或全部不要设备", detail: "选择具体设备、数量和退租日期，原合同与收款记录保留。", action: () => onNavigate("return") },
    { title: "客户要更换电脑或配置", detail: "换整台设备走换机；只调整配置和租金走配置变更。", action: () => onNavigate("exchange") },
    { title: "只调整设备配置或租金", detail: "保留配置调整前后快照，并人工确认费用差额。", action: () => onNavigate("change") },
    { title: "客户要续租", detail: "按设备办理续租，记录原到期日、新到期日和续租金额。", action: () => onNavigate("renew") },
  ];
  if (!scenario) return <div className="flex flex-col gap-5">
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="font-semibold">客户现在发生了什么？</p><p className="mt-1 text-sm leading-6 text-muted-foreground">请选择真实情况，系统会保留原合同和历史项目，不要直接覆盖或删除正式业务记录。</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {routes.map((item) => <button key={item.title} type="button" onClick={item.action} className="rounded-xl border p-4 text-left hover:border-primary hover:bg-muted"><strong>{item.title}</strong><span className="mt-2 block text-sm leading-6 text-muted-foreground">{item.detail}</span></button>)}
      <button type="button" onClick={() => setScenario("租期调整")} className="rounded-xl border p-4 text-left hover:border-primary hover:bg-muted"><strong>租期缩短或整体日期更换</strong><span className="mt-2 block text-sm leading-6 text-muted-foreground">修改合同及所有设备的起租、到期日期，并单独登记账务差额。</span></button>
      <button type="button" onClick={() => setScenario("客户资料变更")} className="rounded-xl border p-4 text-left hover:border-primary hover:bg-muted"><strong>姓名或电话号码更换</strong><span className="mt-2 block text-sm leading-6 text-muted-foreground">更新后续联系资料，签约时的合同快照仍然保留。</span></button>
    </div>
    <Link href="/guide" className="text-sm font-medium text-primary underline-offset-4 hover:underline">不确定怎么选？查看完整操作指南</Link>
  </div>;
  const submitChange = (event: FormEvent) => {
    event.preventDefault();
    submit({ rentalId: rental.id, changeType: scenario, effectiveDate, reason, customerName: scenario === "客户资料变更" ? customerName : undefined, customerPhone: scenario === "客户资料变更" ? customerPhone : undefined, startDate: scenario === "租期调整" ? startDate : undefined, endDate: scenario === "租期调整" ? endDate : undefined, feeAdjustment: Number(feeAdjustment), feeNote, customerConfirmed });
  };
  return <form onSubmit={submitChange} className="flex flex-col gap-5">
    <div className="flex items-start justify-between gap-3 rounded-xl bg-muted p-4"><div><p className="font-semibold">{scenario}</p><p className="mt-1 text-sm text-muted-foreground">原合同信息会作为历史快照保留，本次只更新当前有效资料。</p></div><button type="button" onClick={() => setScenario(null)} className="shrink-0 text-sm font-medium text-primary">更换情境</button></div>
    <div className="grid gap-4 sm:grid-cols-2">
      {scenario === "客户资料变更" ? <><Field label="新联系人姓名" value={customerName} onChange={setCustomerName} /><Field label="新联系电话" value={customerPhone} onChange={setCustomerPhone} /></> : <><Field label="新起租日期" type="date" value={startDate} onChange={setStartDate} /><Field label="新到期日期" type="date" value={endDate} onChange={setEndDate} /></>}
      <Field label="生效日期" type="date" value={effectiveDate} onChange={setEffectiveDate} />
      <Field label="费用差额（补收填正数，减免/退款填负数）" type="number" value={feeAdjustment} onChange={setFeeAdjustment} />
    </div>
    <label className="flex flex-col gap-2 text-sm font-medium"><span>变更原因 <span className="text-destructive">*</span></span><textarea required value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24 rounded-lg border bg-background p-3 outline-none focus:ring-2 focus:ring-primary" placeholder="例如：客户临时调整项目人员安排" /></label>
    <label className="flex flex-col gap-2 text-sm font-medium"><span>费用处理说明 <span className="text-destructive">*</span></span><textarea required value={feeNote} onChange={(e) => setFeeNote(e.target.value)} className="min-h-20 rounded-lg border bg-background p-3 outline-none focus:ring-2 focus:ring-primary" /></label>
    <label className="flex items-start gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={customerConfirmed} onChange={(e) => setCustomerConfirmed(e.target.checked)} className="mt-1 size-4 accent-primary" /><span><strong className="block">客户已确认本次变更</strong><span className="mt-1 block text-muted-foreground">未确认也可登记，但变更记录会明确标注“客户未确认”。</span></span></label>
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-6"><strong>提交后：</strong>生成不可删除的变更记录；费用差额进入独立账务流水；原合同签订资料不被覆盖。</div>
    <div className="flex justify-end"><button type="submit" disabled={pending} className="h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{pending ? "正在登记…" : "确认并登记变更"}</button></div>
  </form>;
}

type DetailProps = {
  rental: Rental;
  role: "super_admin" | "admin" | "employee";
  assignees: RentalAssignee[];
  canManageContracts: boolean;
  canViewFinance: boolean;
  onSendNotice: () => void;
  onAssignee: (assigneeId: string) => void;
  onDelete: () => void;
  onConfirmDraft: () => void;
  onRentalChange: () => void;
  onPayment: (target: number | "all" | null) => void;
  onRenew: () => void;
  onCorrectRenewal: (record: Renewal) => void;
  onReverseRenewals: () => void;
  onBuyout: () => void;
  onHistory: () => void;
  onReturn: () => void;
  onLoss: () => void;
  onChange: () => void;
  onRepair: () => void;
  onDeposit: () => void;
  onExchange: () => void;
  onReverse: (paymentId: number) => void;
  onReverseAll: () => void;
  onStatus: (s: string) => void;
};

type DetailTab = "overview" | "finance" | "records" | "manage";

function Detail(props: DetailProps) {
  const {
    rental,
    role,
    assignees,
    canManageContracts,
    canViewFinance,
    onSendNotice,
    onAssignee,
    onDelete,
    onConfirmDraft,
    onRentalChange,
    onPayment,
    onRenew,
    onCorrectRenewal,
    onReverseRenewals,
    onBuyout,
    onHistory,
    onReturn,
    onLoss,
    onChange,
    onRepair,
    onDeposit,
  onExchange,
  onReverse,
  onReverseAll,
  onStatus,
  } = props;
  const [tab, setTab] = useState<DetailTab>("overview");
  const [wizardOpen, setWizardOpen] = useState(false);
  const currentDate = today();
  const currentStatus = rentalDisplayStatus(rental, currentDate);

  const rentBills = rental.bills.filter((bill) => bill.billType !== "押金");
  const positiveRentBills = rentBills.filter((bill) => Number(bill.amount) > 0);
  const netRentCents = rentBills.reduce((sum, bill) => sum + Math.round(Number(bill.amount) * 100), 0);
  const outstandingCents = Math.max(0, netRentCents - Math.round(Number(rental.paidAmount) * 100));
  const outstandingBills = outstandingCents > 0 ? positiveRentBills.filter((bill) => billOutstandingCents(bill) > 0) : [];
  const overdueBills = outstandingBills.filter(
    (bill) => billState(bill.amount, bill.paidAmount, bill.dueDate, currentDate) === "逾期",
  );
  const nextBill = outstandingCents > 0 ? nextOpenBill(positiveRentBills) : null;
  const settledBills = (outstandingCents === 0 ? positiveRentBills : positiveRentBills.filter((bill) => billOutstandingCents(bill) === 0))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  const paidThrough = settledBills[0] ? addCalendarDays(settledBills[0].periodEnd, 1) : null;
  const remainingDevices = rental.items.reduce(
    (sum, item) =>
      sum + Math.max(0, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity),
    0,
  );
  const openRepairs = rental.events.filter(
    (event) => event.eventType === "维修" && !["已完成", "已结束"].includes(event.status),
  );
  const daysToExpiry = Math.ceil(
    (new Date(`${rental.endDate}T00:00:00Z`).getTime() - new Date(`${currentDate}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  const recordCount =
    rental.events.length +
    rental.renewalRecords.length +
    rental.buyoutRecords.length;
  const canBuyout = rental.items.some((i) => i.boughtOutQuantity < i.quantity);
  const isDraft = rental.orderType === "draft";

  const todos: { tone: "danger" | "warn"; text: string }[] = [];
  if (overdueBills.length > 0)
    todos.push({ tone: "danger", text: `${overdueBills.length} 笔逾期未收 · 合计 ${money(centsToMoney(overdueBills.reduce((s, b) => s + billOutstandingCents(b), 0)))}` });
  if (openRepairs.length > 0)
    todos.push({ tone: "warn", text: `${openRepairs.length} 项维修处理中` });
  if (remainingDevices > 0 && daysToExpiry >= 0 && daysToExpiry <= 7 && rental.status !== "已关闭")
    todos.push({ tone: "warn", text: `合同 ${daysToExpiry === 0 ? "今日到期" : `${daysToExpiry} 天后到期`}，可提醒客户续租` });
  if (isDraft) todos.push({ tone: "warn", text: "草稿未转正式，暂不计入经营数据" });

  const tabs: { key: DetailTab; label: string; badge?: string }[] = [
    { key: "overview", label: "概览" },
    { key: "finance", label: "账务", badge: outstandingBills.length ? `${outstandingBills.length} 待收` : undefined },
    { key: "records", label: "业务记录", badge: recordCount ? String(recordCount) : undefined },
    { key: "manage", label: "合同与管理" },
  ];

  const startOperation = (type: RentalOperationType) => {
    setWizardOpen(false);
    if (type === "renewal") onRenew();
    else if (type === "return") onReturn();
    else if (type === "buyout") onBuyout();
    else if (type === "loss") onLoss();
    else if (type === "exchange") onExchange();
    else if (type === "repair") onRepair();
    else if (type === "pricing_change") onChange();
    else onRentalChange();
  };

  if (wizardOpen) {
    return (
      <RentalOperationWizard
        embedded
        contractNo={rental.contractNo}
        customerName={rental.customerName}
        customerPhone={rental.customerPhone}
        endDate={rental.endDate}
        items={rental.items.map((item) => ({
          id: item.id,
          name: `${item.deviceType} · ${item.deviceName}`,
          code: item.deviceCode,
          quantity: item.quantity,
          boughtOutQuantity: item.boughtOutQuantity,
          returnedQuantity: item.returnedQuantity,
          lostQuantity: item.lostQuantity,
          monthlyRent: Number(item.monthlyRent),
        }))}
        onClose={() => setWizardOpen(false)}
        onStart={startOperation}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{rental.customerCompany || rental.customerName}</h3>
              <Status value={currentStatus} />
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {rental.orderType === "draft" ? "草稿" : rental.orderType === "test" ? "测试" : "正式合同"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {rental.contractNo} · {rental.customerName} · {rental.customerPhone}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Info l="剩余在租" v={`${remainingDevices} 台`} />
            <Info l="待收金额" v={money(centsToMoney(outstandingCents))} />
            <Info l="下次付款" v={nextBill?.dueDate ?? "暂无待付"} />
          </div>
        </div>
        {todos.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {todos.map((todo, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  todo.tone === "danger"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-accent text-accent-foreground"
                }`}
              >
                <ClockAlert className="size-4 shrink-0" />
                <span>{todo.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">当前暂无待办事项</p>
        )}
        {isDraft && (
          <button
            type="button"
            onClick={onConfirmDraft}
            className="mt-3 h-10 w-full rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            转为正式合同
          </button>
        )}
      </section>

      <div className="sticky top-0 z-10 -mx-1 mt-4 flex gap-1 overflow-x-auto border-b bg-background px-1 pb-px">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === item.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
            {item.badge && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  tab === item.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4 pb-24">
        {tab === "overview" && (
          <DetailOverview rental={rental} paidThrough={paidThrough} nextBill={nextBill} />
        )}
        {tab === "finance" && (
          <DetailFinance
            rental={rental}
            canViewFinance={canViewFinance}
  onPayment={onPayment}
  onReverse={onReverse}
  onReverseAll={onReverseAll}
  />
        )}
        {tab === "records" && (
          <DetailRecords
            rental={rental}
            role={role}
            onCorrectRenewal={onCorrectRenewal}
            onReverseRenewals={onReverseRenewals}
          />
        )}
        {tab === "manage" && (
          <DetailManage
            rental={rental}
            role={role}
            assignees={assignees}
            canManageContracts={canManageContracts}
            onSendNotice={onSendNotice}
            onAssignee={onAssignee}
            onHistory={onHistory}
            onDeposit={onDeposit}
            onDelete={onDelete}
            onStatus={onStatus}
          />
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={() => onPayment(null)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <WalletCards className="size-4" />
          登记收款
        </button>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary"
        >
          <ClipboardPenLine className="size-4" />
          业务办理中心
        </button>
      </div>
    </div>
  );
}

function ActionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function ActionItem({
  label,
  hint,
  onClick,
  disabled = false,
  disabledHint,
  danger = false,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className={`block text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {disabled && disabledHint ? disabledHint : hint}
      </span>
    </button>
  );
}

function DetailOverview({
  rental,
  paidThrough,
  nextBill,
}: {
  rental: Rental;
  paidThrough: string | null;
  nextBill: Rental["bills"][number] | null;
}) {
  return (
    <>
      <section className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4 text-sm sm:grid-cols-4">
        <Info l="订单来源人" v={rental.sourceName || "历史订单"} />
        <Info l="维护负责人" v={rental.assigneeName || "未分配"} />
        <Info l="租期" v={`${rental.startDate} 至 ${rental.endDate}`} />
        <Info l="设备总数" v={`${rental.quantity} 台`} />
        <Info l="租金总额" v={money(rental.totalRent)} />
        <Info l="已收租金" v={money(rental.paidAmount)} />
        <Info l="约定押金" v={money(rental.deposit)} />
        <Info l="非当天起租原因" v={rental.startDateReason || "—"} />
      </section>
      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
        <Info l="已付覆盖至" v={paidThrough ? `${paidThrough}（不含）` : "尚未结清首期"} />
        <Info l="下次付款日" v={nextBill?.dueDate ?? "暂无待付"} />
        <Info l="下次应付金额" v={nextBill ? money(centsToMoney(billOutstandingCents(nextBill))) : money(0)} />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">设备明细</h3>
        {rental.items.map((item) => {
          const remain = item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity;
          const itemStatus =
            remain > 0
              ? item.boughtOutQuantity > 0 || item.returnedQuantity > 0 || item.lostQuantity > 0
                ? "部分处理"
                : "在租"
              : item.boughtOutQuantity === item.quantity
                ? "已买断"
                : item.returnedQuantity === item.quantity
                  ? "已退租"
                  : item.lostQuantity === item.quantity
                    ? "已丢失"
                    : "已结束";
          return (
            <article key={item.id} className="rounded-xl border p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <div>
                  <p className="font-semibold">{item.deviceType} · {item.deviceName}</p>
                  <p className="text-sm text-muted-foreground">{item.deviceCode || ""}</p>
                </div>
                <Status value={itemStatus} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Info l="原数量" v={`${item.quantity} 台`} />
                <Info l="已买断" v={`${item.boughtOutQuantity} 台`} />
                <Info l="剩余在租" v={`${remain} 台`} />
                <Info l="买断金额" v={money(item.buyoutAmount)} />
                <Info l="月租单价 / 台" v={money(item.monthlyRent)} />
                <Info l="设备租期" v={`${item.startDate || rental.startDate} 至 ${item.endDate || rental.endDate}`} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                {getDeviceConfigRows(item).map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="min-h-5">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </section>
    </>
  );
}

function DetailFinance({
  rental,
  canViewFinance,
  onPayment,
  onReverse,
  onReverseAll,
  }: {
  rental: Rental;
  canViewFinance: boolean;
  onPayment: (target: number | "all" | null) => void;
  onReverse: (paymentId: number) => void;
  onReverseAll: () => void;
  }) {
  const [showReversalHistory, setShowReversalHistory] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const excludedRentTypes = ["押金", "赔偿", "维修费", "买断款", "其他"];
  const rentBills = rental.bills.filter((bill) => Number(bill.amount) > 0 && !excludedRentTypes.includes(bill.billType));
  const adjustmentBills = rental.bills.filter((bill) => Number(bill.amount) < 0 && bill.billType !== "押金");
  const otherBills = rental.bills.filter((bill) => !rentBills.includes(bill) && !adjustmentBills.includes(bill));
  const grossRentCents = rentBills.reduce((sum, bill) => sum + Math.round(Number(bill.amount) * 100), 0);
  const adjustmentCents = adjustmentBills.reduce((sum, bill) => sum + Math.round(Number(bill.amount) * 100), 0);
  const totalReceivable = Math.max(0, grossRentCents + adjustmentCents);
  const totalPaid = Math.round(Number(rental.paidAmount) * 100);
  const totalOutstanding = Math.max(0, totalReceivable - totalPaid);
  const accountBalance = Math.max(0, totalPaid - totalReceivable);
  let settlementCredit = totalPaid + Math.abs(adjustmentCents);
  const effectivePaidByBill = new Map<number, number>();
  for (const bill of [...rentBills].sort((left, right) => left.dueDate.localeCompare(right.dueDate))) {
    const amountCents = Math.round(Number(bill.amount) * 100);
    const settledCents = Math.min(amountCents, settlementCredit);
    effectivePaidByBill.set(bill.id, settledCents);
    settlementCredit -= settledCents;
  }
  const hasOutstanding = totalOutstanding > 0;
  const billingUnit = normalizeBillingUnit(rental.billingType);
  const { ranges: periodRanges, total: totalPeriods } = billPeriodRanges(rentBills, { anchorDate: rental.startDate, unit: billingUnit });
  const periodUnitLabel = billingUnit === "daily" ? "天" : "期";
  const receivedAt = (value: Date | string) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  const reversedPaymentIds = new Set(rental.paymentRecords.flatMap((payment) => {
    const match = payment.notes?.match(/冲正原收款 #(\d+)/);
    return match ? [Number(match[1])] : [];
  }));
  const activePayments = rental.paymentRecords.filter((payment) => Number(payment.amount) > 0 && !reversedPaymentIds.has(payment.id));
  const displayedPayments = showReversalHistory ? rental.paymentRecords : activePayments;
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">租金分期账单</h3>
            <p className="mt-1 text-sm text-muted-foreground">按账期核对约定还款、实际到账和未收金额</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onPayment(null)} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">登记其他金额</button>
            <button type="button" disabled={!hasOutstanding} onClick={() => onPayment("all")} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">收全部待收</button>
          </div>
        </div>
        <div className="grid grid-cols-3 border-b bg-muted/40 text-center">
          <div className="p-3"><p className="text-xs text-muted-foreground">净租金应收</p><p className="mt-1 font-semibold">{money(centsToMoney(totalReceivable))}</p>{adjustmentCents < 0 && <p className="mt-1 text-xs text-muted-foreground">原应收 {money(centsToMoney(grossRentCents))} · 减免 {money(centsToMoney(Math.abs(adjustmentCents)))}</p>}</div>
          <div className="border-x p-3"><p className="text-xs text-muted-foreground">已收租金</p><p className="mt-1 font-semibold text-primary">{money(centsToMoney(totalPaid))}</p>{accountBalance > 0 && <p className="mt-1 text-xs text-primary">账户余额 {money(centsToMoney(accountBalance))}</p>}</div>
          <div className="p-3"><p className="text-xs text-muted-foreground">租金待收</p><p className="mt-1 font-semibold text-destructive">{money(centsToMoney(totalOutstanding))}</p></div>
        </div>
        {rentBills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-3 py-2.5">期数</th><th className="px-3 py-2.5">账期</th><th className="px-3 py-2.5">应收 / 已收</th><th className="px-3 py-2.5">约定还款日</th><th className="px-3 py-2.5">实际到账</th><th className="px-3 py-2.5">状态</th><th className="px-3 py-2.5 text-right">操作</th></tr></thead>
              <tbody className="divide-y">
                {rentBills.map((bill, index) => {
                  const effectivePaidCents = effectivePaidByBill.get(bill.id) ?? 0;
                  const recordedPaidCents = Math.round(Number(bill.paidAmount) * 100);
                  const outstanding = Math.max(0, Math.round(Number(bill.amount) * 100) - effectivePaidCents);
                  const offsetCents = Math.max(0, effectivePaidCents - recordedPaidCents);
                  const cashState = billState(bill.amount, bill.paidAmount, bill.dueDate, today);
                  const state: ReturnType<typeof billState> | "已抵扣" = offsetCents > 0 && recordedPaidCents < Math.round(Number(bill.amount) * 100) ? "已抵扣" : cashState;
                  return <tr key={bill.id} className={cashState === "逾期" && state !== "已抵扣" ? "bg-destructive/5" : "hover:bg-muted/20"}>
                    <td className="px-3 py-3 align-top"><strong>{billPeriodLabel(periodRanges.get(bill.id), billingUnit)}</strong><p className="mt-1 text-xs text-muted-foreground">共 {totalPeriods} {periodUnitLabel} · 第 {index + 1} 笔账单</p></td>
                    <td className="px-3 py-3 align-top"><p>{billCoverageLabel(bill.periodStart, bill.periodEnd)}</p><p className="mt-1 text-xs text-muted-foreground">{bill.billType}</p></td>
                    <td className="px-3 py-3 align-top"><strong>{money(bill.amount)}</strong><p className="mt-1 text-xs text-muted-foreground">到账 {money(bill.paidAmount)}{offsetCents > 0 ? ` · 减免/余额抵扣 ${money(centsToMoney(offsetCents))}` : ""}{outstanding > 0 ? ` · 待收 ${money(centsToMoney(outstanding))}` : ""}</p></td>
                    <td className="px-3 py-3 align-top">{bill.dueDate}</td>
                    <td className="px-3 py-3 align-top">{bill.allocations.length ? bill.allocations.map((allocation) => <div key={allocation.id} className="mb-1 last:mb-0"><p>{allocation.paymentDate} · {money(allocation.amount)}</p><p className="text-xs text-muted-foreground">录入 {receivedAt(allocation.receivedAt)} · {allocation.paymentMethod}</p></div>) : <span className="text-muted-foreground">尚未到账</span>}</td>
                    <td className="px-3 py-3 align-top"><BillingStatus value={state} /></td>
                    <td className="px-3 py-3 text-right align-top">{outstanding > 0 && <button type="button" onClick={() => onPayment(bill.id)} className="rounded-lg border border-primary px-3 py-1.5 font-semibold text-primary hover:bg-primary hover:text-primary-foreground">收本期</button>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="p-6 text-center text-sm text-muted-foreground">暂无租金账单</p>}
      </section>
      {adjustmentBills.length > 0 && <section><h3 className="mb-3 font-semibold">减免与账务调整</h3><div className="flex flex-col gap-2">{adjustmentBills.map((bill) => <div key={bill.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3 text-sm"><div><strong>{bill.billType}</strong><p className="mt-1 text-muted-foreground">{bill.dueDate} · 减少应收 {money(centsToMoney(Math.abs(Math.round(Number(bill.amount) * 100))))}</p>{bill.notes && <p className="mt-1 text-xs text-muted-foreground">{bill.notes}</p>}</div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">已调整</span></div>)}</div></section>}
      {otherBills.length > 0 && <section><h3 className="mb-3 font-semibold">押金与其他费用</h3><div className="flex flex-col gap-2">{otherBills.map((bill) => <div key={bill.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"><div><strong>{bill.billType}</strong><p className="mt-1 text-muted-foreground">应收 {money(bill.amount)} · 已收 {money(bill.paidAmount)} · 约定日 {bill.dueDate}</p></div><BillingStatus value={billState(bill.amount, bill.paidAmount, bill.dueDate, today)} /></div>)}</div></section>}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">收款流水</h3>
            <p className="mt-1 text-xs text-muted-foreground">默认仅显示当前有效收款，冲正历史可单独查看</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowReversalHistory((value) => !value)} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">{showReversalHistory ? "仅看有效收款" : "查看冲正历史"}</button>
            {canViewFinance && activePayments.length > 0 && <button type="button" onClick={() => { if (window.confirm(`确认冲正本单全部 ${activePayments.length} 笔有效收款？冲正后可重新收款。`)) onReverseAll(); }} className="rounded-lg border border-destructive px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10">全部收款冲正</button>}
          </div>
        </div>
        {displayedPayments.length > 0 ? <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-3 py-2.5">付款日期</th><th className="px-3 py-2.5">金额</th><th className="px-3 py-2.5">费用类型</th><th className="px-3 py-2.5">收款方式</th><th className="px-3 py-2.5">备注</th><th className="px-3 py-2.5 text-right">操作</th></tr></thead><tbody className="divide-y">{displayedPayments.map((payment) => <tr key={payment.id}><td className="px-3 py-3">{payment.paymentDate}</td><td className="px-3 py-3 font-semibold">{money(payment.amount)}</td><td className="px-3 py-3">{payment.feeType}</td><td className="px-3 py-3">{payment.paymentMethod}</td><td className="max-w-52 truncate px-3 py-3 text-muted-foreground">{payment.notes || "—"}</td><td className="px-3 py-3 text-right">{canViewFinance && Number(payment.amount) > 0 && !reversedPaymentIds.has(payment.id) && <button type="button" onClick={() => onReverse(payment.id)} className="rounded-lg border px-3 py-1.5 text-destructive">冲正</button>}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{showReversalHistory ? "暂无收款记录" : "暂无有效收款，可点击“查看冲正历史”核对历史流水"}</p>}
      </section>
    </div>
  );
}

function DetailRecords({
  rental,
  role,
  onCorrectRenewal,
  onReverseRenewals,
}: {
  rental: Rental;
  role: "super_admin" | "admin" | "employee";
  onCorrectRenewal: (record: Renewal) => void;
  onReverseRenewals: () => void;
}) {
  const activeRenewals = rental.renewalRecords.filter((record) => record.status !== "已冲正");
  const records = [
    ...rental.renewalRecords.map((record) => {
      const item = rental.items.find((row) => row.id === record.renewedRentalItemId) || rental.items.find((row) => row.id === record.sourceRentalItemId);
      return { key: `renewal-${record.id}`, date: record.renewalDate, type: "续租", title: `${item?.deviceName || "设备明细"} · ${record.quantity} 台 · 续租 ${record.renewalMonths || "—"} 个月`, detail: `${record.billingUnit === "day" ? "日租" : "月租"} ${money(record.unitPrice || record.newMonthlyRent)} · 到期日 ${record.oldEndDate} → ${record.newEndDate} · 应收 ${money(record.renewalAmount)}${record.status === "已冲正" && record.reversalReason ? ` · 冲正原因：${record.reversalReason}` : ""}`, operator: "系统记录", status: record.status === "已冲正" ? "已冲正" : "已完成", renewal: record };
    }),
    ...rental.events.map((event) => ({ key: `event-${event.id}`, date: event.eventDate, type: event.eventType, title: event.eventType === "维修" ? event.faultDescription || "设备维修" : event.reason || "设备与合同变更", detail: event.eventType === "维修" ? `维修成本 ${money(event.repairCost)} · 客户承担 ${money(event.customerCharge)}${event.resolution ? ` · ${event.resolution}` : ""}` : `应收调整 ${money(event.feeAdjustment)}${event.notes ? ` · ${event.notes}` : ""}`, operator: event.operatorName, status: event.status, renewal: null })),
    ...rental.buyoutRecords.map((record) => ({ key: `buyout-${record.id}`, date: record.buyoutDate, type: "买断", title: `${record.quantity} 台设备买断`, detail: `单价 ${money(record.unitPrice)} · 合计 ${money(record.amount)}`, operator: "系统记录", status: "已完成", renewal: null })),
  ].sort((left, right) => right.date.localeCompare(left.date));
  if (!records.length) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">暂无续租、变更、维修或买断记录</p>;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-semibold">业务时间轴</h3><p className="mt-1 text-sm text-muted-foreground">按发生时间统一查看续租、退租、买断、换机、维修和费用调整</p></div>
        {role !== "employee" && activeRenewals.length > 0 && (
          <button type="button" onClick={onReverseRenewals} className="rounded-lg border border-destructive px-3 py-2 text-xs font-semibold text-destructive">全部冲正续租</button>
        )}
      </div>
      <div className="relative flex flex-col gap-3 before:absolute before:bottom-4 before:left-[5px] before:top-4 before:w-px before:bg-border">
        {records.map((record) => <article key={record.key} className="relative pl-6"><span className="absolute left-0 top-5 size-[11px] rounded-full border-2 border-background bg-primary" /><div className="rounded-xl border bg-card p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong>{record.type}</strong><Status value={record.status} /></div><p className="mt-2 font-medium">{record.title}</p></div><time className="text-sm text-muted-foreground">{record.date}</time></div><p className="mt-2 leading-6 text-muted-foreground">{record.detail}</p><p className="mt-2 text-xs text-muted-foreground">经办人：{record.operator || "—"}</p>{record.renewal?.adjustments.length ? <div className="mt-3 rounded-lg bg-muted p-3"><p className="font-medium">价格更正记录</p>{record.renewal.adjustments.map((adjustment) => <p key={adjustment.id} className="mt-1 text-xs leading-5 text-muted-foreground">{money(adjustment.previousUnitPrice)} → {money(adjustment.correctedUnitPrice)} · 差额 {money(adjustment.differenceAmount)} · {adjustment.reason} · {adjustment.operatorName}</p>)}</div> : null}{record.renewal && record.renewal.status !== "已冲正" && role === "admin" && <button type="button" onClick={() => onCorrectRenewal(record.renewal!)} className="mt-3 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary">更正续租价格</button>}</div></article>)}
      </div>
    </section>
  );
}

function DetailManage({
  rental,
  role,
  assignees,
  canManageContracts,
  onSendNotice,
  onAssignee,
  onHistory,
  onDeposit,
  onDelete,
  onStatus,
}: {
  rental: Rental;
  role: "super_admin" | "admin" | "employee";
  assignees: RentalAssignee[];
  canManageContracts: boolean;
  onSendNotice: () => void;
  onAssignee: (assigneeId: string) => void;
  onHistory: () => void;
  onDeposit: () => void;
  onDelete: () => void;
  onStatus: (s: string) => void;
}) {
  return (
    <>
      <section className="grid gap-2 sm:grid-cols-2">
        <Link href={`/contracts/${rental.id}`} className="inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted">
          <FileText className="size-4 text-primary" />
          查看合同
        </Link>
        <button type="button" onClick={onHistory} className="inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted">
          <Search className="size-4 text-primary" />
          客户历史
        </button>
        <button type="button" onClick={onSendNotice} className="inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted">
          <BellRing className="size-4 text-primary" />
          发送初始租赁通知
        </button>
        <button type="button" onClick={onDeposit} className="inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted">
          <WalletCards className="size-4 text-primary" />
          押金处理
        </button>
      </section>
      {!["在租", "买断"].includes(rental.status) && (
        <button type="button" onClick={() => onStatus("在租")} className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary">恢复为在租状态</button>
      )}
      {role !== "employee" && canManageContracts && (
        <section className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <h3 className="font-semibold">业务主管订单管理</h3>
            <p className="text-sm text-muted-foreground">当天录错且没有后续业务记录的正式订单，可验证管理员密码后移入回收站；正式订单仍禁止永久删除。</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 font-medium">维护负责人</span>
            <select className="h-9 rounded-lg border bg-background px-3" value={rental.assigneeUserId || ""} onChange={(event) => onAssignee(event.target.value)}>
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={rental.status === "已关闭"} onClick={() => onStatus("已关闭")} className="rounded-lg border bg-background px-4 py-2 text-sm font-medium disabled:opacity-50">
              {rental.status === "已关闭" ? "订单已关闭" : "关闭订单"}
            </button>
            <button type="button" onClick={onDelete} className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">
              <Trash2 className="size-4" />
              {rental.orderType === "official" ? "删除当天录错订单" : "移入回收站"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function LegacyDetail({
  rental,
  role,
  assignees,
  canManageContracts,
  canViewFinance,
  onSendNotice,
  onAssignee,
  onDelete,
  onConfirmDraft,
  onRentalChange,
  onPayment,
  onRenew,
  onCorrectRenewal,
  onBuyout,
  onHistory,
  onReturn,
  onLoss,
  onChange,
  onRepair,
  onDeposit,
  onExchange,
  onReverse,
  onStatus,
}: {
  rental: Rental;
  role: "super_admin" | "admin" | "employee";
  assignees: RentalAssignee[];
  canManageContracts: boolean;
  canViewFinance: boolean;
  onSendNotice: () => void;
  onAssignee: (assigneeId: string) => void;
  onDelete: () => void;
  onConfirmDraft: () => void;
  onRentalChange: () => void;
  onPayment: (target: number | "all" | null) => void;
  onRenew: () => void;
  onCorrectRenewal: (record: Renewal) => void;
  onBuyout: () => void;
  onHistory: () => void;
  onReturn: () => void;
  onLoss: () => void;
  onChange: () => void;
  onRepair: () => void;
  onDeposit: () => void;
  onExchange: () => void;
  onReverse: (paymentId: number) => void;
  onStatus: (s: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {rental.orderType === "draft" && (
        <section className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ClipboardPenLine className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">这是一份草稿订单</h3>
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">待审核 · 未转正式</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">草稿不计入经营数据、收款和应收账单。核对客户、设备、租期和金额后，再转为正式合同。</p>
            </div>
          </div>
          <button type="button" onClick={onConfirmDraft} className="h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
            转为正式合同
          </button>
        </section>
      )}
      {role !== "employee" && canManageContracts && (
        <section className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">业务主管订单管理</h3>
            <p className="text-sm text-muted-foreground">
              正式合同永久禁止删除；草稿与测试合同只会先移入回收站。
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="shrink-0 font-medium">维护负责人</span>
              <select
                className="h-9 rounded-lg border bg-background px-3"
                value={rental.assigneeUserId || ""}
                onChange={(event) => onAssignee(event.target.value)}
              >
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={rental.status === "已关闭"}
              onClick={() => onStatus("已关闭")}
              className="rounded-lg border bg-background px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {rental.status === "已关闭" ? "订单已关闭" : "关闭订单"}
            </button>
            {rental.orderType !== "official" && <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
            >
              <Trash2 className="size-4" />
              移入回收站
            </button>}
          </div>
        </section>
      )}
      <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4 text-sm sm:grid-cols-4">
        <Info l="订单来源人" v={rental.sourceName || "历史订单"} />
        <Info l="非当天起租原因" v={rental.startDateReason || "—"} />
        <Info l="维护负责人" v={rental.assigneeName || "未分配"} />
        <Info l="客户公司" v={rental.customerCompany || "个人客户"} />
        <Info l="订单类型" v={rental.orderType === "draft" ? "草稿订单（待转正式）" : rental.orderType === "test" ? "测试订单" : "正式合同"} />
        <Info l="联系人" v={rental.customerName} />
        <Info l="联系电话" v={rental.customerPhone} />
        <Info l="租期" v={`${rental.startDate} 至 ${rental.endDate}`} />
        <Info l="状态" v={rental.status} />
        <Info l="设备总数" v={`${rental.quantity} 台`} />
        <Info l="租金总额" v={money(rental.totalRent)} />
        <Info l="已收租金" v={money(rental.paidAmount)} />
        <Info l="约定押金" v={money(rental.deposit)} />
      </div>
      {(() => {
        const rentBills = rental.bills.filter((bill) => bill.billType !== "押金");
        const nextBill = nextOpenBill(rentBills);
        const settledBills = rentBills.filter((bill) => billOutstandingCents(bill) === 0).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
        const paidThrough = settledBills[0] ? addCalendarDays(settledBills[0].periodEnd, 1) : null;
        return (
          <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
            <Info l="已付覆盖至" v={paidThrough ? `${paidThrough}（不含）` : "尚未结清首期"} />
            <Info l="下次付款日" v={nextBill?.dueDate ?? "暂无待付"} />
            <Info l="下次应付金额" v={nextBill ? money(centsToMoney(billOutstandingCents(nextBill))) : money(0)} />
          </section>
        );
      })()}
      <div className="flex flex-col gap-3">
        <h3 className="font-semibold">设备明细</h3>
        {rental.items.map((item) => {
          const remain = item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity;
          const itemStatus =
            remain > 0
              ? item.boughtOutQuantity > 0 || item.returnedQuantity > 0 || item.lostQuantity > 0
                ? "部分处理"
                : "在租"
              : item.boughtOutQuantity === item.quantity
                ? "已买断"
                : item.returnedQuantity === item.quantity
                  ? "已退租"
                  : item.lostQuantity === item.quantity
                    ? "已丢失"
                    : "已结束";
          return (
            <article key={item.id} className="rounded-xl border p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <div>
                  <p className="font-semibold">
                    {item.deviceType} · {item.deviceName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.deviceCode || ""}
                  </p>
                </div>
                <Status value={itemStatus} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Info l="原数量" v={`${item.quantity} 台`} />
                <Info l="已买断" v={`${item.boughtOutQuantity} 台`} />
                <Info l="剩余在租" v={`${remain} 台`} />
                <Info l="买断金额" v={money(item.buyoutAmount)} />
                <Info l="月租单价 / 台" v={money(item.monthlyRent)} />
                <Info
                  l="设备租期"
                  v={`${item.startDate || rental.startDate} 至 ${item.endDate || rental.endDate}`}
                />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                {getDeviceConfigRows(item).map((row) => (
                  <div key={row.label}>
                    <dt className="text-xs text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="min-h-5">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>
      {rental.bills.length > 0 && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">应收账单明细</h3>
                <p className="text-sm text-muted-foreground">起租期一次预收；续租默认按月收取，可按客户要求选择多个月</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onPayment(null)} className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">登记其他金额</button>
                <button type="button" disabled={!rental.bills.some((bill) => bill.billType !== "押金" && billOutstandingCents(bill) > 0)} onClick={() => onPayment("all")} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">收全部</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {rental.bills.map((bill) => {
                const outstanding = billOutstandingCents(bill);
                return <div key={bill.id} className="flex flex-col gap-3 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{bill.billType} · 覆盖 {billCoverageLabel(bill.periodStart, bill.periodEnd)}</p>
                    <p className="mt-1 text-muted-foreground">付款日 {bill.dueDate} · 应收 {money(bill.amount)} · 已收 {money(bill.paidAmount)} · 待收 {money(centsToMoney(outstanding))}</p>
                    {bill.notes && <p className="mt-1 text-xs text-muted-foreground">{bill.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <BillingStatus value={billState(bill.amount, bill.paidAmount, bill.dueDate, new Date().toISOString().slice(0, 10))} />
                    {bill.billType !== "押金" && outstanding > 0 && <button type="button" onClick={() => onPayment(bill.id)} className="rounded-lg border border-primary px-3 py-2 font-semibold text-primary hover:bg-primary hover:text-primary-foreground">收本期</button>}
                  </div>
                </div>;
              })}
            </div>
          </section>
      )}
      {rental.paymentRecords.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold">收款与冲正</h3>
          <div className="flex flex-col gap-2">
            {rental.paymentRecords.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span>
                  {payment.paymentDate} · {payment.feeType} ·{" "}
                  {money(payment.amount)}
                </span>
                {Number(payment.amount) > 0 && (
                  <button
                    type="button"
                    onClick={() => onReverse(payment.id)}
                    className="rounded-lg border px-3 py-1.5 text-destructive"
                  >
                    冲正
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {rental.events.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold">变更与维修记录</h3>
          <div className="flex flex-col gap-2">
            {rental.events.map((event) => (
              <article key={event.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    {event.eventType} · {event.eventDate}
                  </strong>
                  <Status value={event.status} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  {event.eventType === "维修"
                    ? `${event.faultDescription || "维修记录"} · 客户承担 ${money(event.customerCharge)}`
                    : `${event.reason || "配置调整"} · 应收调整 ${money(event.feeAdjustment)}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  经办人：{event.operatorName}
                  {event.notes ? ` · ${event.notes}` : ""}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
      {rental.renewalRecords.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">续租记录</h3>
          <div className="flex flex-col gap-2">
            {rental.renewalRecords.map((record) => {
              const item =
                rental.items.find((i) => i.id === record.renewedRentalItemId) ||
                rental.items.find((i) => i.id === record.sourceRentalItemId);
              return (
                <div key={record.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-col justify-between gap-1 sm:flex-row">
                    <strong>
                      {item?.deviceName || "设备明细"} · {record.quantity} 台 ·
                      续租 {record.renewalMonths || "—"} 个月
                    </strong>
                    <span>{record.renewalDate}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {record.billingUnit === "day" ? "日租" : "月租"} {money(record.unitPrice || record.newMonthlyRent)} · 到期 {record.oldEndDate} → {record.newEndDate} · 原续租金额 {money(record.renewalAmount)}
                  </p>
                  {record.adjustments.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-muted p-3">
                      <p className="font-medium">当前有效单价 {money(record.adjustments[0].correctedUnitPrice)} · 累计差额 {money(record.adjustments.reduce((sum, item) => sum + Number(item.differenceAmount), 0))}</p>
                      {record.adjustments.map((item) => (
                        <p key={item.id} className="text-xs leading-5 text-muted-foreground">
                          {money(item.previousUnitPrice)} → {money(item.correctedUnitPrice)}，差额 {money(item.differenceAmount)} · {item.reason} · {item.operatorName}
                        </p>
                      ))}
                    </div>
                  )}
                  {role === "admin" && (
                    <button type="button" onClick={() => onCorrectRenewal(record)} className="mt-3 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary">
                      更正价格
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {rental.buyoutRecords.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">买断记录</h3>
          <div className="flex flex-col gap-2">
            {rental.buyoutRecords.map((record) => (
              <div
                key={record.id}
                className="flex justify-between rounded-lg border p-3 text-sm"
              >
                <span>
                  {record.buyoutDate} · {record.quantity} 台 ×{" "}
                  {money(record.unitPrice)}
                </span>
                <strong>{money(record.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
  <div className="flex flex-wrap gap-2">
  <button type="button" onClick={onRentalChange} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ClipboardPenLine className="size-4" />办理租赁变更</button>
  <button type="button" onClick={onSendNotice} className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary"><BellRing className="size-4" />发送初始租赁通知</button>
  <button
  onClick={onHistory}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          客户历史
        </button>
        <button
          onClick={onReturn}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          办理退租
        </button>
        <button
          onClick={onLoss}
          className="rounded-lg border px-4 py-2 text-sm font-medium text-destructive"
        >
          登记丢失
        </button>
        <Link
          href={`/contracts/${rental.id}`}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
        >
          <FileText className="size-4" />
          查看合同
        </Link>
        <button
          onClick={onDeposit}
          className="rounded-lg border px-3 py-2 text-sm font-medium"
        >
          押金处理
        </button>
        <button
          onClick={onExchange}
          className="rounded-lg border px-3 py-2 text-sm font-medium"
        >
          设备换机
        </button>
        <button
          onClick={onChange}
          className="rounded-lg border px-3 py-2 text-sm font-medium"
        >
          配置/租金变更
        </button>
        <button
          onClick={onRepair}
          className="rounded-lg border px-3 py-2 text-sm font-medium"
        >
          登记维修
        </button>
        <button
          onClick={() => onPayment(null)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          登记收款
        </button>
        <button
          onClick={onRenew}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          办理续租
        </button>
        {rental.items.some((i) => i.boughtOutQuantity < i.quantity) && (
          <button
            onClick={onBuyout}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            办理部分买断
          </button>
        )}
        <button
          onClick={() => onStatus("丢失")}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          标记丢失
        </button>
        {!["在租", "买断"].includes(rental.status) && (
          <button
            onClick={() => onStatus("在租")}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            恢复在租
          </button>
        )}
      </div>
    </div>
  );
}
function addMonths(date: string, months = 1) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
function addDays(date: string, days = 1) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function RenewalCorrectionForm({ record, pending, submit }: { record: Renewal; pending: boolean; submit: (correctedUnitPrice: number, reason: string) => void }) {
  const currentUnitPrice = Number(record.adjustments[0]?.correctedUnitPrice ?? record.unitPrice ?? record.newMonthlyRent);
  const currentAmount = Number(record.adjustments[0]?.correctedAmount ?? record.renewalAmount);
  const [correctedUnitPrice, setCorrectedUnitPrice] = useState(String(currentUnitPrice));
  const [reason, setReason] = useState("");
  const duration = record.duration ?? record.renewalMonths ?? 1;
  const correctedAmount = record.quantity * duration * Number(correctedUnitPrice || 0);
  const difference = correctedAmount - currentAmount;
  return (
    <form onSubmit={(event) => { event.preventDefault(); submit(Number(correctedUnitPrice), reason); }} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-4 text-sm">
        <Info l="续租数量" v={`${record.quantity} 台`} />
        <Info l="续租周期" v={`${duration} ${record.billingUnit === "day" ? "天" : "个月"}`} />
        <Info l="当前有效单价" v={money(currentUnitPrice)} />
        <Info l="当前有效金额" v={money(currentAmount)} />
      </div>
      <Field label={`正确${record.billingUnit === "day" ? "日" : "月"}租单价`} type="number" value={correctedUnitPrice} onChange={setCorrectedUnitPrice} />
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-6">
        更正后金额 <strong>{money(correctedAmount)}</strong>，{difference > 0 ? "将新增待收补差账单" : difference < 0 ? "将生成续租减免调整" : "价格没有变化"} <strong>{money(Math.abs(difference))}</strong>。原续租和收款记录不会被覆盖。
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium"><span>更正原因 <span className="text-destructive">*</span></span><textarea required minLength={2} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 rounded-lg border bg-background p-3 outline-none focus:ring-2 focus:ring-primary" placeholder="例如：录入时误将月租填写为设备总价" /></label>
      <div className="flex justify-end"><button type="submit" disabled={pending || !Number(correctedUnitPrice) || difference === 0 || reason.trim().length < 2} className="h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{pending ? "正在更正…" : "确认差额更正"}</button></div>
    </form>
  );
}

function SettlementFields({ label, value, onChange }: { label: string; value: SettlementInput; onChange: (value: SettlementInput) => void }) {
  return <fieldset className="rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">{label}</legend><div className="grid gap-4 sm:grid-cols-3"><label className="flex flex-col gap-2 text-sm font-medium">结算时间<select className="h-10 rounded-lg border bg-background px-3" value={value.timing} onChange={(event) => onChange({ ...value, timing: event.target.value as SettlementInput["timing"] })}><option value="now">现在结算</option><option value="later">以后结算</option></select></label><Field label={value.timing === "now" ? "结算日期" : "约定日期"} type="date" value={value.date} onChange={(date) => onChange({ ...value, date })} /><label className="flex flex-col gap-2 text-sm font-medium">结算方式<select className="h-10 rounded-lg border bg-background px-3" value={value.method} onChange={(event) => onChange({ ...value, method: event.target.value as SettlementInput["method"] })}>{["现金", "微信", "支付宝", "银行卡", "其他"].map((method) => <option key={method}>{method}</option>)}</select></label></div><p className="mt-3 text-xs text-muted-foreground">{value.timing === "now" ? "保存后立即登记已结算金额。" : "保存后登记为待处理，后续再登记收付款。"}</p></fieldset>;
}

function RenewalForm({
  rental,
  submit,
  pending,
}: {
  rental: Rental;
  submit: (values: RenewalInput[], settlement: SettlementInput) => void;
  pending: boolean;
}) {
  const available = rental.items.filter(
    (item) => item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity > 0,
  );
  const [rows, setRows] = useState<Record<number, RenewalInput>>({});
  const [settlement, setSettlement] = useState<SettlementInput>({ timing: "now", date: today(), method: "微信" });
  const toggle = (item: Item) =>
    setRows((current) => {
      const next = { ...current };
      if (next[item.id]) delete next[item.id];
      else {
        const end = item.endDate || rental.endDate;
        next[item.id] = {
          rentalItemId: item.id,
          quantity: item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity,
          billingUnit: "month",
          duration: 1,
          unitPrice: Number(item.monthlyRent),
          newEndDate: addMonths(end, 1),
          notes: "",
        };
      }
      return next;
    });
  const update = (
    id: number,
    key: keyof RenewalInput,
    value: string | number,
  ) =>
    setRows((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  const selected = Object.values(rows);
  const allSelected = available.length > 0 && selected.length === available.length;
  const toggleAll = () => setRows(allSelected ? {} : Object.fromEntries(available.map((item) => {
    const end = item.endDate || rental.endDate;
    return [item.id, { rentalItemId: item.id, quantity: item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity, billingUnit: "month" as const, duration: 1, unitPrice: Number(item.monthlyRent), newEndDate: addMonths(end, 1), notes: "" }];
  })));
  const totalQty = selected.reduce((sum, row) => sum + row.quantity, 0);
  const renewalTotal = selected.reduce(
    (sum, row) => sum + row.quantity * row.unitPrice * row.duration,
    0,
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(selected, settlement);
      }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
        续租默认按月收、默认 1 个月。到期当天支付下一期租金；客户要求多续几个月时，再修改续租月数并一次收取对应月数。部分数量续租时系统会自动拆分。
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
    <span className="text-sm text-muted-foreground">已选 {selected.length}/{available.length} 项，共 {totalQty} 台</span>
    <button type="button" onClick={toggleAll} disabled={!available.length} className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">{allSelected ? "取消全选" : "全选全部设备"}</button>
  </div>
  <div className="flex flex-col gap-3">
  {available.map((item) => {
          const row = rows[item.id];
          const max = item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity;
          return (
            <article
              key={item.id}
              className={`rounded-xl border p-4 ${row ? "border-primary bg-primary/5" : ""}`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  className="mt-1 size-4"
                  type="checkbox"
                  checked={Boolean(row)}
                  onChange={() => toggle(item)}
                />
                <span>
                  <strong>{item.deviceName}</strong>
                  <span className="block text-sm text-muted-foreground">
                    {item.deviceType} · 可续租 {max} 台 · 当前月租{" "}
                    {money(item.monthlyRent)} · 到期{" "}
                    {item.endDate || rental.endDate}
                  </span>
                </span>
              </label>
              {row && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Field
                    label="续租数量"
                    type="number"
                    value={row.quantity}
                    onChange={(v) => update(item.id, "quantity", Number(v))}
                  />
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    计费方式
                    <select
                      className="h-10 rounded-lg border bg-background px-3"
                      value={row.billingUnit}
                      onChange={(e) => {
                        const unit = e.target.value as "month" | "day";
                        setRows((current) => ({
                          ...current,
                          [item.id]: {
                            ...current[item.id],
                            billingUnit: unit,
                            duration: 1,
                            unitPrice:
                              unit === "month"
                                ? Number(item.monthlyRent)
                                : Math.round(
                                    (Number(item.monthlyRent) / 30) * 100,
                                  ) / 100,
                            newEndDate:
                              unit === "month"
                                ? addMonths(item.endDate || rental.endDate, 1)
                                : addDays(item.endDate || rental.endDate, 1),
                          },
                        }));
                      }}
                    >
                      <option value="month">按月</option>
                      <option value="day">按天</option>
                    </select>
                  </label>
                  <Field
                    label={`续租${row.billingUnit === "month" ? "月数" : "天数"}`}
                    type="number"
                    value={row.duration}
                    onChange={(v) => {
                      const duration = Math.max(1, Math.floor(Number(v)));
                      setRows((current) => ({
                        ...current,
                        [item.id]: {
                          ...current[item.id],
                          duration,
                          newEndDate:
                            row.billingUnit === "month"
                              ? addMonths(
                                  item.endDate || rental.endDate,
                                  duration,
                                )
                              : addDays(
                                  item.endDate || rental.endDate,
                                  duration,
                                ),
                        },
                      }));
                    }}
                  />
                  <Field
                    label={`每${row.billingUnit === "month" ? "月" : "天"}单价（元）`}
                    type="number"
                    value={row.unitPrice}
                    onChange={(v) => update(item.id, "unitPrice", Number(v))}
                  />
                  <div className="rounded-lg border bg-muted/50 px-3 py-2">
                    <p className="text-sm font-medium">本次付款与覆盖</p>
                    <p className="mt-1 font-semibold">{money(row.quantity * row.unitPrice * row.duration)}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      付款日 {addDays(item.endDate || rental.endDate, 1)}<br />
                      覆盖 {addDays(item.endDate || rental.endDate, 1)} 至 {addDays(row.newEndDate, 1)}（不含）
                    </p>
                  </div>
                </div>
              )}
              {row && row.quantity > max && (
                <p className="mt-2 text-sm text-destructive">
                  续租数量不能超过 {max} 台
                </p>
              )}
            </article>
          );
        })}
      </div>
      {available.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          当前没有可续租设备
        </p>
      )}
      <SettlementFields label="续租费收款" value={settlement} onChange={setSettlement} />
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-4">
        <Info l="本次续租" v={`${totalQty} 台`} />
        <Info l="续租金额" v={money(renewalTotal)} />
      </div>
      <button
        disabled={
          pending ||
          selected.length === 0 ||
          selected.some((row) => {
            const item = available.find((i) => i.id === row.rentalItemId);
            return (
              !item ||
              row.quantity <= 0 ||
              row.quantity > item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity ||
              row.duration < 1 ||
              row.duration > 3650 ||
              row.unitPrice < 0 ||
              row.newEndDate <= (item.endDate || rental.endDate)
            );
          })
        }
        className="h-10 self-end rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "处理中" : "确认续租"}
      </button>
    </form>
  );
}
function PaymentForm({ submit, pending, bills, target }: { submit: (value: PaymentInput) => void; pending: boolean; bills: Bill[]; target: number | "all" | null }) {
  const eligibleBills = bills.filter((bill) => bill.billType !== "押金");
  const targetBill = typeof target === "number" ? eligibleBills.find((bill) => bill.id === target) : undefined;
  const defaultAmountCents = targetBill ? billOutstandingCents(targetBill) : target === "all" ? eligibleBills.reduce((sum, bill) => sum + billOutstandingCents(bill), 0) : 0;
  const [value, setValue] = useState<PaymentInput>({ amount: Number(centsToMoney(defaultAmountCents)), discountAmount: 0, paymentDate: today(), paymentMethod: "微信", feeType: "原合同租金", billId: targetBill?.id, notes: "" });
  const settlementAmount = value.amount + value.discountAmount;
  let preview: ReturnType<typeof allocatePayment> = [];
  let previewError = "";
  if (settlementAmount > 0 && value.feeType !== "押金") {
    try { preview = allocatePayment(eligibleBills, settlementAmount, value.billId); } catch (error) { previewError = error instanceof Error ? error.message : "金额无法分配"; }
  }
  const billMap = new Map(bills.map((bill) => [bill.id, bill]));
  return <form onSubmit={(e) => { e.preventDefault(); submit(value); }} className="flex flex-col gap-4">
    {targetBill && <div className="rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="font-semibold">收取本期账单</p><p className="mt-1 text-sm text-muted-foreground">{targetBill.periodStart} 至 {targetBill.periodEnd} · 待收 {money(centsToMoney(billOutstandingCents(targetBill)))}</p></div>}
    {target === "all" && <div className="rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="font-semibold">收取全部待收账单</p><p className="mt-1 text-sm text-muted-foreground">将按到期日从早到晚结清 {preview.length || eligibleBills.filter((bill) => billOutstandingCents(bill) > 0).length} 笔账单</p></div>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="实际收款（元）" type="number" value={value.amount} onChange={(amount) => setValue({ ...value, amount: Number(amount) })} />
      <Field label="优惠金额（元）" type="number" value={value.discountAmount} onChange={(discountAmount) => setValue({ ...value, discountAmount: Math.max(0, Number(discountAmount)) })} />
      <Field label="收款日期" type="date" value={value.paymentDate} onChange={(paymentDate) => setValue({ ...value, paymentDate })} />
      <label className="flex flex-col gap-2 text-sm font-medium">支付方式<select className="h-10 rounded-lg border bg-background px-3" value={value.paymentMethod} onChange={(e) => setValue({ ...value, paymentMethod: e.target.value as PaymentInput["paymentMethod"] })}>{["现金", "微信", "支付宝", "银行卡", "其他"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm font-medium">费用类型<select disabled={target !== null} className="h-10 rounded-lg border bg-background px-3 disabled:opacity-60" value={value.feeType} onChange={(e) => setValue({ ...value, feeType: e.target.value as PaymentInput["feeType"] })}>{["原合同租金", "续租费", "押金", "买断费", "其他"].map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    {value.feeType !== "押金" && settlementAmount > 0 && <section className="rounded-xl bg-muted p-4"><div className="grid grid-cols-3 gap-3 border-b pb-4"><Info l="实际到账" v={money(value.amount)} /><Info l="优惠减免" v={money(value.discountAmount)} /><Info l="合计核销" v={money(settlementAmount)} /></div><h3 className="mt-4 font-semibold">本次分配预览</h3>{previewError ? <p className="mt-2 text-sm text-destructive">{previewError}</p> : <div className="mt-3 flex flex-col gap-2">{preview.map((allocation) => { const bill = billMap.get(allocation.billId)!; return <div key={allocation.billId} className="flex justify-between gap-3 text-sm"><span>{bill.periodStart} 至 {bill.periodEnd}</span><span className="text-right">核销 {money(centsToMoney(allocation.amountCents))}<span className="block text-xs text-muted-foreground">核销后待收 {money(centsToMoney(allocation.balanceAfterCents))}</span></span></div>; })}</div>}</section>}
    {value.feeType === "押金" && value.discountAmount > 0 && <p className="text-sm text-destructive">押金收取不能使用优惠，请将优惠金额改为 0。</p>}
    <label className="flex flex-col gap-2 text-sm font-medium">{value.discountAmount > 0 ? "备注 / 优惠原因（必填）" : "备注"}<textarea required={value.discountAmount > 0} minLength={value.discountAmount > 0 ? 2 : undefined} className="min-h-20 rounded-lg border bg-background p-3" value={value.notes || ""} onChange={(e) => setValue({ ...value, notes: e.target.value })} placeholder={value.discountAmount > 0 ? "例如：抹零优惠、老客户优惠" : undefined} /></label>
    <button disabled={pending || value.amount <= 0 || Boolean(previewError) || (value.discountAmount > 0 && ((value.notes?.trim().length ?? 0) < 2 || value.feeType === "押金"))} className="h-10 self-end rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50">{pending ? "处理中" : "确认收款"}</button>
  </form>;
}
function CustomerHistory({ phone }: { phone: string }) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getCustomerHistory>
  > | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getCustomerHistory(phone)
      .then(setData)
      .catch((e) => setError(userErrorMessage(e, "查询失败，请稍后重试")));
  }, [phone]);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        正在查询客户历史…
      </p>
    );
  const contractMap = new Map(data.contracts.map((c) => [c.id, c.contractNo]));
  const total = data.contracts.reduce((sum, c) => sum + Number(c.totalRent), 0);
  const paid = data.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-4 sm:grid-cols-4">
        <Info l="手机号" v={phone} />
        <Info l="历史合同" v={`${data.contracts.length} 份`} />
        <Info l="累计合同额" v={money(total)} />
        <Info l="累计收款" v={money(paid)} />
      </div>
      <section>
        <h3 className="mb-3 font-semibold">合同记录</h3>
        <div className="flex flex-col gap-2">
          {data.contracts.map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between gap-2 rounded-lg border p-3 text-sm sm:flex-row"
            >
              <span>
                <strong>{c.contractNo}</strong> · {c.customerName}
              </span>
              <span>
                {c.startDate} 至 {c.endDate} · {money(c.totalRent)} · {c.status}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">续租记录</h3>
        <div className="flex flex-col gap-2">
          {data.renewals.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <strong>
                {contractMap.get(r.rentalId)} · {r.quantity} 台 · 按
                {r.billingUnit === "day" ? "天" : "月"}续租{" "}
                {r.duration || r.renewalMonths || 1}{" "}
                {r.billingUnit === "day" ? "天" : "个月"}
              </strong>
              <p className="mt-1 text-muted-foreground">
                单价 {money(r.unitPrice || r.newMonthlyRent)} · 金额{" "}
                {money(r.renewalAmount)} · 到期 {r.newEndDate}
              </p>
            </div>
          ))}
          {!data.renewals.length && (
            <p className="text-sm text-muted-foreground">暂无续租记录</p>
          )}
        </div>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">退租、丢失与设备变更</h3>
        <div className="flex flex-col gap-2">
          {[
            ...data.returns.map((item) => ({
              id: `return-${item.id}`,
              date: item.returnDate,
              title: "设备退租",
              detail: `${item.quantity} 台 · ${item.condition} · 押金退还 ${money(item.depositRefund)}`,
              rentalId: item.rentalId,
            })),
            ...data.losses.map((item) => ({
              id: `loss-${item.id}`,
              date: item.lossDate,
              title: "设备丢失",
              detail: `${item.quantity} 台 · 赔偿 ${money(item.amount)}`,
              rentalId: item.rentalId,
            })),
            ...data.events.map((item) => ({
              id: `event-${item.id}`,
              date: item.eventDate,
              title: item.eventType,
              detail: `${item.status}${item.reason ? ` · ${item.reason}` : ""}`,
              rentalId: item.rentalId,
            })),
          ]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <strong>
                  {item.date} · {item.title}
                </strong>
                <p className="mt-1 text-muted-foreground">
                  {contractMap.get(item.rentalId)} · {item.detail}
                </p>
              </div>
            ))}
          {!data.returns.length &&
            !data.losses.length &&
            !data.events.length && (
              <p className="text-sm text-muted-foreground">
                暂无退租、丢失或设备变更记录
              </p>
            )}
        </div>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">付款记录</h3>
        <div className="flex flex-col gap-2">
          {data.payments.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between gap-1 rounded-lg border p-3 text-sm sm:flex-row"
            >
              <span>
                <strong>{money(p.amount)}</strong> · {p.feeType} ·{" "}
                {p.paymentMethod}
              </span>
              <span>
                {contractMap.get(p.rentalId)} · {p.paymentDate}
                {p.notes ? ` · ${p.notes}` : ""}
              </span>
            </div>
          ))}
          {!data.payments.length && (
            <p className="text-sm text-muted-foreground">暂无付款记录</p>
          )}
        </div>
      </section>
    </div>
  );
}
function OperationForm({
  rental,
  mode,
  submit,
  pending,
}: {
  rental: Rental;
  mode: "return" | "loss";
  submit: (values: Array<ReturnInput | LossInput>) => void;
  pending: boolean;
}) {
  const available = rental.items.filter(
    (i) =>
      i.quantity - i.boughtOutQuantity - i.returnedQuantity - i.lostQuantity >
      0,
  );
  const [rows, setRows] = useState<Record<number, number>>({});
  const selectedRows = Object.entries(rows).map(([itemId, quantity]) => ({ itemId: Number(itemId), quantity }));
  const allSelected = available.length > 0 && selectedRows.length === available.length;
  const toggleItem = (item: Item) => setRows((current) => {
    const next = { ...current };
    if (next[item.id]) delete next[item.id];
    else next[item.id] = item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity;
    return next;
  });
  const toggleAll = () => setRows(allSelected ? {} : Object.fromEntries(available.map((item) => [item.id, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity])));
  const [date, setDate] = useState(today());
  const [condition, setCondition] = useState<"完好" | "轻微磨损" | "损坏">("完好");
  const [amount, setAmount] = useState(0);
  const [refund, setRefund] = useState(0);
  const [billingModes, setBillingModes] = useState<Record<number, "full_month" | "daily" | "waive">>({});
  const [billingReasons, setBillingReasons] = useState<Record<number, string>>({});
  const [collectionSettlement, setCollectionSettlement] = useState<SettlementInput>({ timing: "now", date: today(), method: "微信" });
  const [refundSettlement, setRefundSettlement] = useState<SettlementInput>({ timing: "now", date: today(), method: "微信" });
  const [rentRefundSettlement, setRentRefundSettlement] = useState<SettlementInput>({ timing: "now", date: today(), method: "微信" });
  const [notes, setNotes] = useState("");
  const [settlementConfirmed, setSettlementConfirmed] = useState(false);
  const billingTrialByItem = new Map(selectedRows.map((row) => {
    const item = available.find((candidate) => candidate.id === row.itemId);
    const currentBill = rental.bills
      .filter((bill) => bill.billType !== "押金" && Number(bill.amount) > 0 && bill.periodStart <= date && date < bill.periodEnd)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0];
    const periodStart = currentBill?.periodStart ?? rental.startDate;
    const periodEnd = currentBill?.periodEnd ?? addMonths(periodStart, 1);
    const inCurrentPeriod = rental.billingType === "monthly" && periodStart <= date && date < periodEnd;
    const fullAmount = inCurrentPeriod && item ? Math.round(Number(item.monthlyRent) * row.quantity * 100) / 100 : 0;
    const priorRent = Math.max(0, Number(rental.totalRent) - fullAmount);
    const collectedAmount = Math.max(0, Math.min(fullAmount, Number(rental.paidAmount) - priorRent));
    const mode = billingModes[row.itemId] ?? "full_month";
    const settlement = calculateReturnRent({ periodStart, periodEnd, returnDate: date, fullAmount, collectedAmount, mode });
    return [row.itemId, { periodStart, periodEnd, fullAmount, collectedAmount, ...settlement }] as const;
  }));
  const rentRefundTotal = [...billingTrialByItem.values()].reduce((sum, trial) => sum + trial.refundAmount, 0);
  const rentCollectTotal = [...billingTrialByItem.values()].reduce((sum, trial) => sum + trial.collectAmount, 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(selectedRows.map((row, index) => {
          const billingMode = billingModes[row.itemId] ?? "full_month";
          const base = {
            rentalId: rental.id,
            rentalItemId: row.itemId,
            quantity: row.quantity,
            date,
            notes,
          };
          return mode === "return"
            ? {
                ...base,
                condition,
                deductionAmount: amount,
                depositRefund: refund / selectedRows.length,
                billingMode,
                billingReason: billingReasons[row.itemId] ?? "",
                collectionSettlement: { timing: collectionSettlement.timing, method: collectionSettlement.method },
                refundSettlement: { timing: refundSettlement.timing, method: refundSettlement.method },
                rentRefundSettlement: { timing: rentRefundSettlement.timing, method: rentRefundSettlement.method },
              }
            : { ...base, unitCompensation: amount };
        }));
      }}
      className="flex flex-col gap-4"
    >
      <section className="flex flex-col gap-3" aria-label="选择设备">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <span className="text-sm text-muted-foreground">已选 {selectedRows.length}/{available.length} 项，共 {selectedRows.reduce((sum, row) => sum + row.quantity, 0)} 台</span>
          <button type="button" onClick={toggleAll} disabled={!available.length} className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">{allSelected ? "取消全选" : "全选全部设备"}</button>
        </div>
        {available.map((item) => {
          const max = item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity;
          const selected = rows[item.id] !== undefined;
          return <article key={item.id} className={`rounded-xl border p-4 ${selected ? "border-primary bg-primary/5" : ""}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={selected} onChange={() => toggleItem(item)} className="mt-1 size-4 accent-primary" />
              <span className="min-w-0 flex-1"><strong>{item.deviceType} · {item.deviceName}</strong><span className="block text-xs text-muted-foreground">{item.deviceCode || "未编号"} · 可处理 {max} 台</span></span>
            </label>
            {selected && <div className="mt-3 flex flex-col gap-3"><label className="flex items-center gap-3 text-sm font-medium">本次数量<input type="number" min={1} max={max} value={rows[item.id]} onChange={(event) => setRows((current) => ({ ...current, [item.id]: Number(event.target.value) }))} className="h-10 w-24 rounded-lg border bg-background px-3" /><span className="text-muted-foreground">最多 {max} 台</span></label>{mode === "return" && (() => { const trial = billingTrialByItem.get(item.id); const billingMode = billingModes[item.id] ?? "full_month"; return <div className="rounded-lg border bg-background p-3"><fieldset className="flex flex-col gap-2"><legend className="text-sm font-semibold">本期租金怎么处理？</legend><div className="grid gap-2 sm:grid-cols-3">{([{ value: "full_month", title: "整期收取", detail: trial && trial.collectedAmount < trial.fullAmount ? "未收部分保留欠款" : "本期不退租金" }, { value: "daily", title: "退剩余天数", detail: trial && trial.collectedAmount < trial.fullAmount ? "仅收已用天数" : "固定按 30 天折算" }, { value: "waive", title: "退本期全额", detail: trial && trial.collectedAmount < trial.fullAmount ? "未收部分全部免收" : "最多退本期实收" }] as const).map((option) => <label key={option.value} className={`cursor-pointer rounded-lg border p-3 ${billingMode === option.value ? "border-primary bg-primary/5" : "bg-card"}`}><input type="radio" name={`billing-${item.id}`} value={option.value} checked={billingMode === option.value} onChange={() => { setBillingModes((current) => ({ ...current, [item.id]: option.value })); setSettlementConfirmed(false); }} className="mr-2 accent-primary"/><strong className="text-sm">{option.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span></label>)}</div></fieldset>{trial && <div className={`mt-3 rounded-lg border p-3 text-sm leading-6 ${trial.fullAmount > 0 ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>{trial.fullAmount > 0 ? <><p className="text-xs text-muted-foreground">本期账期：{trial.periodStart} 至 {trial.periodEnd}（结束日不含）</p><p className="text-xs text-muted-foreground">整期 {money(trial.fullAmount)} · 已收 {money(trial.collectedAmount)} · 已用 {trial.usedDays} 天 · 剩余 {trial.remainingDays} 天 · 日租金 {money(trial.dailyAmount)}</p><p className="mt-1 font-semibold text-foreground">{billingMode === "daily" ? `退剩余 ${trial.remainingDays} 天：应退 ${money(trial.refundAmount)}` : billingMode === "waive" ? `退本期全额：应退 ${money(trial.refundAmount)}` : trial.collectAmount > 0 ? `整期收取：还应补 ${money(trial.collectAmount)}` : "整期收取：无需补退租金"}</p></> : <p className="font-medium text-destructive">未找到归还日期对应的租金账期，请检查归还日期或账单后再提交。</p>}</div>}{billingMode !== "full_month" && <label className="mt-3 flex flex-col gap-2 text-sm font-medium">协商说明<span className="text-xs text-destructive">必填</span><textarea value={billingReasons[item.id] ?? ""} onChange={(event) => setBillingReasons((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-16 rounded-lg border bg-background p-3" placeholder="填写退款或减免原因，便于后续核对" /></label>}</div>; })()}</div>}
          </article>;
        })}
      </section>
      <section className="rounded-xl border bg-muted/40 p-4">
        <p className="mb-3 text-sm font-semibold">批量默认值</p>
        <p className="mb-4 text-xs leading-5 text-muted-foreground">下列日期、金额和备注默认应用到所有已选设备；数量可在每台设备中单独覆盖。</p>
        <div className="grid grid-cols-2 gap-4">
        <Field
          label={mode === "return" ? "归还日期" : "发生日期"}
          type="date"
          value={date}
          onChange={setDate}
        />
        {mode === "return" && (
          <label className="flex flex-col gap-2 text-sm font-medium">
            设备状况
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as typeof condition)}
              className="h-10 rounded-lg border bg-background px-3"
            >
              <option>完好</option>
              <option>轻微磨损</option>
              <option>损坏</option>
            </select>
          </label>
        )}
        <Field
          label={mode === "return" ? "损坏/清洁扣款（元）" : "单台赔偿（元）"}
          type="number"
          value={amount}
          onChange={(v) => setAmount(Number(v))}
        />
        {mode === "return" && (
          <Field
            label="押金退还（元）"
            type="number"
            value={refund}
            onChange={(v) => setRefund(Number(v))}
          />
        )}
        </div>
      </section>
      {mode === "return" && <section className="rounded-xl border bg-card p-4"><p className="font-semibold">结算核对</p><p className="mt-1 text-xs leading-5 text-muted-foreground">租金、押金和扣款分别处理，不自动互相抵扣。租金退款不会超过本期实际已收金额。</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div className="rounded-lg bg-muted p-3"><span className="text-muted-foreground">租金</span><p className="mt-1 font-semibold">{rentRefundTotal > 0 ? `应退 ${money(rentRefundTotal)}` : rentCollectTotal > 0 ? `应补 ${money(rentCollectTotal)}` : "无需补退"}</p></div><div className="rounded-lg bg-muted p-3"><span className="text-muted-foreground">押金</span><p className="mt-1 font-semibold">应退 {money(refund)}</p></div><div className="rounded-lg bg-muted p-3"><span className="text-muted-foreground">损坏/清洁扣款</span><p className="mt-1 font-semibold">应收 {money(amount)}</p></div></div></section>}
      {mode === "return" && rentRefundTotal > 0 && <SettlementFields label="租金退款" value={rentRefundSettlement} onChange={setRentRefundSettlement} />}
      {mode === "return" && amount > 0 && <SettlementFields label="损坏/清洁扣款" value={collectionSettlement} onChange={setCollectionSettlement} />}
      {mode === "return" && refund > 0 && <SettlementFields label="押金退款" value={refundSettlement} onChange={setRefundSettlement} />}
      {mode === "return" && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"><input type="checkbox" checked={settlementConfirmed} onChange={(event) => setSettlementConfirmed(event.target.checked)} className="mt-0.5 size-4 accent-primary"/><span><strong>我已核对本次退租结算</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">已确认租金应补/应退、押金退款和损坏扣款三项金额无误。</span></span></label>}
      <label className="flex flex-col gap-2 text-sm font-medium">
        备注
        <textarea
          className="min-h-20 rounded-lg border bg-background p-3"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button
        disabled={pending || !selectedRows.length || selectedRows.some((row) => { const item = available.find((current) => current.id === row.itemId); const max = item ? item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity : 0; return !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > max; }) || (mode === "loss" && amount <= 0) || (mode === "return" && (!settlementConfirmed || selectedRows.some((row) => { const billingMode = billingModes[row.itemId] ?? "full_month"; const trial = billingTrialByItem.get(row.itemId); return (billingMode !== "full_month" && (!trial?.fullAmount || !(billingReasons[row.itemId] ?? "").trim())); })))}
        className="h-10 self-end rounded-lg bg-primary px-5 font-medium text-primary-foreground"
      >
        {pending ? "处理中" : mode === "return" ? rentRefundTotal > 0 ? `确认退租（租金应退 ${money(rentRefundTotal)}）` : rentCollectTotal > 0 ? `确认退租（租金应补 ${money(rentCollectTotal)}）` : "确认退租（无需补退租金）" : "确认丢失"}
      </button>
    </form>
  );
}
function DepositForm({
  rental,
  submit,
  pending,
}: {
  rental: Rental;
  submit: (
    type: "押金退还" | "押金抵扣欠租" | "押金抵扣赔偿",
    amount: number,
    date: string,
    notes: string,
  ) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState({
    type: "押金退还" as "押金退还" | "押金抵扣欠租" | "押金抵扣赔偿",
    amount: 0,
    date: today(),
    notes: "",
  });
  const balance = rental.ledger.reduce(
    (sum, entry) =>
      sum +
      (entry.entryType === "押金收取"
        ? Number(entry.amount)
        : entry.entryType.startsWith("押金")
          ? -Math.abs(Number(entry.amount))
          : 0),
    0,
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value.type, value.amount, value.date, value.notes);
      }}
      className="flex flex-col gap-4"
    >
      <p className="rounded-lg bg-muted p-3 text-sm">
        当前可用押金余额：<strong>{money(balance)}</strong>
      </p>
      <label className="flex flex-col gap-2 text-sm font-medium">
        处理类型
        <select
          className="h-10 rounded-lg border bg-background px-3"
          value={value.type}
          onChange={(e) =>
            setValue({ ...value, type: e.target.value as typeof value.type })
          }
        >
          <option>押金退还</option>
          <option>押金抵扣欠租</option>
          <option>押金抵扣赔偿</option>
        </select>
      </label>
      <Field
        label="金额（元）"
        type="number"
        value={value.amount}
        onChange={(amount) => setValue({ ...value, amount: Number(amount) })}
      />
      <Field
        label="处理日期"
        type="date"
        value={value.date}
        onChange={(date) => setValue({ ...value, date })}
      />
      <Field
        label="原因及凭证备注"
        value={value.notes}
        onChange={(notes) => setValue({ ...value, notes })}
      />
      <button
        disabled={pending}
        className="h-10 rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-50"
      >
        确认处理
      </button>
    </form>
  );
}
function ExchangeForm({
  rental,
  submit,
  pending,
}: {
  rental: Rental;
  submit: (values: ExchangeInput[]) => void;
  pending: boolean;
}) {
  const available = rental.items.filter((item) => item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity > 0);
  const createValue = (itemId: number): ExchangeInput => ({
    rentalId: rental.id,
    rentalItemId: itemId,
    exchangeDate: today(),
    newDeviceName: "",
    newDeviceType: "台式机",
    newDeviceCode: "",
    newDeviceConfig: "",
    cpu: "",
    motherboard: "",
    memory: "",
    storage: "",
    graphicsCard: "",
    powerSupply: "",
    caseModel: "",
    monitorInfo: "",
    screenSize: "",
    screenResolution: "",
    refreshRate: "",
    panelType: "",
    ports: "",
    batteryInfo: "",
    adapterInfo: "",
    accessories: "",
    colorGamut: "",
    reason: "",
    notes: "",
  });
  const [rows, setRows] = useState<Record<number, ExchangeInput>>({});
  const [activeId, setActiveId] = useState(available[0]?.id || 0);
  const value = rows[activeId] ?? createValue(activeId);
  const selected = Object.values(rows);
  const allSelected = available.length > 0 && selected.length === available.length;
  const toggleItem = (itemId: number) => setRows((current) => {
    const next = { ...current };
    if (next[itemId]) delete next[itemId];
    else next[itemId] = createValue(itemId);
    setActiveId(itemId);
    return next;
  });
  const toggleAll = () => setRows(allSelected ? {} : Object.fromEntries(available.map((item) => [item.id, createValue(item.id)])));
  const update = (key: keyof ExchangeInput, next: string | number) =>
    setRows((current) => ({ ...current, [activeId]: { ...(current[activeId] ?? createValue(activeId)), [key]: next } }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(selected);
      }}
      className="flex flex-col gap-4"
    >
      <section className="flex flex-col gap-3" aria-label="选择换机设备">
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-sm text-muted-foreground">已选 {selected.length}/{available.length} 项</span><button type="button" onClick={toggleAll} className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted">{allSelected ? "取消全选" : "全选全部设备"}</button></div>
        <div className="grid gap-2 sm:grid-cols-2">{available.map((item) => <div key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 ${rows[item.id] ? "border-primary bg-primary/5" : ""}`}><input type="checkbox" checked={Boolean(rows[item.id])} onChange={() => toggleItem(item.id)} className="size-4 accent-primary" /><button type="button" onClick={() => setActiveId(item.id)} disabled={!rows[item.id]} className="min-w-0 flex-1 text-left disabled:opacity-60"><strong className="block truncate text-sm">{item.deviceType} · {item.deviceName}</strong><span className="block truncate text-xs text-muted-foreground">{item.deviceCode || "无编号"}{activeId === item.id && rows[item.id] ? " · 正在编辑" : ""}</span></button></div>)}</div>
      </section>
      {!selected.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">请先选择需要换机的设备，每台原设备可分别填写新设备信息。</p>}
      {rows[activeId] && <section className="flex flex-col gap-4 rounded-xl border p-4">
        <p className="text-sm font-semibold">填写当前设备的新机信息</p>
        <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="换机日期"
          type="date"
          value={value.exchangeDate}
          onChange={(next) => update("exchangeDate", next)}
        />
        <label className="flex flex-col gap-2 text-sm font-medium">
          设备类型
          <select
            className="h-10 rounded-lg border bg-background px-3"
            value={value.newDeviceType}
            onChange={(e) => update("newDeviceType", e.target.value)}
          >
            {["台式机", "笔记本", "显示器", "一体机", "其他"].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <Field
          label="新设备名称 / 型号"
          value={value.newDeviceName}
          onChange={(next) => update("newDeviceName", next)}
        />
        <Field
          label="新设备编号"
          value={value.newDeviceCode}
          onChange={(next) => update("newDeviceCode", next)}
        />
        {(configs[value.newDeviceType] || []).map(([key, label]) => {
          const exchangeKey = key as keyof ExchangeInput;
          return (
            <Field
              key={key}
              label={label}
              value={String(value[exchangeKey] || "")}
              onChange={(next) => update(exchangeKey, next)}
              required={false}
            />
          );
        })}
        {value.newDeviceType === "其他" && (
          <Field
            label="新设备配置"
            value={value.newDeviceConfig || ""}
            onChange={(next) => update("newDeviceConfig", next)}
            required={false}
          />
        )}
        <Field
          label="换机原因"
          value={value.reason}
          onChange={(next) => update("reason", next)}
        />
        <Field
          label="备注"
          value={value.notes || ""}
          onChange={(next) => update("notes", next)}
          required={false}
        />
        </div>
      </section>}
      <button
        disabled={pending || !selected.length || selected.some((row) => !row.newDeviceName.trim() || !row.newDeviceCode.trim() || !row.reason.trim())}
        className="h-10 rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "处理中" : `确认换机 ${selected.length} 项`}
      </button>
    </form>
  );
}
function itemToChange(item: Item): RentalChangeInput {
  return {
    rentalId: item.rentalId,
    itemId: item.id,
    eventDate: today(),
    reason: "",
    feeAdjustment: 0,
    giftDays: 0,
    notes: "",
    deviceName: item.deviceName,
    deviceType: item.deviceType as RentalChangeInput["deviceType"],
    deviceCode: item.deviceCode || "",
    quantity: item.quantity,
    deviceConfig: item.deviceConfig || "",
    cpu: item.cpu || "",
    motherboard: item.motherboard || "",
    memory: item.memory || "",
    storage: item.storage || "",
    graphicsCard: item.graphicsCard || "",
    powerSupply: item.powerSupply || "",
    caseModel: item.caseModel || "",
    monitorInfo: item.monitorInfo || "",
    screenSize: item.screenSize || "",
    screenResolution: item.screenResolution || "",
    refreshRate: item.refreshRate || "",
    panelType: item.panelType || "",
    ports: item.ports || "",
    batteryInfo: item.batteryInfo || "",
    adapterInfo: item.adapterInfo || "",
    accessories: item.accessories || "",
    colorGamut: item.colorGamut || "",
    monthlyRent: Number(item.monthlyRent),
    totalRent: Number(item.totalRent),
  };
}
function ChangeForm({
  rental,
  submit,
  pending,
}: {
  rental: Rental;
  submit: (values: RentalChangeInput[]) => void;
  pending: boolean;
}) {
  const available = rental.items.filter((item) => item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity > 0);
  const first = available[0];
  const [rows, setRows] = useState<Record<number, RentalChangeInput>>({});
  const [activeId, setActiveId] = useState(first?.id || 0);
  if (!first) return <p>暂无可变更设备</p>;
  const value = rows[activeId] ?? itemToChange(available.find((item) => item.id === activeId) ?? first);
  const selected = Object.values(rows);
  const allSelected = selected.length === available.length;
  const toggleItem = (item: Item) => setRows((current) => { const next = { ...current }; if (next[item.id]) delete next[item.id]; else next[item.id] = itemToChange(item); setActiveId(item.id); return next; });
  const toggleAll = () => setRows(allSelected ? {} : Object.fromEntries(available.map((item) => [item.id, itemToChange(item)])));
  const selectedItem = available.find((item) => item.id === activeId) ?? first;
  const currentEndDate = selectedItem.endDate || rental.endDate;
  const remainingDays = value.eventDate && value.eventDate <= currentEndDate
    ? Math.floor((Date.parse(`${currentEndDate}T00:00:00Z`) - Date.parse(`${value.eventDate}T00:00:00Z`)) / 86400000) + 1
    : 0;
  const calculatedAdjustment = Math.round((Number(value.monthlyRent) - Number(selectedItem.monthlyRent)) * (selectedItem.quantity - selectedItem.boughtOutQuantity - selectedItem.returnedQuantity - selectedItem.lostQuantity) * remainingDays / 30 * 100) / 100;
  const adjustedEndDate = addDays(currentEndDate, Number(value.giftDays || 0));
  const update = (key: keyof RentalChangeInput, next: string | number) =>
    setRows((current) => ({ ...current, [activeId]: { ...(current[activeId] ?? itemToChange(selectedItem)), [key]: next } }));
  const finalize = (row: RentalChangeInput) => {
    const item = available.find((current) => current.id === row.itemId) ?? first;
    const endDate = item.endDate || rental.endDate;
    const days = row.eventDate && row.eventDate <= endDate ? Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${row.eventDate}T00:00:00Z`)) / 86400000) + 1 : 0;
    const availableCount = item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity;
    const feeAdjustment = Math.round((Number(row.monthlyRent) - Number(item.monthlyRent)) * availableCount * days / 30 * 100) / 100;
    return { ...row, feeAdjustment, totalRent: Number(row.monthlyRent) * row.quantity };
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(selected.map(finalize));
      }}
      className="flex flex-col gap-4"
    >
      <section className="flex flex-col gap-3" aria-label="选择配置变更设备">
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-sm text-muted-foreground">已选 {selected.length}/{available.length} 项，每项可单独修改配置和月租</span><button type="button" onClick={toggleAll} className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted">{allSelected ? "取消全选" : "全选全部设备"}</button></div>
        <div className="grid gap-2 sm:grid-cols-2">{available.map((item) => <div key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 ${rows[item.id] ? "border-primary bg-primary/5" : ""}`}><input type="checkbox" checked={Boolean(rows[item.id])} onChange={() => toggleItem(item)} className="size-4 accent-primary" /><button type="button" onClick={() => setActiveId(item.id)} disabled={!rows[item.id]} className="min-w-0 flex-1 text-left disabled:opacity-60"><strong className="block truncate text-sm">{item.deviceType} · {item.deviceName}</strong><span className="block truncate text-xs text-muted-foreground">{item.deviceCode || "未编号"}{activeId === item.id && rows[item.id] ? " · 正在编辑" : ""}</span></button></div>)}</div>
      </section>
      {!selected.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">请选择要变更的设备。不同设备的配置、月租和赠送天数可以分别填写。</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="变更日期"
          type="date"
          value={value.eventDate}
          onChange={(next) => update("eventDate", next)}
        />
        <Field
          label="变更原因"
          value={value.reason}
          onChange={(next) => update("reason", next)}
        />
        <label className="flex flex-col gap-2 text-sm font-medium">
          设备类型
          <select
            className="h-10 rounded-lg border bg-background px-3"
            value={value.deviceType}
            onChange={(e) => update("deviceType", e.target.value)}
          >
            {["台式机", "笔记本", "显示器", "一体机", "其他"].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <Field
          label="设备名称 / 型号"
          value={value.deviceName}
          onChange={(next) => update("deviceName", next)}
        />
        <Field
          label="设备编号"
          value={value.deviceCode || ""}
          onChange={(next) => update("deviceCode", next)}
          required={false}
        />
        <Field
          label="调整后数量（只能增加）"
          type="number"
          value={value.quantity}
          onChange={(next) =>
            update("quantity", Math.max(selectedItem.quantity, Number(next)))
          }
        />
        {(configs[value.deviceType] || []).map(([key, label]) => {
          const changeKey = key as keyof RentalChangeInput;
          return (
            <Field
              key={key}
              label={label}
              value={String(value[changeKey] || "")}
              onChange={(next) => update(changeKey, next)}
              required={false}
            />
          );
        })}
        {value.deviceType === "其他" && (
          <Field
            label="设备配置"
            value={value.deviceConfig || ""}
            onChange={(next) => update("deviceConfig", next)}
            required={false}
          />
        )}
        <Field
          label="当前月租（元）"
          type="number"
          value={value.monthlyRent}
          onChange={(next) => update("monthlyRent", Number(next))}
        />
        <Field
          label="赠送天数"
          type="number"
          value={value.giftDays}
          onChange={(next) => update("giftDays", Math.max(0, Math.floor(Number(next))))}
          required={false}
        />
      </div>
      <section className="grid gap-3 rounded-xl border bg-muted p-4 sm:grid-cols-3" aria-label="配置变更费用预览">
        <Info l="调整后月租" v={money(Number(value.monthlyRent))} />
        <Info l="本次配置补差" v={money(calculatedAdjustment)} />
        <Info l="调整后到期日" v={adjustedEndDate} />
        <p className="text-pretty text-xs leading-5 text-muted-foreground sm:col-span-3">补差按变更日起至原到期日共 {remainingDays} 天、每月 30 天折算；赠送 {Number(value.giftDays || 0)} 天不计费，后续续租将从 {adjustedEndDate} 之后开始。</p>
      </section>
      <label className="flex flex-col gap-2 text-sm font-medium">
        备注
        <textarea
          className="min-h-20 rounded-lg border bg-background p-3"
          value={value.notes || ""}
          onChange={(e) => update("notes", e.target.value)}
        />
      </label>
      <button
        disabled={pending || !selected.length || selected.some((row) => !row.reason.trim() || !row.eventDate || Number(row.monthlyRent) < 0)}
        className="h-10 self-end rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "处理中" : `确认变更 ${selected.length} 项`}
      </button>
    </form>
  );
}
function RepairForm({
  rental,
  submit,
  pending,
}: {
  rental: Rental;
  submit: (values: RepairInput[]) => void;
  pending: boolean;
}) {
  const available = rental.items.filter((item) => item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity > 0);
  const createValue = (itemId: number): RepairInput => ({
    rentalId: rental.id,
    itemId,
    eventDate: today(),
    status: "待维修",
    faultDescription: "",
    resolution: "",
    repairCost: 0,
    customerCharge: 0,
    completedDate: "",
    notes: "",
  });
  const [rows, setRows] = useState<Record<number, RepairInput>>({});
  const [activeId, setActiveId] = useState(available[0]?.id || 0);
  const value = rows[activeId] ?? createValue(activeId);
  const selected = Object.values(rows);
  const allSelected = available.length > 0 && selected.length === available.length;
  const toggleItem = (itemId: number) => setRows((current) => { const next = { ...current }; if (next[itemId]) delete next[itemId]; else next[itemId] = createValue(itemId); setActiveId(itemId); return next; });
  const toggleAll = () => setRows(allSelected ? {} : Object.fromEntries(available.map((item) => [item.id, createValue(item.id)])));
  const update = (changes: Partial<RepairInput>) => setRows((current) => ({ ...current, [activeId]: { ...(current[activeId] ?? createValue(activeId)), ...changes } }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(selected);
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-3 sm:col-span-2" aria-label="选择维修设备">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="text-sm text-muted-foreground">已选 {selected.length}/{available.length} 项，每台设备独立登记故障和费用</span><button type="button" onClick={toggleAll} className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted">{allSelected ? "取消全选" : "全选全部设备"}</button></div>
          <div className="grid gap-2 sm:grid-cols-2">{available.map((item) => <div key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 ${rows[item.id] ? "border-primary bg-primary/5" : ""}`}><input type="checkbox" checked={Boolean(rows[item.id])} onChange={() => toggleItem(item.id)} className="size-4 accent-primary" /><button type="button" onClick={() => setActiveId(item.id)} disabled={!rows[item.id]} className="min-w-0 flex-1 text-left disabled:opacity-60"><strong className="block truncate text-sm">{item.deviceType} · {item.deviceName}</strong><span className="block truncate text-xs text-muted-foreground">{item.deviceCode || "无编号"}{activeId === item.id && rows[item.id] ? " · 正在编辑" : ""}</span></button></div>)}</div>
        </section>
        <Field
          label="报修日期"
          type="date"
          value={value.eventDate}
          onChange={(eventDate) => update({ eventDate })}
        />
        <label className="flex flex-col gap-2 text-sm font-medium">
          维修状态
          <select
            value={value.status}
            onChange={(e) =>
              update({ status: e.target.value as RepairInput["status"] })
            }
            className="h-10 rounded-lg border bg-background px-3"
          >
            <option>待维修</option>
            <option>维修中</option>
            <option>已完成</option>
          </select>
        </label>
        <Field
          label="完成日期"
          type="date"
          value={value.completedDate || ""}
          onChange={(completedDate) => update({ completedDate })}
          required={false}
        />
        <Field
          label="维修费用（元）"
          type="number"
          value={value.repairCost}
          onChange={(repairCost) =>
            update({ repairCost: Number(repairCost) })
          }
        />
        <Field
          label="客户承担金额（元）"
          type="number"
          value={value.customerCharge}
          onChange={(customerCharge) =>
            update({ customerCharge: Number(customerCharge) })
          }
        />
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium">
        故障描述
        <textarea
          required
          className="min-h-20 rounded-lg border bg-background p-3"
          value={value.faultDescription}
          onChange={(e) =>
            update({ faultDescription: e.target.value })
          }
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        处理方式
        <textarea
          className="min-h-20 rounded-lg border bg-background p-3"
          value={value.resolution || ""}
          onChange={(e) => update({ resolution: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        备注
        <textarea
          className="min-h-20 rounded-lg border bg-background p-3"
          value={value.notes || ""}
onChange={(e) => update({ notes: e.target.value })}
        />
      </label>
      <button
        disabled={pending || !selected.length || selected.some((row) => !row.eventDate || !row.faultDescription.trim() || (row.status === "已完成" && !row.completedDate))}
        className="h-10 self-end rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "处理中" : `保存 ${selected.length} 张维修单`}
      </button>
    </form>
  );
}
function BuyoutForm({
  rental,
  submit,
  pending,
}: {
  rental: Rental;
  submit: (
    values: Array<{ itemId: number; quantity: number; price: number; date: string; notes: string }>,
    settlement: SettlementInput,
  ) => void;
  pending: boolean;
}) {
  const available = rental.items.filter(
    (item) => item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity > 0,
  );
  type BuyoutRow = { itemId: number; quantity: number; price: number; date: string; notes: string };
  const [rows, setRows] = useState<Record<number, BuyoutRow>>({});
  const [price, setPrice] = useState(0);
  const [date, setDate] = useState(today());
  const [settlement, setSettlement] = useState<SettlementInput>({ timing: "now", date: today(), method: "微信" });
  const [notes, setNotes] = useState("");
  const selected = Object.values(rows);
  const allSelected = available.length > 0 && selected.length === available.length;
  const defaultRow = (item: Item): BuyoutRow => ({ itemId: item.id, quantity: item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity, price, date, notes });
  const toggle = (item: Item) => setRows((current) => { const next = { ...current }; if (next[item.id]) delete next[item.id]; else next[item.id] = defaultRow(item); return next; });
  const toggleAll = () => setRows(allSelected ? {} : Object.fromEntries(available.map((item) => [item.id, defaultRow(item)])));
  const applyDefaults = () => setRows((current) => Object.fromEntries(Object.values(current).map((row) => [row.itemId, { ...row, price, date, notes }])));
  const totalQuantity = selected.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = selected.reduce((sum, row) => sum + row.quantity * row.price, 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(selected, settlement);
      }}
      className="flex flex-col gap-4"
    >
      <section className="flex flex-col gap-3" aria-label="选择买断设备">
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <span className="text-sm text-muted-foreground">已选 {selected.length}/{available.length} 项，共 {totalQuantity} 台</span>
          <button type="button" onClick={toggleAll} className="h-9 rounded-lg border px-4 text-sm font-medium hover:bg-muted">{allSelected ? "取消全选" : "全选全部设备"}</button>
        </div>
        {available.map((item) => {
          const max = item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity;
          const row = rows[item.id];
          return <article key={item.id} className={`rounded-xl border p-4 ${row ? "border-primary bg-primary/5" : ""}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={Boolean(row)} onChange={() => toggle(item)} className="mt-1 size-4 accent-primary" />
              <span className="min-w-0 flex-1"><strong>{item.deviceType} · {item.deviceName}</strong><span className="block text-xs text-muted-foreground">{item.deviceCode || "未编号"} · 可买断 {max} 台</span></span>
            </label>
            {row && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="买断数量" type="number" value={row.quantity} onChange={(value) => setRows((current) => ({ ...current, [item.id]: { ...current[item.id], quantity: Number(value) } }))} />
              <Field label="买断单价（元）" type="number" value={row.price} onChange={(value) => setRows((current) => ({ ...current, [item.id]: { ...current[item.id], price: Number(value) } }))} />
              <Field label="买断日期" type="date" value={row.date} onChange={(value) => setRows((current) => ({ ...current, [item.id]: { ...current[item.id], date: value } }))} />
              <Field label="单项备注" value={row.notes} required={false} onChange={(value) => setRows((current) => ({ ...current, [item.id]: { ...current[item.id], notes: value } }))} />
            </div>}
          </article>;
        })}
      </section>
      <section className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-4">
        <div><p className="text-sm font-semibold">批量默认值</p><p className="mt-1 text-xs leading-5 text-muted-foreground">先设置统一值并应用，再按设备单独覆盖。</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="买断单价（元）" type="number" value={price} onChange={(value) => setPrice(Number(value))} />
          <Field label="买断日期" type="date" value={date} onChange={setDate} />
          <Field label="统一备注" value={notes} required={false} onChange={setNotes} />
          <button type="button" onClick={applyDefaults} disabled={!selected.length} className="h-10 self-end rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">应用到已选设备</button>
        </div>
      </section>
      <div className="rounded-xl bg-muted p-4"><p className="text-xs text-muted-foreground">本次买断汇总</p><p className="mt-1 text-lg font-semibold">{totalQuantity} 台 · {money(totalAmount)}</p></div>
      <SettlementFields label="买断费收款" value={settlement} onChange={setSettlement} />
      <button
        disabled={pending || !selected.length || selected.some((row) => { const item = available.find((current) => current.id === row.itemId); const max = item ? item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity : 0; return !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > max || row.price <= 0 || !row.date; })}
        className="h-10 self-end rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "处理中" : `确认买断 ${totalQuantity} 台`}
      </button>
    </form>
  );
}
function Dialog({
  open,
  title,
  children,
  onClose,
  wide = false,
  fixedHeight = false,
  embedded = false,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  fixedHeight?: boolean;
  embedded?: boolean;
}) {
  if (!open) return null;

  const panel = (
    <div
      role={embedded ? "region" : "dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-label={title}
      className={
        embedded
          ? "flex min-h-[calc(100svh-8rem)] w-full flex-col bg-background"
          : `flex max-h-[92svh] w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xl ${wide ? "h-[92svh] max-w-5xl md:h-[min(760px,92svh)]" : "max-w-lg"} ${fixedHeight && !wide ? "h-[92svh] md:h-[min(760px,92svh)]" : ""}`
      }
    >
      <div className={`flex shrink-0 items-center justify-between border-b ${embedded ? "bg-muted/30 px-4 py-3 md:px-6" : "bg-card p-4"}`}>
        <div className="flex min-w-0 items-center gap-3">
          {embedded && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 items-center gap-1 rounded-xl border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              返回
            </button>
          )}
          <h2 className="truncate text-lg font-semibold">{title}</h2>
        </div>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="rounded-lg p-2 hover:bg-muted"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className={embedded ? "flex-1 p-4 md:p-6" : "min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"}>
        <div className={embedded ? "mx-auto max-w-7xl" : undefined}>{children}</div>
      </div>
    </div>
  );

  if (embedded) return panel;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      {panel}
    </div>
  );
}
function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border p-4">
      <legend className="px-2 font-semibold">{title}</legend>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </fieldset>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  placeholder,
  readOnly = false,
  suggestions = [],
  listId,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  suggestions?: string[];
  listId?: string;
}) {
  const integer = type === "number" && /(数量|月数|天数)/.test(label);
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      <span>
        {label}
        {required && !readOnly && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <input
        className="h-10 rounded-lg border bg-background px-3 outline-none read-only:cursor-not-allowed read-only:bg-muted focus:ring-2 focus:ring-primary"
        type={type}
        inputMode={
          integer ? "numeric" : type === "number" ? "decimal" : undefined
        }
        value={value}
        list={suggestions.length && listId ? listId : undefined}
        onChange={(e) => {
          if (integer && e.target.value !== "" && !/^\d+$/.test(e.target.value))
            return;
          onChange(e.target.value);
        }}
        onFocus={(e) => {
          if (type === "number" && !readOnly) e.currentTarget.select();
        }}
        required={required}
        readOnly={readOnly}
        placeholder={placeholder}
        min={
          type === "number" && !/(差额|可填负数)/.test(label)
            ? "0"
            : undefined
        }
        step={type === "number" ? (integer ? "1" : "0.01") : undefined}
      />
      {suggestions.length > 0 && listId && <datalist id={listId}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>}
    </label>
  );
}
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted text-primary">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
function BillingStatus({ value }: { value: ReturnType<typeof billState> | "已抵扣" }) {
  const tones = {
    "已结清": "bg-primary/10 text-primary",
    "已抵扣": "bg-accent text-accent-foreground",
    "待付款": "bg-chart-2/15 text-chart-2",
    "即将到期": "bg-accent text-accent-foreground",
    "逾期": "bg-destructive/10 text-destructive",
    "部分收款": "bg-secondary text-secondary-foreground",
  } as const;
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${tones[value]}`}>{value}</span>;
}

function Status({ value }: { value: string }) {
  const tone =
    value === "逾期"
      ? "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20"
      : ["在租", "已续租", "已完成", "已结束"].includes(value)
        ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
        : ["待审核", "待处理", "即将到期", "已到期"].includes(value)
          ? "bg-accent text-accent-foreground ring-1 ring-inset ring-border"
          : ["买断", "已退租", "已买断", "丢失"].includes(value)
            ? "bg-secondary text-secondary-foreground ring-1 ring-inset ring-border"
            : "bg-muted text-muted-foreground ring-1 ring-inset ring-border";
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {value}
    </span>
  );
}
function Info({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className="mt-1 font-medium">{v}</p>
    </div>
  );
}
function QuickAction({
  label,
  type,
  onSubmit,
  pending,
}: {
  label: string;
  type: string;
  onSubmit: (value: string) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      className="flex flex-col gap-4"
    >
      <Field label={label} type={type} value={value} onChange={setValue} />
      <button
        disabled={pending}
        className="h-10 self-end rounded-lg bg-primary px-5 font-medium text-primary-foreground"
      >
        {pending ? "处理中" : "确认提交"}
      </button>
    </form>
  );
}
