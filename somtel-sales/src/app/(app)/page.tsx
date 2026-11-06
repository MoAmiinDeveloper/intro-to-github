import Link from "next/link";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/session";
import { clientScope } from "@/lib/clients";
import { getAllSettings } from "@/lib/settings";
import { smtpConfigured } from "@/lib/email";
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

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Your pipeline, follow-ups, orders and renewals will appear here as the next phases are added."
        actions={
          can(user, "clients.create") && (
            <Link href="/clients/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New client
            </Link>
          )
        }
      />
      {canClients && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="My clients" value={mine} href={`/clients?owner=${user.id}`} />
          <Stat label="Active clients" value={active} href="/clients?status=ACTIVE" />
          <Stat label="Prospects" value={prospects} href="/clients?status=PROSPECT" />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {canClients && (
          <Card>
            <CardHeader title="Recently updated clients" actions={<Link href="/clients" className="text-sm text-navy hover:underline">All clients</Link>} />
            <CardBody className="divide-y divide-gray-100 p-0">
              {recent.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">No clients yet.</p>}
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
  const [settings, techSections, company, users, servicesWithoutSections] = await Promise.all([
    getAllSettings(),
    prisma.techSection.count({ where: { active: true } }),
    prisma.companyProfile.findUnique({ where: { id: "company" } }),
    prisma.user.count({ where: { active: true, deletedAt: null } }),
    prisma.service.count({ where: { deletedAt: null, active: true, productType: { not: "IT" }, techSections: { none: {} } } }),
  ]);
  const items = [
    { done: !!company?.logoPath, label: "Upload the Somtel logo", href: "/settings/company" },
    { done: !!company?.phone && !!company?.address, label: "Fill in company details for documents", href: "/settings/company" },
    { done: users > 1, label: "Add the sales team and other users", href: "/settings/users" },
    { done: techSections > 0, label: "Add the real tech section names", href: "/settings/lists/tech-sections" },
    { done: techSections > 0 && servicesWithoutSections === 0, label: "Link every Somtel service to its tech sections", href: "/catalog" },
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
