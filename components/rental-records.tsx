"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent, type MouseEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

type Row = {
  id: number;
  orderType: string;
  lifecycleStatus: string;
  deletedAt: Date | null;
  contractNo: string;
  customerCompany: string | null;
  customerName: string;
  customerPhone: string;
  deviceName: string;
  quantity: number;
  startDate: string;
  endDate: string;
  paidThroughDate: string | null;
  periodCount: number;
  paidPeriodCount: number;
  unpaidPeriodCount: number;
  partialPeriodCount: number;
  billingUnit: string;
  totalRent: string;
  paidAmount: string;
  paymentStatus: string;
  status: string;
  assigneeName: string | null;
};
type Filters = {
  query: string;
  status: string;
  startDate: string;
  endDate: string;
  assignee: string;
  orderType: string;
  lifecycleStatus: string;
  sort: string;
  receivable: string;
  page: number;
};
type Assignee = { id: string; name: string };

const money = (value: string) => {
  const amount = Number(value);
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
};
const statusTone = (status: string) =>
  status === "逾期"
    ? "border border-destructive/30 bg-destructive/10 text-destructive"
    : status === "在租"
      ? "border border-primary/30 bg-primary/10 text-primary"
      : ["买断", "已买断", "部分买断"].includes(status)
        ? "border border-accent bg-accent text-accent-foreground"
        : ["已退租", "已结束", "已关闭", "已完成"].includes(status)
          ? "border border-border bg-muted text-muted-foreground"
          : "border border-border bg-secondary text-secondary-foreground";
const paymentTone = (status: string) =>
  status === "已结清"
    ? "text-primary"
    : status.includes("逾期") || status === "待收款"
      ? "font-semibold text-destructive"
      : "text-muted-foreground";
const rowTone = (status: string) =>
  status === "逾期"
    ? "bg-destructive/5 hover:bg-destructive/10"
    : ["已退租", "已结束", "已关闭", "已完成"].includes(status)
      ? "bg-muted/40 opacity-75 hover:bg-muted/70"
      : "hover:bg-muted/40";
const displayStatus = (row: Row) => row.status;
const overdueDays = (row: Row) => {
  if (displayStatus(row) !== "逾期") return 0;
  const today = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
      new Date(),
    ),
  );
  return Math.max(
    1,
    Math.floor(
      (today.getTime() - new Date(`${row.endDate}T00:00:00+08:00`).getTime()) /
        86_400_000,
    ),
  );
};
const outstanding = (row: Row) =>
  Math.max(0, Number(row.totalRent) - Number(row.paidAmount));

export function RentalRecords({
  rows,
  total,
  initialRentOutstanding,
  expectedReceivable,
  overdueReceivable,
  page,
  pageCount,
  filters,
  assignees,
}: {
  rows: Row[];
  total: number;
  initialRentOutstanding: string;
  expectedReceivable: string;
  overdueReceivable: string;
  page: number;
  pageCount: number;
  filters: Filters;
  assignees: Assignee[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = (href: string) => startTransition(() => router.push(href));
  const openDetail = (id: number) => {
    const params = new URLSearchParams();
    Object.entries({ ...filters, page }).forEach(([key, value]) => {
      if (value && value !== "全部" && value !== "all" && value !== "newest")
        params.set(key, String(value));
    });
    params.set('rental', String(id));
    navigate(`/rentals?${params}`);
  };
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    Object.entries({ ...filters, page: nextPage }).forEach(([key, value]) => {
      if (value && value !== "全部" && value !== "newest")
        params.set(key, String(value));
    });
    return `/rentals?${params}`;
  };
  const navigateLink = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    navigate(href);
  };
  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    values.forEach((value, key) => {
      if (value && value !== "全部" && value !== "all" && value !== "newest")
        params.set(key, String(value));
    });
    navigate(`/rentals?${params}`);
  };
  return (
    <div className="page-container" aria-busy={isPending}>
      {isPending && (
        <div
          role="status"
          className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg"
        >
          <LoaderCircle className="size-4 animate-spin" />
          正在加载
        </div>
      )}
      <header className="page-header">
        <div>
          <p className="page-eyebrow">合同全生命周期</p>
          <h1 className="page-title">租赁管理</h1>
          <p className="page-description">
            统一办理租机登记、查看修改、续租、退租、买断、换机、维修、丢失与收款；搜索、筛选和分页均在数据库完成。
          </p>
        </div>
        <div className="page-actions">
          <Link href="/rentals/trash" className="secondary-button">
            回收站
          </Link>
          <a
            href={`/api/exports/rental-ledger?${new URLSearchParams(
              Object.entries(filters)
                .filter(([, value]) => value && value !== "全部")
                .map(([key, value]) => [key, String(value)]),
            )}`}
            className="secondary-button"
          >
            <Download className="size-4" />
            按条件导出
          </a>
          <Link href="/rentals?new=1" className="primary-button">
            <Plus className="size-4" />
            登记新租赁
          </Link>
        </div>
      </header>
      <nav aria-label="租赁状态快捷筛选" className="flex flex-wrap gap-2">
        {["在租", "逾期", "已买断", "已退租"].map((item) => (
          <Link
            key={item}
            aria-current={filters.status === item ? "page" : undefined}
            href={`/rentals?status=${encodeURIComponent(item)}`}
            onClick={(event) =>
              navigateLink(event, `/rentals?status=${encodeURIComponent(item)}`)
            }
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80 ${statusTone(item)} ${filters.status === item ? "ring-2 ring-foreground/20 ring-offset-2" : ""}`}
          >
            {item}
          </Link>
        ))}
        <Link
          aria-current={
            filters.receivable === "outstanding" ? "page" : undefined
          }
          href="/rentals?receivable=outstanding&sort=outstanding"
          onClick={(event) =>
            navigateLink(
              event,
              "/rentals?receivable=outstanding&sort=outstanding",
            )
          }
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${filters.receivable === "outstanding" ? "border-destructive/30 bg-destructive/10 text-destructive ring-2 ring-destructive/20 ring-offset-2" : "border-border bg-card text-foreground hover:border-primary"}`}
        >
          待收款
        </Link>
      </nav>
      <form
        className="surface"
        action="/rentals"
        method="get"
        onSubmit={submitFilters}
      >
        <div className="surface-content flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="md:col-span-2 xl:col-span-2">
              <span className="sr-only">搜索合同或客户</span>
              <span className="relative block">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="query"
                  defaultValue={filters.query}
                  placeholder="搜索合同、客户、手机号或设备"
                  className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
                />
              </span>
            </label>
            <select
              name="orderType"
              defaultValue={filters.orderType}
              aria-label="订单类型"
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="all">全部类型</option>
              <option value="official">正式合同</option>
              <option value="draft">草稿</option>
              <option value="test">测试合同</option>
            </select>
            <select
              name="assignee"
              defaultValue={filters.assignee}
              aria-label="维护负责人"
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">全部负责人</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={filters.sort}
              aria-label="排序方式"
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="newest">最新录入</option>
              <option value="oldest">最早录入</option>
              <option value="due">即将到期</option>
              <option value="amount">合同金额</option>
              <option value="outstanding">待收金额</option>
            </select>
            <div className="flex gap-2">
              <button
                className="primary-button flex-1 justify-center"
                type="submit"
                disabled={isPending}
              >
                {isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {isPending ? "查询中" : "查询"}
              </button>
              <Link href="/rentals" className="secondary-button justify-center px-3">
                重置
              </Link>
            </div>
          </div>

          {["在租", "逾期", "已买断", "已退租"].includes(filters.status) && (
            <input type="hidden" name="status" value={filters.status} />
          )}
          {filters.receivable === "outstanding" && (
            <input type="hidden" name="receivable" value="outstanding" />
          )}

          <details
            className="group border-t pt-3"
            open={Boolean(
              filters.startDate ||
                filters.endDate ||
                filters.receivable === "overdue" ||
                filters.receivable === "upcoming" ||
                ["部分买断", "部分退租", "部分丢失", "丢失", "已结束"].includes(filters.status),
            )}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <SlidersHorizontal className="size-4" />
              更多条件
              <span className="text-xs font-normal">日期、特殊状态、应收节点</span>
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <select
                name="status"
                defaultValue={
                  ["部分买断", "部分退租", "部分丢失", "丢失", "已结束"].includes(filters.status)
                    ? filters.status
                    : "全部"
                }
                aria-label="特殊合同状态"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="全部">全部特殊状态</option>
                {["部分买断", "部分退租", "部分丢失", "丢失", "已结束"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                name="receivable"
                defaultValue={
                  filters.receivable === "overdue" || filters.receivable === "upcoming"
                    ? filters.receivable
                    : "all"
                }
                aria-label="应收节点"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="all">全部应收节点</option>
                <option value="overdue">已逾期待收</option>
                <option value="upcoming">未到期待收</option>
              </select>
              <input
                type="date"
                name="startDate"
                defaultValue={filters.startDate}
                aria-label="起租日期起"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
              />
              <input
                type="date"
                name="endDate"
                defaultValue={filters.endDate}
                aria-label="到期日期止"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
              />
            </div>
          </details>

        </div>
      </form>
      <section aria-label="当前查询统计" className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            初始租赁未付
          </p>
          <p className="mt-2 text-2xl font-bold text-destructive">
            {money(initialRentOutstanding)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            当前 {total.toLocaleString("zh-CN")} 份合同的初始租金未付
          </p>
        </article>
        <article className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-primary">预期应收</p>
          <p className="mt-2 text-2xl font-bold">{money(expectedReceivable)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            当前查询合同净应收减已收
          </p>
        </article>
        <article className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">逾期待收</p>
          <p className="mt-2 text-2xl font-bold text-destructive">
            {money(overdueReceivable)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            当前查询中已逾期仍未收
          </p>
        </article>
      </section>
      <section className="data-shell">
        <div className="toolbar">
          <div>
            <h2 className="font-semibold">
              {filters.receivable === "outstanding"
                ? "待收款合同"
                : filters.receivable === "overdue"
                  ? "逾期待收合同"
                  : filters.receivable === "upcoming"
                    ? "未到期待收合同"
                    : "查询结果"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filters.receivable !== "all"
                ? "仅显示剩余应收大于 0 的合同 · "
                : ""}
              共 {total.toLocaleString("zh-CN")} 条，当前第 {page} / {pageCount}{" "}
              页
            </p>
          </div>
        </div>
        {rows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-3">合同与客户</th>
                    <th className="p-3">设备</th>
                    <th className="p-3">租期</th>
                    <th className="p-3">期数</th>
                    <th className="p-3">金额</th>
                    <th className="p-3">状态</th>
                    <th className="p-3">负责人</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      onDoubleClick={() => openDetail(row.id)}
                      title="双击查看租赁详情"
                      className={`cursor-pointer border-t ${rowTone(displayStatus(row))}`}
                    >
                      <td className="p-3">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {row.contractNo}
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {row.orderType === "official"
                              ? "正式"
                              : row.orderType === "draft"
                                ? "草稿"
                                : "测试"}
                          </span>
                        </p>
                        <p>{row.customerCompany || row.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.customerName} · {row.customerPhone}
                        </p>
                      </td>
                      <td className="p-3">
                        {row.deviceName}
                        <p className="text-xs text-muted-foreground">
                          共 {row.quantity} 台
                        </p>
                      </td>
                      <td className="p-3">
                        {row.startDate}
                        <p className="text-xs font-medium text-primary">
                          已付至 {row.paidThroughDate ?? row.startDate}
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="whitespace-nowrap font-semibold">
                          <span className="text-primary">
                            已付 {row.paidPeriodCount}{" "}
                            {row.billingUnit === "daily" ? "天" : "期"}
                          </span>
                          <span className="text-muted-foreground"> · </span>
                          <span
                            className={
                              row.unpaidPeriodCount > 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }
                          >
                            未付 {row.unpaidPeriodCount}{" "}
                            {row.billingUnit === "daily" ? "天" : "期"}
                          </span>
                        </p>
                        {row.partialPeriodCount > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            含部分付款 {row.partialPeriodCount}{" "}
                            {row.billingUnit === "daily" ? "天" : "期"}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          合计 {row.periodCount}{" "}
                          {row.billingUnit === "daily" ? "天" : "期"}（含续租）
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold">{money(row.totalRent)}</p>
                        <p className="text-xs text-muted-foreground">
                          已收 {money(row.paidAmount)}
                        </p>
                        {displayStatus(row) === "逾期" ? (
                          <p className="mt-1 text-xs font-semibold text-destructive">
                            逾期待收 {money(String(outstanding(row)))}
                          </p>
                        ) : (
                          outstanding(row) > 0 && (
                            <p className="mt-1 text-xs font-semibold text-destructive">
                              待收 {money(String(outstanding(row)))}
                            </p>
                          )
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(displayStatus(row))}`}
                        >
                          {displayStatus(row)}
                        </span>
                        {displayStatus(row) === "逾期" && (
                          <p className="mt-1 text-xs font-semibold text-destructive">
                            已逾期 {overdueDays(row)} 天
                          </p>
                        )}
                        <p
                          className={`mt-1 text-xs ${paymentTone(row.paymentStatus)}`}
                        >
                          {row.paymentStatus}
                        </p>
                      </td>
                      <td className="p-3">{row.assigneeName || "未分配"}</td>
                      <td className="p-3 text-right">
                        <Link
                          className="font-semibold text-primary hover:underline"
                          href={`/rentals?rental=${row.id}`}
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 p-3 md:hidden">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className={`rounded-xl border p-4 ${rowTone(displayStatus(row))}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {row.contractNo}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {row.orderType === "official"
                            ? "正式"
                            : row.orderType === "draft"
                              ? "草稿"
                              : "测试"}
                        </span>
                      </p>
                      <p className="text-sm">
                        {row.customerCompany || row.customerName}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(displayStatus(row))}`}
                    >
                      {displayStatus(row)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">联系电话</p>
                      <p>{row.customerPhone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">到期日</p>
                      <p>{row.endDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">合同金额</p>
                      <p className="font-semibold">{money(row.totalRent)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">负责人</p>
                      <p>{row.assigneeName || "未分配"}</p>
                    </div>
                  </div>
                  <Link
                    className="secondary-button mt-4 w-full"
                    href={`/rentals?rental=${row.id}`}
                  >
                    查看合同详情
                  </Link>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state m-4">
            <Search className="size-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">没有符合条件的租赁记录</p>
              <p className="mt-1 text-sm text-muted-foreground">
                请调整关键词或筛选条件后重试。
              </p>
            </div>
          </div>
        )}
        <footer className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-4">
            <p className="text-sm text-muted-foreground">
              第 {total ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)}{" "}
              条
            </p>
            <p className="font-semibold text-destructive">
              逾期待收：{money(overdueReceivable)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : 0}
              href={pageHref(Math.max(1, page - 1))}
              onClick={(event) =>
                navigateLink(event, pageHref(Math.max(1, page - 1)))
              }
              className={`secondary-button ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              <ChevronLeft className="size-4" />
              上一页
            </Link>
            <Link
              aria-disabled={page >= pageCount}
              tabIndex={page >= pageCount ? -1 : 0}
              href={pageHref(Math.min(pageCount, page + 1))}
              onClick={(event) =>
                navigateLink(event, pageHref(Math.min(pageCount, page + 1)))
              }
              className={`secondary-button ${page >= pageCount ? "pointer-events-none opacity-50" : ""}`}
            >
              下一页
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </footer>
      </section>
    </div>
  );
}
