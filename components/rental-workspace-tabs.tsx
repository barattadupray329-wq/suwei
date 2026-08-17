"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, List, X } from "lucide-react";

const STORAGE_KEY = "rental-workspaces-v1";
const RETURN_KEY = "rental-workspace-return-v1";
const SNAPSHOT_PREFIX = "rental-workspace-form-";

type Workspace = {
  id: number;
  contractNo: string;
  customerName: string;
  href: string;
  dirty?: boolean;
};

type FormSnapshot = Array<{ value: string; checked?: boolean }>;

function readWorkspaces(): Workspace[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]") as Workspace[];
  } catch {
    return [];
  }
}

function writeWorkspaces(items: Workspace[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-8)));
  window.dispatchEvent(new Event("rental-workspaces-change"));
}

export function rememberRentalWorkspace(workspace: Workspace) {
  const current = readWorkspaces();
  const next = [...current.filter((item) => item.id !== workspace.id), workspace];
  writeWorkspaces(next);
}

function captureCurrentForm(rentalId: number) {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) return false;
  const title = dialog.getAttribute("aria-label") || "";
  if (!title || title.startsWith("HT") || title === "客户历史记录") return false;
  const fields = Array.from(dialog.querySelectorAll("input, select, textarea")) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  if (!fields.length) return false;
  const snapshot: FormSnapshot = fields.map((field) => ({
    value: field.value,
    ...(field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type) ? { checked: field.checked } : {}),
  }));
  sessionStorage.setItem(`${SNAPSHOT_PREFIX}${rentalId}`, JSON.stringify(snapshot));
  return true;
}

function restoreCurrentForm(rentalId: number) {
  const raw = sessionStorage.getItem(`${SNAPSHOT_PREFIX}${rentalId}`);
  if (!raw) return;
  let snapshot: FormSnapshot = [];
  try { snapshot = JSON.parse(raw) as FormSnapshot; } catch { return; }
  window.setTimeout(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const fields = dialog ? Array.from(dialog.querySelectorAll("input, select, textarea")) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> : [];
    fields.forEach((field, index) => {
      const saved = snapshot[index];
      if (!saved) return;
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set;
      setter?.call(field, saved.value);
      if (field instanceof HTMLInputElement && saved.checked !== undefined) field.checked = saved.checked;
      field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  }, 250);
}

export function RentalWorkspaceTabs({
  activeRental,
  listHref,
}: {
  activeRental?: { id: number; contractNo: string; customerName: string } | null;
  listHref: string;
}) {
  const [items, setItems] = useState<Workspace[]>([]);
  useEffect(() => {
    if (activeRental) {
      const current = readWorkspaces();
      const existing = current.find((item) => item.id === activeRental.id);
      writeWorkspaces([
        ...current.filter((item) => item.id !== activeRental.id),
        existing ?? { ...activeRental, href: window.location.pathname + window.location.search },
      ]);
      restoreCurrentForm(activeRental.id);
    }
    const update = () => setItems(readWorkspaces());
    update();
    window.addEventListener("rental-workspaces-change", update);
    return () => window.removeEventListener("rental-workspaces-change", update);
  }, [activeRental]);

  const prepareSwitch = () => {
    if (!activeRental) return;
    const dirty = captureCurrentForm(activeRental.id);
    if (dirty) writeWorkspaces(readWorkspaces().map((item) => item.id === activeRental.id ? { ...item, dirty: true } : item));
  };
  const close = (workspace: Workspace) => {
    if (workspace.dirty && !window.confirm("该订单窗口有未提交内容，确认关闭并放弃吗？")) return;
    sessionStorage.removeItem(`${SNAPSHOT_PREFIX}${workspace.id}`);
    writeWorkspaces(readWorkspaces().filter((item) => item.id !== workspace.id));
    if (activeRental?.id === workspace.id) window.location.assign(listHref);
  };

  return (
    <nav aria-label="订单工作区" className={`flex items-center gap-2 overflow-x-auto rounded-xl border bg-card p-2 shadow-sm ${activeRental ? "fixed inset-x-4 top-2 z-[60] mx-auto max-w-6xl" : ""}`}>
      <Link href={listHref} onClick={prepareSwitch} className={`flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${!activeRental ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-border"}`}>
        <List className="size-4" />租赁列表
      </Link>
      {items.map((workspace) => {
        const active = activeRental?.id === workspace.id;
        return (
          <div key={workspace.id} className={`flex h-11 shrink-0 items-center rounded-lg border ${active ? "border-primary bg-primary/10" : "bg-background hover:bg-muted"}`}>
            <Link href={workspace.href} onClick={prepareSwitch} className="flex h-full min-w-0 items-center gap-2 px-3">
              <FileText className="size-4 shrink-0 text-primary" />
              {workspace.dirty && <span className="size-2 shrink-0 rounded-full bg-destructive" aria-label="有未提交内容" />}
              <span className="max-w-40 truncate text-sm font-semibold">{workspace.contractNo}</span>
              <span className="max-w-24 truncate text-xs text-muted-foreground">{workspace.customerName}</span>
            </Link>
            <button type="button" aria-label={`关闭 ${workspace.contractNo}`} onClick={() => close(workspace)} className="mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export function saveRentalListReturn(href: string) {
  sessionStorage.setItem(RETURN_KEY, href);
}

export function readRentalListReturn(fallback = "/rentals") {
  return sessionStorage.getItem(RETURN_KEY) || fallback;
}
