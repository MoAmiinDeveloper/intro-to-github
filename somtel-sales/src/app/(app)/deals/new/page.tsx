import { requirePermission } from "@/lib/session";
import { hasPermission } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../deal-form";
import { createDealAction } from "../actions";
import { dealFormOptions } from "../form-data";

export const metadata = { title: "New deal" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ client?: string; stage?: string }> }) {
  const sp = await searchParams;
  const user = await requirePermission("deals.create");
  const opts = await dealFormOptions(user);
  return (
    <div className="max-w-5xl">
      <PageHeader title="New deal" breadcrumbs={[{ label: "Pipeline", href: "/pipeline" }, { label: "New deal" }]} />
      <DealForm
        action={createDealAction}
        values={{ clientId: sp.client, stageId: sp.stage, ownerId: user.id, lines: [] }}
        entities={opts.entities}
        owners={opts.owners}
        catalog={opts.catalog}
        stages={opts.stages}
        canAssignOwner={hasPermission(user.roles, "deals.assignOwner")}
        cancelHref={sp.client ? `/clients/${sp.client}?tab=deals` : "/pipeline"}
      />
    </div>
  );
}
