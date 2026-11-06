import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTeamIds, requirePermission } from "@/lib/session";
import { hasPermission, hasRole } from "@/lib/roles";
import { getSetting } from "@/lib/settings";
import { addDays, dateKey, daysSince, todayIn } from "@/lib/pipeline";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reschedule } from "./reschedule";

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { who: whoParam } = await searchParams;
  const user = await requirePermission("deals.view");
  const canTeam = hasRole(user.roles, "MANAGER", "HEAD_OF_ENTERPRISE", "ADMIN");
  const canAll = hasPermission(user.roles, "deals.viewAll");
  const who = whoParam === "all" && canAll ? "all" : whoParam === "team" && canTeam ? "team" : "me";
  const ownerFilter: Prisma.DealWhereInput =
    who === "all" ? {} : who === "team" ? { ownerId: { in: [user.id, ...(await getTeamIds(user.id))] } } : { ownerId: user.id };

  const now = new Date();
  const today = todayIn(now);
  const staleDays = await getSetting<number>("pipeline.staleDays");
  const include = { client: { select: { id: true, name: true } }, owner: { select: { name: true } }, stage: { select: { name: true } } } as const;
  const open: Prisma.DealWhereInput = { AND: [ownerFilter, { deletedAt: null, stage: { kind: "OPEN" } }] };

  const [due, stale, noFollowUp] = await Promise.all([
    prisma.deal.findMany({
      where: { AND: [open, { nextFollowUpAt: { lte: new Date(`${addDays(today, 7)}T00:00:00Z`) } }] },
      include,
      orderBy: { nextFollowUpAt: "asc" },
    }),
    prisma.deal.findMany({
      where: { AND: [open, { lastActivityAt: { lte: new Date(now.getTime() - staleDays * 86_400_000) } }] },
      include,
      orderBy: { lastActivityAt: "asc" },
    }),
    prisma.deal.count({ where: { AND: [open, { nextFollowUpAt: null }] } }),
  ]);

  const overdue = due.filter((d) => dateKey(d.nextFollowUpAt!) < today);
  const dueToday = due.filter((d) => dateKey(d.nextFollowUpAt!) === today);
  const upcoming = due.filter((d) => dateKey(d.nextFollowUpAt!) > today);
  const showOwner = who !== "me";

  const section = (title: string, rows: typeof due, tone: string, empty: string) => (
    <Card>
      <CardHeader title={<span className={tone}>{`${title} (${rows.length})`}</span>} />
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">{empty}</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Deal</TH>
              {showOwner && <TH>Owner</TH>}
              <TH>Next step</TH>
              <TH>Follow-up</TH>
              <TH />
            </tr>
          </THead>
          <TBody>
            {rows.map((d) => (
              <TR key={d.id}>
                <TD>
                  <Link href={`/deals/${d.id}`} className="font-medium text-navy hover:underline">
                    {d.title}
                  </Link>
                  <div className="text-xs text-gray-500">
                    {d.client.name} · {d.stage.name} · {formatMoney(Number(d.oneTimeValue))}
                    {Number(d.monthlyValue) > 0 && ` + ${formatMoney(Number(d.monthlyValue))}/mo`}
                  </div>
                </TD>
                {showOwner && <TD className="text-sm">{d.owner.name}</TD>}
                <TD className="max-w-xs text-sm text-gray-700">{d.nextStep}</TD>
                <TD className="whitespace-nowrap text-sm">{formatDate(d.nextFollowUpAt)}</TD>
                <TD>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link href={`/deals/${d.id}`} className="rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gold-300">
                      Log activity
                    </Link>
                    <Reschedule dealId={d.id} current={dateKey(d.nextFollowUpAt!)} />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description={`Today is ${formatDate(new Date(`${today}T00:00:00Z`))}. Open deals only.`}
        actions={
          (canTeam || canAll) && (
            <div className="flex rounded-md border border-gray-300 bg-white p-0.5">
              {[
                { key: "me", label: "Mine", show: true },
                { key: "team", label: "My team", show: canTeam },
                { key: "all", label: "Everyone", show: canAll },
              ]
                .filter((t) => t.show)
                .map((t) => (
                  <Link key={t.key} href={`/follow-ups?who=${t.key}`} className={cn("rounded px-3 py-1.5 text-sm", who === t.key ? "bg-navy text-white" : "text-gray-700")}>
                    {t.label}
                  </Link>
                ))}
            </div>
          )
        }
      />
      {due.length === 0 && stale.length === 0 ? (
        <EmptyState title="Nothing due">No follow-ups in the next 7 days and no stale deals.</EmptyState>
      ) : (
        <div className="space-y-5">
          {section("Overdue", overdue, "text-red-700", "Nothing overdue.")}
          {section("Due today", dueToday, "text-navy", "Nothing due today.")}
          {section("Next 7 days", upcoming, "text-navy", "Nothing in the next 7 days.")}
          <Card>
            <CardHeader title={`Stale deals (${stale.length})`} description={`Open deals with no call, meeting, email, note or stage change for ${staleDays} days or more.`} />
            {stale.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">No stale deals.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Deal</TH>
                    {showOwner && <TH>Owner</TH>}
                    <TH>Stage</TH>
                    <TH className="text-right">No activity for</TH>
                  </tr>
                </THead>
                <TBody>
                  {stale.map((d) => (
                    <TR key={d.id}>
                      <TD>
                        <Link href={`/deals/${d.id}`} className="font-medium text-navy hover:underline">
                          {d.title}
                        </Link>
                        <div className="text-xs text-gray-500">{d.client.name}</div>
                      </TD>
                      {showOwner && <TD className="text-sm">{d.owner.name}</TD>}
                      <TD className="text-sm">{d.stage.name}</TD>
                      <TD className="text-right text-sm font-medium text-amber-700">{daysSince(d.lastActivityAt, now)} days</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
          {noFollowUp > 0 && (
            <p className="text-sm text-gray-500">
              {noFollowUp} open {noFollowUp === 1 ? "deal has" : "deals have"} no follow-up date.{" "}
              <Link href="/pipeline?view=table" className="text-navy underline">
                See the pipeline
              </Link>
            </p>
          )}
        </div>
      )}
    </>
  );
}
