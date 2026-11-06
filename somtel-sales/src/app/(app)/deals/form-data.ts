import "server-only";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { clientScope } from "@/lib/clients";
import { assignableOwnerIds } from "@/lib/deals";
import { toNumber } from "@/lib/utils";

export interface CatalogOption {
  value: string; // "plan:<id>" or "sub:<id>"
  label: string;
  group: string;
  description: string;
  plan?: { priceType: string; billingFrequency: string; unitPrice: number | null; tiers: { fromQty: number; toQty: number | null; unitPrice: number }[] };
}

/** Everything the deal form needs: entities, owners and products from both catalogs. */
export async function dealFormOptions(user: CurrentUser) {
  const [entities, ownersAllowed, plans, subs, stages] = await Promise.all([
    prisma.client.findMany({
      where: { AND: [await clientScope(user), { deletedAt: null }] },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    assignableOwnerIds(user),
    prisma.plan.findMany({
      where: { deletedAt: null, active: true, service: { deletedAt: null, active: true, category: { enabled: true, deletedAt: null } } },
      include: { tiers: true, service: { include: { category: true } } },
      orderBy: [{ service: { category: { sortOrder: "asc" } } }, { service: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.itSubProduct.findMany({
      where: { deletedAt: null, active: true, product: { deletedAt: null, active: true, vendor: { deletedAt: null, active: true } } },
      include: { product: { include: { vendor: true } } },
      orderBy: [{ product: { vendor: { name: "asc" } } }, { product: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.pipelineStage.findMany({ where: { active: true, kind: "OPEN" }, orderBy: { sortOrder: "asc" } }),
  ]);
  const owners = await prisma.user.findMany({
    where: {
      active: true,
      deletedAt: null,
      ...(ownersAllowed === "all" ? { roles: { some: { role: { in: ["ACCOUNT_MANAGER", "MANAGER", "HEAD_OF_ENTERPRISE"] } } } } : { id: { in: ownersAllowed } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (!owners.some((o) => o.id === user.id)) owners.unshift({ id: user.id, name: user.name });

  const catalog: CatalogOption[] = [
    ...plans.map((p) => ({
      value: `plan:${p.id}`,
      label: `${p.service.name}: ${p.name}`,
      group: `Somtel services: ${p.service.category.name}`,
      description: `${p.service.name}, ${p.name}`,
      plan: {
        priceType: p.priceType,
        billingFrequency: p.billingFrequency,
        unitPrice: toNumber(p.unitPrice),
        tiers: p.tiers.map((t) => ({ fromQty: t.fromQty, toQty: t.toQty, unitPrice: Number(t.unitPrice) })),
      },
    })),
    ...subs.map((s) => ({
      value: `sub:${s.id}`,
      label: `${s.product.name}: ${s.name}`,
      group: `IT: ${s.product.vendor.name}`,
      description: s.quoteDescription || `${s.product.vendor.name} ${s.name}`,
    })),
  ];

  return {
    entities: entities.map((e) => ({ id: e.id, name: e.group ? `${e.name} (${e.group.name})` : e.name })),
    owners,
    catalog,
    stages: stages.map((s) => ({ id: s.id, name: s.name, probability: s.probability })),
  };
}
