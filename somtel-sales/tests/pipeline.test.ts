import { describe, expect, it } from "vitest";
import { addDays, followUpBucket, isStale, moveDeal, planEstimate, todayIn, totals, valuesFromLines, weighted } from "@/lib/pipeline";
import { localHour } from "@/lib/reminders";
import { SERVICES } from "../prisma/seed-data";

describe("weighted value = value x probability", () => {
  it("works on one-time and monthly values separately", () => {
    expect(weighted(2450, 75)).toBe(1837.5);
    expect(weighted(84, 50)).toBe(42);
    expect(weighted(1000, 0)).toBe(0);
  });
  it("totals a list of deals", () => {
    const t = totals([
      { oneTimeValue: 1000, monthlyValue: 100, probability: 50 },
      { oneTimeValue: 2000, monthlyValue: 0, probability: 25 },
    ]);
    expect(t).toEqual({ count: 2, oneTime: 3000, monthly: 100, weightedOneTime: 1000, weightedMonthly: 50 });
  });
  it("deal value is the sum of its product lines", () => {
    expect(valuesFromLines([{ oneTimeValue: 100, monthlyValue: 20 }, { oneTimeValue: 40.5, monthlyValue: 5 }])).toEqual({ oneTimeValue: 140.5, monthlyValue: 25 });
  });
});

describe("stale deals", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  it("an open deal with no activity for 30 days is stale", () => {
    expect(isStale({ stageKind: "OPEN", lastActivityAt: daysAgo(30) }, 30, now)).toBe(true);
    expect(isStale({ stageKind: "OPEN", lastActivityAt: daysAgo(29) }, 30, now)).toBe(false);
  });
  it("won and lost deals are never stale", () => {
    expect(isStale({ stageKind: "WON", lastActivityAt: daysAgo(90) }, 30, now)).toBe(false);
    expect(isStale({ stageKind: "LOST", lastActivityAt: daysAgo(90) }, 30, now)).toBe(false);
  });
  it("uses the days from settings", () => {
    expect(isStale({ stageKind: "OPEN", lastActivityAt: daysAgo(10) }, 7, now)).toBe(true);
  });
});

describe("follow-up dates (Hargeisa time)", () => {
  it("today is counted in the app time zone, not UTC", () => {
    // 22:30 UTC on 6 Nov is already 01:30 on 7 Nov in Hargeisa (UTC+3).
    expect(todayIn(new Date("2026-11-06T22:30:00Z"), "Africa/Mogadishu")).toBe("2026-11-07");
    expect(localHour(new Date("2026-11-06T04:00:00Z"), "Africa/Mogadishu")).toBe(7);
  });
  it("sorts follow-ups into overdue, today, next 7 days and later", () => {
    const d = (k: string) => new Date(`${k}T00:00:00Z`);
    expect(followUpBucket(d("2026-11-06"), "2026-11-07")).toBe("overdue");
    expect(followUpBucket(d("2026-11-07"), "2026-11-07")).toBe("today");
    expect(followUpBucket(d("2026-11-14"), "2026-11-07")).toBe("upcoming");
    expect(followUpBucket(d("2026-11-15"), "2026-11-07")).toBe("later");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("moving a deal between stages", () => {
  const now = new Date("2026-11-07T10:00:00Z");
  const open = { stageId: "qualified", stageKind: "OPEN" as const, wonAt: null, lostAt: null };
  const lostStage = { id: "lost", kind: "LOST" as const, probability: 0 };

  it("Lost needs a lost reason", () => {
    const r = moveDeal({ current: open, to: lostStage, now });
    expect(r).toMatchObject({ ok: false, field: "lostReasonId" });
  });
  it("reason Other also needs a note", () => {
    expect(moveDeal({ current: open, to: lostStage, lostReason: { id: "o", name: "Other" }, now })).toMatchObject({ ok: false, field: "lostNote" });
    expect(moveDeal({ current: open, to: lostStage, lostReason: { id: "o", name: "Other" }, lostNote: "Moved to a new office", now })).toMatchObject({ ok: true, changed: true });
  });
  it("records the lost reason and time", () => {
    const r = moveDeal({ current: open, to: lostStage, lostReason: { id: "price", name: "Price" }, now });
    expect(r).toMatchObject({ ok: true, changed: true, data: { lostReasonId: "price", lostAt: now, wonAt: null, probability: 0 } });
  });
  it("probability resets to the new stage default", () => {
    const r = moveDeal({ current: open, to: { id: "nego", kind: "OPEN", probability: 75 }, now });
    expect(r).toMatchObject({ ok: true, data: { probability: 75, lastActivityAt: now } });
  });
  it("re-opening a lost deal clears the lost details", () => {
    const r = moveDeal({ current: { stageId: "lost", stageKind: "LOST", wonAt: null, lostAt: now }, to: { id: "qualified", kind: "OPEN", probability: 25 }, now });
    expect(r).toMatchObject({ ok: true, data: { lostReasonId: null, lostNote: null, lostAt: null } });
  });
  it("Won sets the won date", () => {
    expect(moveDeal({ current: open, to: { id: "won", kind: "WON", probability: 100 }, now })).toMatchObject({ ok: true, data: { wonAt: now, probability: 100 } });
  });
  it("moving to the same stage changes nothing", () => {
    expect(moveDeal({ current: open, to: { id: "qualified", kind: "OPEN", probability: 25 }, now })).toEqual({ ok: true, changed: false });
  });
});

describe("estimates from the catalog", () => {
  const plan = (service: string, name: string) => {
    const p = SERVICES.find((s) => s.name === service)!.plans.find((x) => x.name === name)!;
    return { priceType: p.priceType, billingFrequency: p.billingFrequency, unitPrice: p.unitPrice ?? null, tiers: p.tiers ?? [] };
  };
  it("A2P SMS: 40,000 SMS = $800 one-time", () => {
    expect(planEstimate(plan("A2P SMS", "SMS bundle"), 40_000)).toEqual({ oneTimeValue: 800, monthlyValue: 0 });
  });
  it("short code is monthly", () => {
    expect(planEstimate(plan("Hosted IVR / Short Code", "3-digit short code"), 1)).toEqual({ oneTimeValue: 0, monthlyValue: 60 });
  });
  it("tracking: 60 vehicles x $1.40 = $84 per month", () => {
    expect(planEstimate(plan("Tracking platform", "Platform fee"), 60)).toEqual({ oneTimeValue: 0, monthlyValue: 84 });
  });
  it("devices are one-time", () => {
    expect(planEstimate(plan("Hosted IVR / Short Code", "Wireless landline device"), 3)).toEqual({ oneTimeValue: 120, monthlyValue: 0 });
  });
  it("per-minute plans have no estimate", () => {
    expect(planEstimate(plan("Hosted IVR / Short Code", "Local call minutes"), 1000)).toBeNull();
  });
});
