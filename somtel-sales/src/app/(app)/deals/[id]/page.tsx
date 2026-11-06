import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getTeamIds, requirePermission } from "@/lib/session";
import { canEditDeal, dealScope } from "@/lib/deals";
import { getSetting } from "@/lib/settings";
import { daysSince, followUpBucket, isStale, todayIn, weighted } from "@/lib/pipeline";
import { hasRole } from "@/lib/roles";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StageMover } from "@/components/deals/stage-mover";
import { ActivityForm } from "@/components/deals/activity-form";
import { ActivityList } from "@/components/deals/activity-list";
import { FollowUpBadge, PRODUCT_TYPE_SHORT, PRODUCT_TYPE_TONE, StaleBadge } from "@/components/deals/badges";
import { deleteDealAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await prisma.deal.findUnique({ where: { id }, select: { title: true } });
  return { title: d?.title ?? "Deal" };
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("deals.view");
  const deal = await prisma.deal.findFirst({
    where: { AND: [{ id, deletedAt: null }, await dealScope(user)] },
    include: {
      client: { include: { group: true } },
      stage: true,
      owner: { select: { name: true } },
      lostReason: true,
      products: { orderBy: { sortOrder: "asc" } },
      activities: { where: { deletedAt: null }, orderBy: { occurredAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!deal) notFound();
  const [editable, stages, lostReasons, staleDays, team] = await Promise.all([
    canEditDeal(user, deal),
    prisma.pipelineStage.findMany({ where: { OR: [{ active: true }, { id: deal.stageId }] }, orderBy: { sortOrder: "asc" } }),
    prisma.lostReason.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getSetting<number>("pipeline.staleDays"),
    getTeamIds(user.id),
  ]);
  const now = new Date();
  const oneTime = Number(deal.oneTimeValue);
  const monthly = Number(deal.monthlyValue);
  const stale = isStale({ stageKind: deal.stage.kind, lastActivityAt: deal.lastActivityAt }, staleDays, now);
  const bucket = deal.nextFollowUpAt && deal.stage.kind === "OPEN" ? followUpBucket(deal.nextFollowUpAt, todayIn(now)) : null;
  const canDeleteActivity = (a: { userId: string }) => a.userId === user.id || hasRole(user.roles, "ADMIN", "HEAD_OF_ENTERPRISE") || team.includes(a.userId);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Pipeline", href: "/pipeline" }, { label: deal.title }]}
        title={deal.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/clients/${deal.clientId}?tab=deals`} className="text-navy hover:underline">
              {deal.client.name}
            </Link>
            {deal.client.group && (
              <>
                <span>·</span>
                <Link href={`/clients/groups/${deal.client.group.id}`} className="hover:underline">
                  {deal.client.group.name}
                </Link>
              </>
            )}
            <span>· Owner: {deal.owner.name}</span>
            <Badge tone={PRODUCT_TYPE_TONE[deal.productType]}>{PRODUCT_TYPE_SHORT[deal.productType]}</Badge>
            {stale && <StaleBadge days={daysSince(deal.lastActivityAt, now)} />}
            {bucket && <FollowUpBadge bucket={bucket} />}
          </span>
        }
        actions={
          editable && (
            <>
              <Link href={`/deals/${id}/edit`} className={buttonClass("outline")}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
              <form action={deleteDealAction}>
                <input type="hidden" name="id" value={id} />
                <ConfirmSubmit variant="outline" className="text-red-600" message={`Delete deal ${deal.title}?`} pendingText="Deleting...">
                  <Trash2 className="h-4 w-4" /> Delete
                </ConfirmSubmit>
              </form>
            </>
          )
        }
      />

      <Card className="mb-5 p-4">
        <StageMover dealId={id} stageId={deal.stageId} stages={stages} lostReasons={lostReasons} editable={editable} />
        {deal.stage.kind === "LOST" && deal.lostReason && (
          <p className="mt-3 text-sm text-red-700">
            Lost on {formatDate(deal.lostAt)}: <strong>{deal.lostReason.name}</strong>
            {deal.lostNote && ` (${deal.lostNote})`}
          </p>
        )}
        {deal.stage.kind === "WON" && <p className="mt-3 text-sm text-green-700">Won on {formatDate(deal.wonAt)}.</p>}
      </Card>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="One-time value" value={formatMoney(oneTime)} sub={`Weighted ${formatMoney(weighted(oneTime, deal.probability))}`} />
        <Stat label="Monthly value (MRR)" value={formatMoney(monthly)} sub={`Weighted ${formatMoney(weighted(monthly, deal.probability))}`} />
        <Stat label="Win probability" value={`${deal.probability}%`} sub={`Stage default ${deal.stage.probability}%`} />
        <Stat label="Expected close" value={deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "Not set"} sub={`Last activity ${formatDateTime(deal.lastActivityAt)}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardHeader title="Next step" />
            <CardBody className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-gray-500">Next step</div>
                <div>{deal.nextStep || <span className="text-gray-400">Not set</span>}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Next follow-up</div>
                <div>{deal.nextFollowUpAt ? formatDate(deal.nextFollowUpAt) : <span className="text-gray-400">Not set</span>}</div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Products" description={deal.products.length ? "Estimated values. The quote sets the final prices." : undefined} />
            {deal.products.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">No products added. The values above were typed in directly.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Product</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="text-right">One-time</TH>
                    <TH className="text-right">Monthly</TH>
                  </tr>
                </THead>
                <TBody>
                  {deal.products.map((p) => (
                    <TR key={p.id}>
                      <TD>{p.description}</TD>
                      <TD className="text-right">{formatNumber(p.quantity.toString())}</TD>
                      <TD className="text-right">{formatMoney(p.oneTimeValue.toString())}</TD>
                      <TD className="text-right">{formatMoney(p.monthlyValue.toString())}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
          <Card>
            <CardHeader title="Activity" />
            <CardBody>
              <ActivityList items={deal.activities} canDelete={canDeleteActivity} />
            </CardBody>
          </Card>
        </div>
        <div className="lg:col-span-2">
          {editable && (
            <Card>
              <CardHeader title="Log activity" description="Calls, meetings, emails and notes keep the deal from going stale." />
              <CardBody>
                <ActivityForm dealId={id} followUp={deal.nextFollowUpAt?.toISOString().slice(0, 10)} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="border-l-4 border-l-gold p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-navy">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </Card>
  );
}
