import type { PriceTier, Plan } from "@prisma/client";
import { formatMoney, formatNumber, toNumber } from "./utils";

type PlanLike = Pick<Plan, "priceType" | "billingFrequency" | "unitPrice" | "unitLabel" | "includedUnits" | "includedLabel" | "marginPct"> & {
  tiers?: Pick<PriceTier, "fromQty" | "toQty" | "unitPrice">[];
};

/** Short, plain description of a plan's price, for lists. */
export function planPriceSummary(plan: PlanLike): string {
  const price = formatMoney(plan.unitPrice);
  const unit = plan.unitLabel ? ` per ${plan.unitLabel}` : "";
  const included = plan.includedUnits ? `, includes ${plan.includedUnits} ${plan.includedLabel ?? "units"}` : "";
  switch (plan.priceType) {
    case "ONE_TIME":
      return `${price} one-time${unit}${included}`;
    case "MONTHLY":
      return `${price}${unit} per month${included}`;
    case "PER_UNIT":
      return `${price}${unit || " each"}${plan.billingFrequency === "MONTHLY" ? " per month" : ""}${included}`;
    case "PER_MINUTE":
      return `${price} per minute`;
    case "PER_SMS_TIERED": {
      const tiers = [...(plan.tiers ?? [])].sort((a, b) => a.fromQty - b.fromQty);
      if (tiers.length === 0) return "No price bands set";
      return tiers.map((t) => `${bandLabel(t.fromQty, t.toQty)}: ${formatMoney(t.unitPrice)}`).join(" | ");
    }
    case "MARGIN_PERCENT": {
      const own = toNumber(plan.marginPct);
      return own !== null ? `Markup ${own}% on supplier cost` : "Markup on supplier cost";
    }
  }
}

export function bandLabel(from: number, to: number | null) {
  if (to === null) return `Above ${formatNumber(from - 1)}`;
  if (from === 1) return `Up to ${formatNumber(to)}`;
  return `${formatNumber(from)} to ${formatNumber(to)}`;
}
