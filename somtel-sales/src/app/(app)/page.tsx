import Link from "next/link";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/session";
import { clientScope } from "@/lib/clients";
import { getAllSettings } from "@/lib/settings";
import { smtpConfigured } from "@/lib/email";
import { getSetting } from "@/lib/settings";
import { dateKey, todayIn, totals } from "@/lib/pipeline";
import { formatDate, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const metadata = { title: "My dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const canClients = can(user, "clients.view");
  const scope = canClients ? await clientScope(user) : { id: "__none__" };
  const [mine, active, prospects, recent] = await Promise.all([
    prisma.client.count({ where: { ownerId: user.id, deletedAt: null } }),
    prisma.client.count({ where: { AND: [scope, { deletedAt: null, status: "ACTIVE" }] } }),
    prisma.client.count({ where: { AND: [scope, { deletedAt: null, status: "PROSPECT" }] } }),
    prisma.client.findMany({ where: { AND: [scope, { deletedAt: null }] }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, name: true, city: true } }),
  ]);

  const firstName = user.name.split(" ")[0];
  const isAdmin = can(user, "settings.manage");
  const sales = can(user, "deals.view");

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Your pipeline and follow-ups. Orders and renewals will appear here as the next phases are added."
        actions={
          can(user, "clients.create") && (
            <Link href="/clients/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New entity
            </Link>
          )
        }
      />
      {sales && <MyPipeline userId={user.id} />}
      {canClients && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="My entities" value={mine} href={`/clients?owner=${user.id}`} />
          <Stat label="Active entities" value={active} href="/clients?status=ACTIVE" />
          <Stat label="Prospects" value={prospects} href="/clients?status=PROSPECT" />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {canClients && (
          <Card>
            <CardHeader title="Recently updated entities" actions={<Link href="/clients" className="text-sm text-navy hover:underline">All customers</Link>} />
            <CardBody className="divide-y divide-gray-100 p-0">
              {recent.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">No entities yet.</p>}
              {recent.map((c) => (
                <Link key={c.id} href={`/clients/${c.id}`} className="flex justify-between px-5 py-2.5 text-sm hover:bg-gray-50">
                  <span className="font-medium text-navy">{c.name}</span>
                  <span className="text-gray-500">{c.city}</span>
                </Link>
              ))}
            </CardBody>
          </Card>
        )}
        {isAdmin && <SetupChecklist />}
      </div>
    </>
  );
}

async function MyPipeline({ userId }: { userId: string }) {
  const now = new Date();
  const today = todayIn(now);
  const staleDays = await getSetting<number>("pipeline.staleDays");
  const [stages, deals, due, staleCount] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { active: true, kind: "OPEN" }, orderBy: { sortOrder: "asc" } }),
    prisma.deal.findMany({ where: { ownerId: userId, deletedAt: null, stage: { kind: "OPEN" } }, select: { stageId: true, oneTimeValue: true, monthlyValue: true, probability: true } }),
    prisma.deal.findMany({
      where: { ownerId: userId, deletedAt: null, stage: { kind: "OPEN" }, nextFollowUpAt: { lte: new Date(`${today}T00:00:00Z`) } },
      include: { client: { select: { name: true } } },
      orderBy: { nextFollowUpAt: "asc" },
      take: 6,
    }),
    prisma.deal.count({ where: { ownerId: userId, deletedAt: null, stage: { kind: "OPEN" }, lastActivityAt: { lte: new Date(now.getTime() - staleDays * 86_400_000) } } }),
  ]);
  const num = (d: (typeof deals)[number]) => ({ oneTimeValue: Number(d.oneTimeValue), monthlyValue: Number(d.monthlyValue), probability: d.probability });
  const all = totals(deals.map(num));
  const max = Math.max(1, ...stages.map((s) => deals.filter((d) => d.stageId === s.id).length));
  return (
    <div className="mb-6 grid gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader
          title="My pipeline"
          description={`${all.count} open deals · ${formatMoney(all.oneTime)} + ${formatMoney(all.monthly)}/mo · weighted ${formatMoney(all.weightedOneTime)} + ${formatMoney(all.weightedMonthly)}/mo`}
          actions={<Link href={`/pipeline?owner=${userId}`} className="text-sm text-navy hover:underline">Open board</Link>}
        />
        <CardBody className="space-y-3">
          {stages.map((s) => {
            const inStage = deals.filter((d) => d.stageId === s.id);
            const t = totals(inStage.map(num));
            return (
              <div key={s.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-800">
                    {s.name} <span className="text-gray-400">({t.count})</span>
                  </span>
                  <span className="text-gray-600">
                    {formatMoney(t.oneTime)} + {formatMoney(t.monthly)}/mo
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-navy" style={{ width: `${(t.count / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Follow-ups due" actions={<Link href="/follow-ups" className="text-sm text-navy hover:underline">All follow-ups</Link>} />
        <CardBody className="space-y-2 p-0">
          {due.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">Nothing due today.</p>}
          {due.map((d) => (
            <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-2 text-sm hover:bg-gray-50">
              <span>
                <span className="font-medium text-navy">{d.title}</span>
                <span className="block text-xs text-gray-500">{d.client.name}</span>
              </span>
              <span className={dateKey(d.nextFollowUpAt!) < today ? "text-xs font-medium text-red-600" : "text-xs font-medium text-navy"}>
                {dateKey(d.nextFollowUpAt!) < today ? `Overdue (${formatDate(d.nextFollowUpAt)})` : "Today"}
              </span>
            </Link>
          ))}
          {staleCount > 0 && (
            <Link href={`/pipeline?owner=${userId}&flag=stale`} className="block border-t border-gray-100 px-5 py-3 text-sm text-amber-700 hover:bg-amber-50">
              {staleCount} stale {staleCount === 1 ? "deal" : "deals"} with no activity for {staleDays}+ days
            </Link>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="border-l-4 border-l-gold p-4 transition-shadow hover:shadow-md">
        <div className="text-sm text-gray-500">{label}</div>
        <div className="mt-1 text-3xl font-semibold text-navy">{value}</div>
      </Card>
    </Link>
  );
}

async function SetupChecklist() {
  const [settings, techSections, company, users, servicesWithoutSections, distributors] = await Promise.all([
    getAllSettings(),
    prisma.techSection.count({ where: { active: true } }),
    prisma.companyProfile.findUnique({ where: { id: "company" } }),
    prisma.user.count({ where: { active: true, deletedAt: null } }),
    prisma.service.count({ where: { deletedAt: null, active: true, productType: { not: "IT" }, techSections: { none: {} } } }),
    prisma.distributor.count({ where: { deletedAt: null, active: true } }),
  ]);
  const items = [
    { done: !!company?.logoPath, label: "Upload the Somtel logo", href: "/settings/company" },
    { done: !!company?.phone && !!company?.address, label: "Fill in company details for documents", href: "/settings/company" },
    { done: users > 1, label: "Add the sales team and other users", href: "/settings/users" },
    { done: techSections > 0, label: "Add the real tech section names", href: "/settings/lists/tech-sections" },
    { done: techSections > 0 && servicesWithoutSections === 0, label: "Link every Somtel service to its tech sections", href: "/catalog" },
    { done: distributors > 0, label: "Add distributors and link them to vendors", href: "/catalog/distributors" },
    { done: settings.get("quotes.vatPct") !== null, label: "Set the VAT %", href: "/settings/general" },
    { done: settings.get("costing.floorLicencePct") !== null && settings.get("costing.floorHardwarePct") !== null, label: "Set the minimum markup floors", href: "/settings/general" },
    { done: smtpConfigured(), label: "Set up SMTP email in .env", href: "/settings/email" },
  ];
  const left = items.filter((i) => !i.done).length;
  return (
    <Card>
      <CardHeader title="Admin setup" description={left ? `${left} of ${items.length} steps left` : "All set up"} />
      <CardBody className="space-y-2">
        {items.map((i) => (
          <Link key={i.label} href={i.href} className="flex items-center gap-2 text-sm hover:text-navy">
            {i.done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-gray-300" />}
            <span className={i.done ? "text-gray-400 line-through" : "text-gray-800"}>{i.label}</span>
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}
