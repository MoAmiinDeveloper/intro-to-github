/**
 * Pipeline rules. Pure functions so they can be unit tested.
 */
import { roundMoney, volumePrice, type Tier } from "./pricing";

export type StageKind = "OPEN" | "WON" | "LOST";

/** Weighted value = value x probability. One-time and monthly are always kept apart. */
export function weighted(value: number, probability: number): number {
  return roundMoney((value * probability) / 100);
}

export interface DealValues {
  oneTimeValue: number;
  monthlyValue: number;
  probability: number;
}

export interface Totals {
  count: number;
  oneTime: number;
  monthly: number;
  weightedOneTime: number;
  weightedMonthly: number;
}

export function totals(deals: readonly DealValues[]): Totals {
  const t: Totals = { count: 0, oneTime: 0, monthly: 0, weightedOneTime: 0, weightedMonthly: 0 };
  for (const d of deals) {
    t.count++;
    t.oneTime += d.oneTimeValue;
    t.monthly += d.monthlyValue;
    t.weightedOneTime += (d.oneTimeValue * d.probability) / 100;
    t.weightedMonthly += (d.monthlyValue * d.probability) / 100;
  }
  return {
    count: t.count,
    oneTime: roundMoney(t.oneTime),
    monthly: roundMoney(t.monthly),
    weightedOneTime: roundMoney(t.weightedOneTime),
    weightedMonthly: roundMoney(t.weightedMonthly),
  };
}

/** When a deal has product lines, its value is the sum of the lines. */
export function valuesFromLines(lines: readonly { oneTimeValue: number; monthlyValue: number }[]) {
  return {
    oneTimeValue: roundMoney(lines.reduce((s, l) => s + l.oneTimeValue, 0)),
    monthlyValue: roundMoney(lines.reduce((s, l) => s + l.monthlyValue, 0)),
  };
}

/** An open deal with no activity (call, meeting, email, note or stage change) for `staleDays` days. */
export function isStale(deal: { stageKind: StageKind; lastActivityAt: Date }, staleDays: number, now: Date): boolean {
  if (deal.stageKind !== "OPEN") return false;
  return now.getTime() - deal.lastActivityAt.getTime() >= staleDays * 86_400_000;
}

export function daysSince(d: Date, now: Date): number {
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

// ---------------- Dates ----------------

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Mogadishu";

/** Today's date as YYYY-MM-DD in the app's time zone (Hargeisa by default). */
export function todayIn(now: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** A date-only value (stored as UTC midnight) as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKey(d);
}

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "later";

export function followUpBucket(followUp: Date, today: string, upcomingDays = 7): FollowUpBucket {
  const k = dateKey(followUp);
  if (k < today) return "overdue";
  if (k === today) return "today";
  if (k <= addDays(today, upcomingDays)) return "upcoming";
  return "later";
}

// ---------------- Moving a deal ----------------

export interface MoveInput {
  current: { stageId: string; stageKind: StageKind; wonAt: Date | null; lostAt: Date | null };
  to: { id: string; kind: StageKind; probability: number };
  lostReason?: { id: string; name: string } | null;
  lostNote?: string | null;
  now: Date;
}

export type MoveResult =
  | { ok: true; changed: false }
  | {
      ok: true;
      changed: true;
      data: {
        stageId: string;
        probability: number;
        stageChangedAt: Date;
        lastActivityAt: Date;
        wonAt: Date | null;
        lostAt: Date | null;
        lostReasonId: string | null;
        lostNote: string | null;
      };
    }
  | { ok: false; error: string; field?: "lostReasonId" | "lostNote" };

/**
 * Rules for a stage change:
 * - Lost needs a lost reason. "Other" also needs a short note.
 * - Probability resets to the new stage's default.
 * - Moving away from Won or Lost (re-opening) clears the won / lost details.
 */
export function moveDeal(i: MoveInput): MoveResult {
  if (i.current.stageId === i.to.id) return { ok: true, changed: false };
  let lostReasonId: string | null = null;
  let lostNote: string | null = null;
  if (i.to.kind === "LOST") {
    if (!i.lostReason) return { ok: false, error: "Choose why the deal was lost.", field: "lostReasonId" };
    lostReasonId = i.lostReason.id;
    lostNote = i.lostNote?.trim() || null;
    if (i.lostReason.name.toLowerCase() === "other" && !lostNote) return { ok: false, error: "Add a short note when the reason is Other.", field: "lostNote" };
  }
  return {
    ok: true,
    changed: true,
    data: {
      stageId: i.to.id,
      probability: i.to.probability,
      stageChangedAt: i.now,
      lastActivityAt: i.now,
      wonAt: i.to.kind === "WON" ? i.now : null,
      lostAt: i.to.kind === "LOST" ? i.now : null,
      lostReasonId,
      lostNote,
    },
  };
}

// ---------------- Estimates from the catalog ----------------

export interface PlanForEstimate {
  priceType: "ONE_TIME" | "MONTHLY" | "PER_UNIT" | "PER_MINUTE" | "PER_SMS_TIERED" | "MARGIN_PERCENT";
  billingFrequency: "ONE_TIME" | "MONTHLY";
  unitPrice: number | null;
  tiers: Tier[];
}

/**
 * A starting estimate for a deal line from the catalog price. Sales can change it.
 * Per-minute plans have no estimate (usage is not known yet).
 */
export function planEstimate(plan: PlanForEstimate, qty: number): { oneTimeValue: number; monthlyValue: number } | null {
  if (!(qty > 0)) return null;
  let total: number | null = null;
  switch (plan.priceType) {
    case "ONE_TIME":
    case "MONTHLY":
    case "PER_UNIT":
      total = plan.unitPrice === null ? null : roundMoney(plan.unitPrice * qty);
      break;
    case "PER_SMS_TIERED":
      total = volumePrice(plan.tiers, qty)?.total ?? null;
      break;
    default:
      return null;
  }
  if (total === null) return null;
  const monthly = plan.priceType === "MONTHLY" || (plan.priceType !== "ONE_TIME" && plan.billingFrequency === "MONTHLY");
  return monthly ? { oneTimeValue: 0, monthlyValue: total } : { oneTimeValue: total, monthlyValue: 0 };
}
