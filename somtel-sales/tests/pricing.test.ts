import { describe, expect, it } from "vitest";
import { bandFor, roundMoney, validateTiers, volumePrice } from "@/lib/pricing";
import { SERVICES } from "../prisma/seed-data";

const smsTiers = SERVICES.find((s) => s.name === "A2P SMS")!.plans.find((p) => p.priceType === "PER_SMS_TIERED")!.tiers!;

describe("A2P SMS volume bands (seed price card)", () => {
  it("charges ALL SMS at the band the total falls in: 40,000 x $0.02 = $800", () => {
    expect(volumePrice(smsTiers, 40_000)).toEqual({ unitPrice: 0.02, total: 800 });
  });

  it.each([
    [1, 0.03],
    [10_000, 0.03],
    [10_001, 0.025],
    [30_000, 0.025],
    [30_001, 0.02],
    [60_000, 0.02],
    [60_001, 0.015],
    [1_000_000, 0.015],
  ])("%i SMS is charged at $%f each", (qty, rate) => {
    expect(bandFor(smsTiers, qty)?.unitPrice).toBe(rate);
  });

  it("does not use graduated pricing", () => {
    // Graduated would be 10,000 x 0.03 + 20,000 x 0.025 + 10,000 x 0.02 = 1,000
    expect(volumePrice(smsTiers, 40_000)!.total).not.toBe(1000);
  });

  it("returns nothing for zero or negative quantity", () => {
    expect(volumePrice(smsTiers, 0)).toBeNull();
    expect(volumePrice(smsTiers, -5)).toBeNull();
  });
});

describe("price band validation", () => {
  it("accepts the seed SMS bands", () => {
    expect(validateTiers(smsTiers)).toEqual([]);
  });
  it("rejects a gap between bands", () => {
    const errs = validateTiers([
      { fromQty: 1, toQty: 100, unitPrice: 1 },
      { fromQty: 102, toQty: null, unitPrice: 0.5 },
    ]);
    expect(errs.join(" ")).toMatch(/must start at 101/);
  });
  it("rejects overlapping bands", () => {
    expect(
      validateTiers([
        { fromQty: 1, toQty: 100, unitPrice: 1 },
        { fromQty: 50, toQty: null, unitPrice: 0.5 },
      ]).length,
    ).toBeGreaterThan(0);
  });
  it("requires the first band to start at 1 and the last to be open ended", () => {
    const errs = validateTiers([{ fromQty: 5, toQty: 10, unitPrice: 1 }]);
    expect(errs).toContain("The first band must start at 1.");
    expect(errs).toContain("The last band must have no upper limit.");
  });
  it("rejects an empty list", () => {
    expect(validateTiers([])).toEqual(["Add at least one price band."]);
  });
});

describe("money rounding", () => {
  it("rounds half away from zero without float drift", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(140.5)).toBe(140.5);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(-1.005)).toBe(-1.01);
  });
});

describe("seed price cards match the brief", () => {
  const plan = (service: string, name: string) => SERVICES.find((s) => s.name === service)!.plans.find((p) => p.name === name)!;
  it("A2P setup is $100 one-time", () => {
    expect(plan("A2P SMS", "API setup")).toMatchObject({ priceType: "ONE_TIME", unitPrice: 100 });
  });
  it("short codes are $20 and $60 per month with 4 IVR extensions", () => {
    expect(plan("Hosted IVR / Short Code", "4-digit short code")).toMatchObject({ priceType: "MONTHLY", unitPrice: 20, includedUnits: 4 });
    expect(plan("Hosted IVR / Short Code", "3-digit short code")).toMatchObject({ priceType: "MONTHLY", unitPrice: 60, includedUnits: 4 });
    expect(plan("Hosted IVR / Short Code", "Extra IVR extension")).toMatchObject({ unitPrice: 5 });
    expect(plan("Hosted IVR / Short Code", "Local call minutes")).toMatchObject({ priceType: "PER_MINUTE", unitPrice: 0.02 });
    expect(plan("Hosted IVR / Short Code", "Wireless landline device")).toMatchObject({ unitPrice: 40, billingFrequency: "ONE_TIME" });
  });
  it("tracking platform fee is $1.40 per vehicle per month", () => {
    expect(plan("Tracking platform", "Platform fee")).toMatchObject({ priceType: "MONTHLY", unitPrice: 1.4, unitLabel: "vehicle" });
  });
});
