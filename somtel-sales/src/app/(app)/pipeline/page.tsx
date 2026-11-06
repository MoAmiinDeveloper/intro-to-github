import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Columns3, List, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { dealScope } from "@/lib/deals";
import { getSetting } from "@/lib/settings";
import { daysSince, followUpBucket, isStale, todayIn, totals, weighted } from "@/lib/pipeline";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FollowUpBadge, PRODUCT_TYPE_SHORT, PRODUCT_TYPE_TONE, StaleBadge } from "@/components/deals/badges";
import { PipelineBoard, type BoardColumn } from "./board";

export const metadata = { title: "Pipeline" };

const CLOSED_DAYS = 30;

type SP = {
  view?: string;
  q?: string;
  owner?: string;
  sector?: string;
  type?: string;
  stage?: string;
  status?: string;
  from?: string;
  to?: string;
  minOneTime?: string;
  minMonthly?: string;
  flag?: string;
  sort?: string;
};

const SORTS: Record<string, Prisma.DealOrderByWithRelationInput[]> = {
  close: [{ expectedCloseDate: { sort: "asc", nulls: "last" } }],
  value: [{ oneTimeValue: "desc" }, { monthlyValue: "desc" }],
  monthly: [{ monthlyValue: "desc" }],
  updated: [{ updatedAt: "desc" }],
  activity: [{ lastActivityAt: "asc" }],
};

export default async function PipelinePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requirePermission("deals.view");
  const view = sp.view === "table" ? "table" : "board";
  const now = new Date();
  const today = todayIn(now);
  const staleDays = await getSetting<number>("pipeline.staleDays");
  const q = sp.q?.trim();
  const type = sp.type === "IT" || sp.type === "NON_IT" || sp.type === "TRACKING" ? sp.type : undefined;
  const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const base: Prisma.DealWhereInput[] = [
    await dealScope(user),
    { deletedAt: null },
    q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }, { client: { group: { name: { contains: q, mode: "insensitive" } } } }] } : {},
    sp.owner ? { ownerId: sp.owner } : {},
    sp.sector ? { client: { sectorId: sp.sector } } : {},
    type ? { productType: type } : {},
    isDate(sp.from) || isDate(sp.to)
      ? { expectedCloseDate: { ...(isDate(sp.from) ? { gte: new Date(`${sp.from}T00:00:00Z`) } : {}), ...(isDate(sp.to) ? { lte: new Date(`${sp.to}T00:00:00Z`) } : {}) } }
      : {},
    Number(sp.minOneTime) > 0 ? { oneTimeValue: { gte: Number(sp.minOneTime) } } : {},
    Number(sp.minMonthly) > 0 ? { monthlyValue: { gte: Number(sp.minMonthly) } } : {},
    sp.flag === "stale" ? { stage: { kind: "OPEN" }, lastActivityAt: { lte: new Date(now.getTime() - staleDays * 86_400_000) } } : {},
    sp.flag === "followup" ? { stage: { kind: "OPEN" }, nextFollowUpAt: { lte: new Date(`${today}T00:00:00Z`) } } : {},
  ];

  const [stages, owners, sectors, lostReasons] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({ where: { deletedAt: null, ownedDeals: { some: { AND: [await dealScope(user), { deletedAt: null }] } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.sector.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.lostReason.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const include = { client: { select: { name: true } }, owner: { select: { name: true } }, stage: true } as const;
  const closedSince = new Date(now.getTime() - CLOSED_DAYS * 86_400_000);
  const deals =
    view === "board"
      ? await prisma.deal.findMany({
          where: {
            AND: [
              ...base,
              { OR: [{ stage: { kind: "OPEN" } }, { stage: { kind: "WON" }, wonAt: { gte: closedSince } }, { stage: { kind: "LOST" }, lostAt: { gte: closedSince } }] },
            ],
          },
          include,
          orderBy: [{ expectedCloseDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
          take: 1000,
        })
      : await prisma.deal.findMany({
          where: {
            AND: [
              ...base,
              sp.stage ? { stageId: sp.stage } : {},
              sp.status === "open" || !sp.status ? { stage: { kind: "OPEN" } } : sp.status === "won" ? { stage: { kind: "WON" } } : sp.status === "lost" ? { stage: { kind: "LOST" } } : {},
            ],
          },
          include,
          orderBy: SORTS[sp.sort ?? "close"] ?? SORTS.close,
          take: 1000,
        });

  const flags = (d: (typeof deals)[number]) => ({
    staleDays: isStale({ stageKind: d.stage.kind, lastActivityAt: d.lastActivityAt }, staleDays, now) ? daysSince(d.lastActivityAt, now) : null,
    bucket: d.nextFollowUpAt && d.stage.kind === "OPEN" ? followUpBucket(d.nextFollowUpAt, today) : null,
  });
  const num = (d: (typeof deals)[number]) => ({ oneTimeValue: Number(d.oneTimeValue), monthlyValue: Number(d.monthlyValue), probability: d.probability });
  const openTotals = totals(deals.filter((d) => d.stage.kind === "OPEN").map(num));

  const columns: BoardColumn[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    probability: s.probability,
    deals: deals
      .filter((d) => d.stageId === s.id)
      .map((d) => {
        const f = flags(d);
        return {
          id: d.id,
          title: d.title,
          clientName: d.client.name,
          ownerName: d.owner.name,
          productType: d.productType,
          oneTime: Number(d.oneTimeValue),
          monthly: Number(d.monthlyValue),
          probability: d.probability,
          closeDate: d.expectedCloseDate ? formatDate(d.expectedCloseDate) : null,
          staleDays: f.staleDays,
          followUp: f.bucket === "overdue" || f.bucket === "today" ? f.bucket : null,
        };
      }),
  }));

  const params = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `/pipeline?${p.toString()}`;
  };
  const hasFilters = !!(q || sp.owner || sp.sector || type || sp.from || sp.to || sp.minOneTime || sp.minMonthly || sp.flag || sp.stage || (sp.status && sp.status !== "open"));

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          <>
            Open: {openTotals.count} deals · {formatMoney(openTotals.oneTime)} one-time + {formatMoney(openTotals.monthly)}/mo · Weighted {formatMoney(openTotals.weightedOneTime)} +{" "}
            {formatMoney(openTotals.weightedMonthly)}/mo
          </>
        }
        actions={
          <>
            <div className="flex rounded-md border border-gray-300 bg-white p-0.5">
              <Link href={params({ view: undefined })} className={cn("flex items-center gap-1 rounded px-3 py-1.5 text-sm", view === "board" ? "bg-navy text-white" : "text-gray-700")}>
                <Columns3 className="h-4 w-4" /> Board
              </Link>
              <Link href={params({ view: "table" })} className={cn("flex items-center gap-1 rounded px-3 py-1.5 text-sm", view === "table" ? "bg-navy text-white" : "text-gray-700")}>
                <List className="h-4 w-4" /> Table
              </Link>
            </div>
            {can(user, "deals.create") && (
              <Link href="/deals/new" className={buttonClass("primary")}>
                <Plus className="h-4 w-4" /> New deal
              </Link>
            )}
          </>
        }
      />

      <Card className="mb-4 p-3">
        <form className="flex flex-wrap items-center gap-2">
          {view === "table" && <input type="hidden" name="view" value="table" />}
          <Input name="q" defaultValue={q} placeholder="Search deal, entity or group" className="w-60" />
          <Select name="owner" defaultValue={sp.owner ?? ""} className="w-44" aria-label="Owner">
            <option value="">All owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <Select name="sector" defaultValue={sp.sector ?? ""} className="w-44" aria-label="Sector">
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select name="type" defaultValue={type ?? ""} className="w-36" aria-label="Product type">
            <option value="">All types</option>
            <option value="NON_IT">Non-IT</option>
            <option value="IT">IT</option>
            <option value="TRACKING">Tracking</option>
          </Select>
          {view === "table" && (
            <>
              <Select name="status" defaultValue={sp.status ?? "open"} className="w-32" aria-label="Status">
                <option value="open">Open</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="all">All</option>
              </Select>
              <Select name="stage" defaultValue={sp.stage ?? ""} className="w-40" aria-label="Stage">
                <option value="">All stages</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input name="minOneTime" defaultValue={sp.minOneTime} placeholder="One-time at least" className="w-36" inputMode="decimal" />
              <Input name="minMonthly" defaultValue={sp.minMonthly} placeholder="Monthly at least" className="w-36" inputMode="decimal" />
            </>
          )}
          <label className="flex items-center gap-1 text-xs text-gray-500">
            Close from <Input type="date" name="from" defaultValue={sp.from} className="w-36" />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            to <Input type="date" name="to" defaultValue={sp.to} className="w-36" />
          </label>
          <Select name="flag" defaultValue={sp.flag ?? ""} className="w-44" aria-label="Flags">
            <option value="">All deals</option>
            <option value="stale">Stale only</option>
            <option value="followup">Follow-up due</option>
          </Select>
          <button className={buttonClass("navy")}>Filter</button>
          {hasFilters && (
            <Link href={view === "table" ? "/pipeline?view=table" : "/pipeline"} className={buttonClass("ghost")}>
              Clear
            </Link>
          )}
        </form>
      </Card>

      {view === "board" ? (
        stages.length === 0 ? (
          <EmptyState title="No pipeline stages. Ask an Admin to set them up in Settings." />
        ) : (
          <>
            <PipelineBoard columns={columns} lostReasons={lostReasons} closedDays={CLOSED_DAYS} />
            <p className="text-xs text-gray-500">Drag a card to another column to move the deal. On a phone, open the deal and tap a stage instead.</p>
          </>
        )
      ) : deals.length === 0 ? (
        <EmptyState title={hasFilters ? "No deals match these filters" : "No open deals yet"} />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Deal</TH>
                <TH>Stage</TH>
                <TH>Owner</TH>
                <TH className="text-right">
                  <Link href={params({ sort: "value" })} className="hover:text-navy">
                    One-time
                  </Link>
                </TH>
                <TH className="text-right">
                  <Link href={params({ sort: "monthly" })} className="hover:text-navy">
                    Monthly
                  </Link>
                </TH>
                <TH className="text-right">Weighted</TH>
                <TH>
                  <Link href={params({ sort: "close" })} className="hover:text-navy">
                    Close date
                  </Link>
                </TH>
                <TH>
                  <Link href={params({ sort: "activity" })} className="hover:text-navy">
                    Last activity
                  </Link>
                </TH>
              </tr>
            </THead>
            <TBody>
              {deals.map((d) => {
                const f = flags(d);
                const one = Number(d.oneTimeValue);
                const mon = Number(d.monthlyValue);
                return (
                  <TR key={d.id}>
                    <TD>
                      <Link href={`/deals/${d.id}`} className="font-medium text-navy hover:underline">
                        {d.title}
                      </Link>
                      <div className="text-xs text-gray-500">{d.client.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone={PRODUCT_TYPE_TONE[d.productType]}>{PRODUCT_TYPE_SHORT[d.productType]}</Badge>
                        {f.staleDays !== null && <StaleBadge days={f.staleDays} />}
                        {f.bucket && <FollowUpBadge bucket={f.bucket} />}
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={d.stage.kind === "WON" ? "green" : d.stage.kind === "LOST" ? "red" : "navy"}>{d.stage.name}</Badge>
                      <div className="text-xs text-gray-500">{d.probability}%</div>
                    </TD>
                    <TD className="text-sm">{d.owner.name}</TD>
                    <TD className="text-right">{formatMoney(one)}</TD>
                    <TD className="text-right">{formatMoney(mon)}</TD>
                    <TD className="text-right text-xs text-gray-600">
                      {formatMoney(weighted(one, d.probability))}
                      <div>{formatMoney(weighted(mon, d.probability))}/mo</div>
                    </TD>
                    <TD className="text-sm">{d.expectedCloseDate ? formatDate(d.expectedCloseDate) : ""}</TD>
                    <TD className="text-xs text-gray-500">{daysSince(d.lastActivityAt, now)} days ago</TD>
                  </TR>
                );
              })}
            </TBody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold">
              {(() => {
                const t = totals(deals.map(num));
                return (
                  <tr>
                    <td className="px-4 py-2.5" colSpan={3}>
                      Total ({t.count} deals)
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(t.oneTime)}</td>
                    <td className="px-4 py-2.5 text-right">{formatMoney(t.monthly)}</td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {formatMoney(t.weightedOneTime)}
                      <div>{formatMoney(t.weightedMonthly)}/mo</div>
                    </td>
                    <td colSpan={2} />
                  </tr>
                );
              })()}
            </tfoot>
          </Table>
          {deals.length === 1000 && <p className="px-4 py-2 text-xs text-gray-500">Showing the first 1,000 deals. Use the filters to narrow the list.</p>}
        </Card>
      )}
    </>
  );
}
