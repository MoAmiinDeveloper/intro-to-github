import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Num = number | string | { toString(): string } | null | undefined;

export function toNumber(v: Num): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

/** USD with 2 decimals, or more decimals for small unit prices like $0.025. */
export function formatMoney(v: Num, opts: { currency?: string; minDecimals?: number } = {}): string {
  const n = toNumber(v);
  if (n === null) return "";
  const abs = Math.abs(n);
  const decimals = abs !== 0 && abs < 1 ? Math.max(2, decimalsNeeded(n, 4)) : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: opts.currency ?? "USD",
    minimumFractionDigits: Math.max(opts.minDecimals ?? 2, Math.min(decimals, 4)),
    maximumFractionDigits: Math.max(opts.minDecimals ?? 2, Math.min(decimals, 4)),
  }).format(n);
}

function decimalsNeeded(n: number, max: number): number {
  for (let d = 0; d <= max; d++) {
    if (Math.abs(Math.round(n * 10 ** d) - n * 10 ** d) < 1e-9) return d;
  }
  return max;
}

export function formatNumber(v: Num): string {
  const n = toNumber(v);
  return n === null ? "" : new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Empty strings from forms become null. */
export function emptyToNull<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  return out as T;
}
