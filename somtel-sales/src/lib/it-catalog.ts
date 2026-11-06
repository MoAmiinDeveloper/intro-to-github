/**
 * IT catalog rules. Pure functions so they can be unit tested.
 */

export interface CostRow {
  id: string;
  distributorId: string;
  unitCost: number;
  exchangeRate: number;
  quotedAt: Date;
  createdAt: Date;
}

/** Supplier cost in USD. The rate is "1 USD = rate x currency" (AED 3.6725). */
export function costInUsd(unitCost: number, exchangeRate: number): number {
  if (!(exchangeRate > 0)) throw new Error("Exchange rate must be more than 0.");
  return unitCost / exchangeRate;
}

/** The latest cost from each distributor (by quote date, then entry time), cheapest first in USD. */
export function latestCostPerDistributor<T extends CostRow>(rows: readonly T[]): (T & { usd: number })[] {
  const latest = new Map<string, T>();
  for (const r of rows) {
    const cur = latest.get(r.distributorId);
    if (
      !cur ||
      r.quotedAt.getTime() > cur.quotedAt.getTime() ||
      (r.quotedAt.getTime() === cur.quotedAt.getTime() && r.createdAt.getTime() > cur.createdAt.getTime())
    )
      latest.set(r.distributorId, r);
  }
  return [...latest.values()].map((r) => ({ ...r, usd: costInUsd(r.unitCost, r.exchangeRate) })).sort((a, b) => a.usd - b.usd);
}

/** Markup for a sub-product: its own markup, or the default for hardware / software from settings. */
export function effectiveMarkup(own: number | null, kind: "HARDWARE" | "SOFTWARE", defaults: { hardware: number; software: number }): number {
  if (own !== null && own !== undefined) return own;
  return kind === "HARDWARE" ? defaults.hardware : defaults.software;
}

/** A cost can only be recorded from a distributor that carries the product's vendor. */
export function distributorCarriesVendor(links: readonly { vendorId: string; distributorId: string }[], vendorId: string, distributorId: string): boolean {
  return links.some((l) => l.vendorId === vendorId && l.distributorId === distributorId);
}

export const CURRENCIES = ["USD", "AED", "EUR", "GBP", "KES", "ETB"] as const;
