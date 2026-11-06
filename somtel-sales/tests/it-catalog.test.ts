import { describe, expect, it } from "vitest";
import { costInUsd, distributorCarriesVendor, effectiveMarkup, latestCostPerDistributor } from "@/lib/it-catalog";

const day = (d: string) => new Date(`${d}T00:00:00Z`);

describe("distributor costs", () => {
  it("converts AED to USD with the rate 1 USD = 3.6725 AED", () => {
    expect(costInUsd(367.25, 3.6725)).toBeCloseTo(100, 10);
    expect(costInUsd(640, 1)).toBe(640);
  });
  it("refuses a zero exchange rate", () => {
    expect(() => costInUsd(100, 0)).toThrow();
  });
  it("keeps only the latest cost per distributor and sorts cheapest first", () => {
    const rows = [
      { id: "a1", distributorId: "gulf", unitCost: 2400, exchangeRate: 3.6725, quotedAt: day("2026-09-01"), createdAt: day("2026-09-01") },
      { id: "a2", distributorId: "gulf", unitCost: 2200, exchangeRate: 3.6725, quotedAt: day("2026-10-20"), createdAt: day("2026-10-20") },
      { id: "b1", distributorId: "eatech", unitCost: 640, exchangeRate: 1, quotedAt: day("2026-10-01"), createdAt: day("2026-10-01") },
    ];
    const latest = latestCostPerDistributor(rows);
    expect(latest.map((r) => r.id)).toEqual(["a2", "b1"]); // 2200 AED = $599.05 < $640
    expect(latest[0]!.usd).toBeCloseTo(599.05, 2);
  });
  it("uses entry time when two costs have the same quote date", () => {
    const rows = [
      { id: "x1", distributorId: "d", unitCost: 10, exchangeRate: 1, quotedAt: day("2026-10-01"), createdAt: new Date("2026-10-01T08:00:00Z") },
      { id: "x2", distributorId: "d", unitCost: 12, exchangeRate: 1, quotedAt: day("2026-10-01"), createdAt: new Date("2026-10-01T09:00:00Z") },
    ];
    expect(latestCostPerDistributor(rows)[0]!.id).toBe("x2");
  });
});

describe("markup for a sub-product", () => {
  const defaults = { hardware: 20, software: 10 };
  it("uses the default for its kind when it has none", () => {
    expect(effectiveMarkup(null, "HARDWARE", defaults)).toBe(20);
    expect(effectiveMarkup(null, "SOFTWARE", defaults)).toBe(10);
  });
  it("uses its own markup when set, including 0", () => {
    expect(effectiveMarkup(50, "HARDWARE", defaults)).toBe(50);
    expect(effectiveMarkup(0, "SOFTWARE", defaults)).toBe(0);
  });
});

describe("vendor and distributor links", () => {
  const links = [
    { vendorId: "fortinet", distributorId: "gulf" },
    { vendorId: "fortinet", distributorId: "eatech" },
    { vendorId: "microsoft", distributorId: "eatech" },
  ];
  it("one vendor can have several distributors and one distributor several vendors", () => {
    expect(distributorCarriesVendor(links, "fortinet", "gulf")).toBe(true);
    expect(distributorCarriesVendor(links, "fortinet", "eatech")).toBe(true);
    expect(distributorCarriesVendor(links, "microsoft", "eatech")).toBe(true);
  });
  it("a cost cannot come from a distributor that does not carry the vendor", () => {
    expect(distributorCarriesVendor(links, "microsoft", "gulf")).toBe(false);
  });
});
