/**
 * Catalog pricing rules. Pure functions so they can be unit tested.
 */

export interface Tier {
  fromQty: number;
  toQty: number | null;
  unitPrice: number;
}

/**
 * Volume banding: ALL units are charged at the rate of the band the total quantity falls in.
 * Example (A2P SMS): 40,000 SMS falls in 30,001 to 60,000 at $0.02, so 40,000 x $0.02 = $800.
 */
export function bandFor(tiers: readonly Tier[], qty: number): Tier | null {
  if (qty <= 0) return null;
  return tiers.find((t) => qty >= t.fromQty && (t.toQty === null || qty <= t.toQty)) ?? null;
}

export function volumePrice(tiers: readonly Tier[], qty: number): { unitPrice: number; total: number } | null {
  const band = bandFor(tiers, qty);
  if (!band) return null;
  return { unitPrice: band.unitPrice, total: roundMoney(band.unitPrice * qty) };
}

/**
 * Tiers must start at 1, not overlap, have no gaps, and only the last may be open ended.
 * Returns a list of problems (empty if fine).
 */
export function validateTiers(tiers: readonly Tier[]): string[] {
  const errors: string[] = [];
  if (tiers.length === 0) return ["Add at least one price band."];
  const sorted = [...tiers].sort((a, b) => a.fromQty - b.fromQty);
  if (sorted[0]!.fromQty !== 1) errors.push("The first band must start at 1.");
  sorted.forEach((t, i) => {
    const n = i + 1;
    if (!Number.isInteger(t.fromQty) || t.fromQty < 1) errors.push(`Band ${n}: "from" must be a whole number of 1 or more.`);
    if (t.toQty !== null && (!Number.isInteger(t.toQty) || t.toQty < t.fromQty))
      errors.push(`Band ${n}: "to" must be a whole number not less than "from".`);
    if (!(t.unitPrice >= 0)) errors.push(`Band ${n}: price must be 0 or more.`);
    const next = sorted[i + 1];
    if (next) {
      if (t.toQty === null) errors.push(`Band ${n}: only the last band can have no upper limit.`);
      else if (next.fromQty !== t.toQty + 1)
        errors.push(`Band ${n + 1} must start at ${t.toQty + 1} (right after band ${n}) with no gap or overlap.`);
    }
  });
  if (sorted[sorted.length - 1]!.toQty !== null) errors.push("The last band must have no upper limit.");
  return errors;
}

/** Round to cents, half away from zero, avoiding float drift (1.005 -> 1.01). */
export function roundMoney(n: number): number {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 100 + 1e-8)) / 100;
}

export const PRICE_TYPE_LABELS = {
  ONE_TIME: "One-time",
  MONTHLY: "Monthly",
  PER_UNIT: "Per unit",
  PER_MINUTE: "Per minute",
  PER_SMS_TIERED: "Per SMS (volume bands)",
  MARGIN_PERCENT: "Markup % (resale)",
} as const;

export const PRODUCT_TYPE_LABELS = { IT: "IT (vendor resale)", NON_IT: "Non-IT (Somtel service)", TRACKING: "Vehicle tracking" } as const;
export const ITEM_KIND_LABELS = { LICENCE: "Licence", HARDWARE: "Hardware", SERVICE: "Service" } as const;
export const BILLING_FREQUENCY_LABELS = { ONE_TIME: "One-time", MONTHLY: "Monthly" } as const;
