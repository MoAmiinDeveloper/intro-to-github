/**
 * Every business number that might change lives here, not in code.
 * The settings screen is built from this list. Values are stored in the Setting table;
 * if a key is not stored yet the default below is used.
 */

export type SettingType = "percent" | "integer" | "money" | "boolean" | "select" | "weekdays" | "text";

export interface SettingDef {
  key: string;
  group: SettingGroup;
  label: string;
  help?: string;
  type: SettingType;
  /** null means "not set". Only allowed when `optional` is true. */
  default: number | boolean | string | number[] | null;
  optional?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
}

export const SETTING_GROUPS = {
  costing: "Costing and margins",
  quotes: "Quotes and proposals",
  pipeline: "Pipeline timers",
  orders: "Orders and billing",
  tracking: "Vehicle tracking",
  renewals: "Renewals",
} as const;
export type SettingGroup = keyof typeof SETTING_GROUPS;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const SETTINGS: SettingDef[] = [
  // Costing
  { key: "costing.markupLicencePct", group: "costing", label: "Default markup for licences (%)", type: "percent", default: 10, min: 0, max: 1000 },
  { key: "costing.markupHardwarePct", group: "costing", label: "Default markup for hardware (%)", type: "percent", default: 20, min: 0, max: 1000 },
  {
    key: "costing.floorLicencePct",
    group: "costing",
    label: "Minimum markup for licences (%)",
    help: "Below this, the quote needs Manager approval. Leave empty if not set yet.",
    type: "percent",
    default: null,
    optional: true,
    min: 0,
    max: 1000,
  },
  {
    key: "costing.floorHardwarePct",
    group: "costing",
    label: "Minimum markup for hardware (%)",
    help: "Below this, the quote needs Manager approval. Leave empty if not set yet.",
    type: "percent",
    default: null,
    optional: true,
    min: 0,
    max: 1000,
  },
  { key: "costing.remittancePct", group: "costing", label: "Remittance (% of supplier cost)", type: "percent", default: 0.4, min: 0, max: 100 },
  { key: "costing.bankChargePct", group: "costing", label: "Bank charges (% of supplier cost)", type: "percent", default: 0.9, min: 0, max: 100 },

  // Quotes
  {
    key: "quotes.vatPct",
    group: "quotes",
    label: "VAT (%)",
    help: "Used when VAT is switched on for a quote. Leave empty until confirmed; the VAT switch stays off until it is set.",
    type: "percent",
    default: null,
    optional: true,
    min: 0,
    max: 100,
  },
  { key: "quotes.validityDefaultDays", group: "quotes", label: "Default validity (days)", type: "integer", default: 10, min: 1, max: 365 },
  { key: "quotes.validityMaxDays", group: "quotes", label: "Maximum validity (days)", type: "integer", default: 15, min: 1, max: 365 },

  // Pipeline
  { key: "pipeline.staleDays", group: "pipeline", label: "Mark a deal as stale after (days with no activity)", type: "integer", default: 30, min: 1, max: 365 },
  { key: "pipeline.followUpDays", group: "pipeline", label: "Remind owner when a sent quote has no activity after (days)", type: "integer", default: 3, min: 1, max: 60 },

  // Orders
  {
    key: "orders.workingDays",
    group: "orders",
    label: "Working week",
    help: "Used to count working days spent in each order stage.",
    type: "weekdays",
    default: [6, 0, 1, 2, 3, 4],
  },
  {
    key: "orders.billingStartRule",
    group: "orders",
    label: "Billing starts on",
    type: "select",
    default: "ACTIVATION",
    options: [
      { value: "ACTIVATION", label: "Activation date" },
      { value: "CONTRACT", label: "Contract signed date" },
    ],
  },
  { key: "orders.clientSignOffRequired", group: "orders", label: "Client sign-off required after activation", type: "boolean", default: false },
  {
    key: "orders.numberFormat",
    group: "orders",
    label: "Order number format",
    help: "{YYYY} is the year, {SEQ4} is a 4 digit number that restarts each year.",
    type: "text",
    default: "ORD-{YYYY}-{SEQ4}",
  },

  // Tracking
  { key: "tracking.platformFeeMonthly", group: "tracking", label: "Platform fee per vehicle per month (USD)", type: "money", default: 1.4, min: 0, max: 10000 },

  // Renewals
  {
    key: "renewals.alertDays",
    group: "renewals",
    label: "Renewal alerts (days before expiry, comma separated)",
    type: "text",
    default: "90,60,30",
  },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS.map((s) => [s.key, s]));

export type SettingValue = number | boolean | string | number[] | null;

/** Parse a raw form value for a setting. Returns an error message if invalid. */
export function parseSettingInput(def: SettingDef, raw: string | string[] | null | undefined):
  | { ok: true; value: SettingValue }
  | { ok: false; error: string } {
  const str = Array.isArray(raw) ? raw : (raw ?? "").toString().trim();

  switch (def.type) {
    case "percent":
    case "money":
    case "integer": {
      const s = str as string;
      if (s === "") {
        return def.optional ? { ok: true, value: null } : { ok: false, error: "This value is required." };
      }
      const n = Number(s);
      if (!Number.isFinite(n)) return { ok: false, error: "Enter a number." };
      if (def.type === "integer" && !Number.isInteger(n)) return { ok: false, error: "Enter a whole number." };
      if (def.min !== undefined && n < def.min) return { ok: false, error: `Must be ${def.min} or more.` };
      if (def.max !== undefined && n > def.max) return { ok: false, error: `Must be ${def.max} or less.` };
      return { ok: true, value: n };
    }
    case "boolean":
      return { ok: true, value: str === "on" || str === "true" };
    case "select": {
      const s = str as string;
      if (!def.options?.some((o) => o.value === s)) return { ok: false, error: "Choose an option." };
      return { ok: true, value: s };
    }
    case "weekdays": {
      const list = (Array.isArray(str) ? str : str ? [str] : []).map(Number);
      if (list.length === 0) return { ok: false, error: "Choose at least one working day." };
      if (list.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return { ok: false, error: "Invalid day." };
      return { ok: true, value: [...new Set(list)].sort((a, b) => a - b) };
    }
    case "text": {
      const s = str as string;
      if (s === "" && !def.optional) return { ok: false, error: "This value is required." };
      if (def.key === "renewals.alertDays") {
        const parts = s.split(",").map((p) => Number(p.trim()));
        if (parts.some((p) => !Number.isInteger(p) || p <= 0)) {
          return { ok: false, error: "Enter whole numbers separated by commas, for example 90,60,30." };
        }
      }
      if (def.key === "orders.numberFormat" && !s.includes("{SEQ")) {
        return { ok: false, error: "The format must include {SEQ4} (or {SEQ5}, {SEQ6})." };
      }
      return { ok: true, value: s };
    }
  }
}

/** Cross-field checks after every field is parsed. */
export function validateSettingsTogether(values: Map<string, SettingValue>): Record<string, string> {
  const errors: Record<string, string> = {};
  const def = values.get("quotes.validityDefaultDays");
  const max = values.get("quotes.validityMaxDays");
  if (typeof def === "number" && typeof max === "number" && def > max) {
    errors["quotes.validityDefaultDays"] = "Default validity cannot be more than the maximum.";
  }
  const pairs: [string, string][] = [
    ["costing.floorLicencePct", "costing.markupLicencePct"],
    ["costing.floorHardwarePct", "costing.markupHardwarePct"],
  ];
  for (const [floorKey, defaultKey] of pairs) {
    const floor = values.get(floorKey);
    const dflt = values.get(defaultKey);
    if (typeof floor === "number" && typeof dflt === "number" && floor > dflt) {
      errors[floorKey] = "The minimum must be lower than the default markup.";
    }
  }
  return errors;
}
