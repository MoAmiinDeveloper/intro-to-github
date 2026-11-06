import { describe, expect, it } from "vitest";
import { SETTINGS, SETTINGS_BY_KEY, parseSettingInput, validateSettingsTogether, type SettingValue } from "@/lib/settings-registry";

const def = (k: string) => SETTINGS_BY_KEY.get(k)!;

describe("setting defaults from the brief", () => {
  it.each([
    ["costing.markupLicencePct", 10],
    ["costing.markupHardwarePct", 20],
    ["costing.remittancePct", 0.4],
    ["costing.bankChargePct", 0.9],
    ["quotes.validityDefaultDays", 10],
    ["quotes.validityMaxDays", 15],
    ["pipeline.staleDays", 30],
    ["pipeline.followUpDays", 3],
    ["tracking.platformFeeMonthly", 1.4],
    ["orders.billingStartRule", "ACTIVATION"],
    ["orders.clientSignOffRequired", false],
  ])("%s defaults to %s", (key, value) => {
    expect(def(key).default).toBe(value);
  });
  it("markup floors and VAT start as not set", () => {
    expect(def("costing.floorLicencePct").default).toBeNull();
    expect(def("costing.floorHardwarePct").default).toBeNull();
    expect(def("quotes.vatPct").default).toBeNull();
  });
});

describe("parsing setting input", () => {
  it("accepts an empty optional value as not set", () => {
    expect(parseSettingInput(def("quotes.vatPct"), "")).toEqual({ ok: true, value: null });
  });
  it("requires required values", () => {
    expect(parseSettingInput(def("costing.bankChargePct"), "").ok).toBe(false);
  });
  it("rejects text in number fields and enforces limits", () => {
    expect(parseSettingInput(def("costing.bankChargePct"), "abc").ok).toBe(false);
    expect(parseSettingInput(def("costing.bankChargePct"), "-1").ok).toBe(false);
    expect(parseSettingInput(def("pipeline.staleDays"), "2.5").ok).toBe(false);
    expect(parseSettingInput(def("costing.bankChargePct"), "0.9")).toEqual({ ok: true, value: 0.9 });
  });
  it("parses working days", () => {
    expect(parseSettingInput(def("orders.workingDays"), ["6", "0", "1"])).toEqual({ ok: true, value: [0, 1, 6] });
    expect(parseSettingInput(def("orders.workingDays"), []).ok).toBe(false);
  });
  it("checks the renewal alert list and order number format", () => {
    expect(parseSettingInput(def("renewals.alertDays"), "90,60,30").ok).toBe(true);
    expect(parseSettingInput(def("renewals.alertDays"), "90,sixty").ok).toBe(false);
    expect(parseSettingInput(def("orders.numberFormat"), "ORD-{YYYY}").ok).toBe(false);
  });
});

describe("cross-field checks", () => {
  const base = () => new Map<string, SettingValue>(SETTINGS.map((s) => [s.key, s.default]));
  it("default validity cannot be above the maximum", () => {
    const v = base();
    v.set("quotes.validityDefaultDays", 20);
    expect(validateSettingsTogether(v)).toHaveProperty("quotes.validityDefaultDays");
  });
  it("the markup floor must be lower than the default markup", () => {
    const v = base();
    v.set("costing.floorHardwarePct", 25);
    expect(validateSettingsTogether(v)).toHaveProperty("costing.floorHardwarePct");
    v.set("costing.floorHardwarePct", 12);
    expect(validateSettingsTogether(v)).toEqual({});
  });
});
