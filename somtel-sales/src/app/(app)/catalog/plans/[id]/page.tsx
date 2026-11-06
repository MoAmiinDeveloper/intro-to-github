import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmit } from "@/components/ui/form";
import { deletePlanAction } from "../../actions";
import { PlanForm } from "./plan-form";

export const metadata = { title: "Plan" };

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ service?: string }> }) {
  const { id } = await params;
  const { service: serviceParam } = await searchParams;
  await requirePermission("catalog.manage");
  const plan = id === "new" ? null : await prisma.plan.findFirst({ where: { id, deletedAt: null }, include: { tiers: { orderBy: { fromQty: "asc" } } } });
  if (id !== "new" && !plan) notFound();
  const service = await prisma.service.findFirst({ where: { id: plan?.serviceId ?? serviceParam ?? "", deletedAt: null } });
  if (!service) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={plan ? `Edit ${plan.name}` : "New plan"}
        breadcrumbs={[{ label: "Catalog", href: "/catalog" }, { label: service.name, href: `/catalog/services/${service.id}` }, { label: plan ? plan.name : "New plan" }]}
        actions={
          plan && (
            <form action={deletePlanAction}>
              <input type="hidden" name="id" value={plan.id} />
              <ConfirmSubmit variant="outline" className="text-red-600" message={`Delete plan ${plan.name}?`} pendingText="Deleting...">
                <Trash2 className="h-4 w-4" /> Delete plan
              </ConfirmSubmit>
            </form>
          )
        }
      />
      <PlanForm
        serviceId={service.id}
        values={
          plan
            ? {
                id: plan.id,
                name: plan.name,
                description: plan.description,
                priceType: plan.priceType,
                billingFrequency: plan.billingFrequency,
                unitPrice: plan.unitPrice?.toString() ?? "",
                unitLabel: plan.unitLabel,
                includedUnits: plan.includedUnits?.toString() ?? "",
                includedLabel: plan.includedLabel,
                marginPct: plan.marginPct?.toString() ?? "",
                active: plan.active,
                sortOrder: plan.sortOrder,
                tiers: plan.tiers.map((t) => ({ fromQty: String(t.fromQty), toQty: t.toQty === null ? "" : String(t.toQty), unitPrice: t.unitPrice.toString() })),
              }
            : { priceType: service.productType === "IT" ? "MARGIN_PERCENT" : "MONTHLY", billingFrequency: "MONTHLY", active: true, sortOrder: 0, tiers: [] }
        }
      />
    </div>
  );
}
