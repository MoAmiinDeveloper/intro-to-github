import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { hasPermission } from "@/lib/roles";
import { canEditDeal, dealScope } from "@/lib/deals";
import { dateKey } from "@/lib/pipeline";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../../deal-form";
import { updateDealAction } from "../../actions";
import { dealFormOptions } from "../../form-data";

export const metadata = { title: "Edit deal" };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("deals.view");
  const deal = await prisma.deal.findFirst({
    where: { AND: [{ id, deletedAt: null }, await dealScope(user)] },
    include: { products: { orderBy: { sortOrder: "asc" } }, client: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } } },
  });
  if (!deal || !(await canEditDeal(user, deal))) notFound();
  const opts = await dealFormOptions(user);
  if (!opts.entities.some((e) => e.id === deal.clientId)) opts.entities.unshift(deal.client);
  if (!opts.owners.some((o) => o.id === deal.ownerId)) opts.owners.unshift(deal.owner);
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Edit ${deal.title}`} breadcrumbs={[{ label: "Pipeline", href: "/pipeline" }, { label: deal.title, href: `/deals/${id}` }, { label: "Edit" }]} />
      <DealForm
        action={updateDealAction}
        values={{
          id: deal.id,
          title: deal.title,
          clientId: deal.clientId,
          productType: deal.productType,
          oneTimeValue: deal.oneTimeValue.toString(),
          monthlyValue: deal.monthlyValue.toString(),
          probability: String(deal.probability),
          expectedCloseDate: deal.expectedCloseDate ? dateKey(deal.expectedCloseDate) : "",
          nextFollowUpAt: deal.nextFollowUpAt ? dateKey(deal.nextFollowUpAt) : "",
          nextStep: deal.nextStep,
          ownerId: deal.ownerId,
          lines: deal.products.map((p) => ({
            item: p.planId ? `plan:${p.planId}` : p.subProductId ? `sub:${p.subProductId}` : "",
            description: p.description,
            quantity: p.quantity.toString(),
            oneTimeValue: p.oneTimeValue.toString(),
            monthlyValue: p.monthlyValue.toString(),
          })),
        }}
        entities={opts.entities}
        owners={opts.owners}
        catalog={opts.catalog}
        canAssignOwner={hasPermission(user.roles, "deals.assignOwner")}
        cancelHref={`/deals/${id}`}
      />
    </div>
  );
}
