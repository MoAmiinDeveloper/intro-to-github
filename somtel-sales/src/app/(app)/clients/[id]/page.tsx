import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Phone, Star, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, getTeamIds, requirePermission } from "@/lib/session";
import { dealScope } from "@/lib/deals";
import { hasRole } from "@/lib/roles";
import { totals } from "@/lib/pipeline";
import { formatDate, formatMoney } from "@/lib/utils";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ActivityForm } from "@/components/deals/activity-form";
import { ActivityList } from "@/components/deals/activity-list";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_TONE, canDeleteClient, canEditClient, clientScope } from "@/lib/clients";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { Timeline } from "@/components/timeline";
import { ContactForm } from "../contact-form";
import { deleteClientAction, deleteContactAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.client.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name ?? "Entity" };
}

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const user = await requirePermission("clients.view");
  const client = await prisma.client.findFirst({
    where: { AND: [{ id, deletedAt: null }, await clientScope(user)] },
    include: {
      sector: true,
      group: true,
      owner: { select: { name: true, email: true } },
      contacts: { where: { deletedAt: null }, orderBy: [{ isDecisionMaker: "desc" }, { name: "asc" }] },
      linkedPersons: { where: { contact: { deletedAt: null } }, include: { contact: { include: { client: { select: { id: true, name: true } } } } } },
    },
  });
  if (!client) notFound();
  const groupEntities = client.groupId
    ? await prisma.client.findMany({ where: { groupId: client.groupId, deletedAt: null, NOT: { id } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const shared = client.linkedPersons.map((l) => l.contact);
  const seeDeals = can(user, "deals.view");
  const deals = seeDeals
    ? await prisma.deal.findMany({
        where: { AND: [{ clientId: id, deletedAt: null }, await dealScope(user)] },
        include: { stage: true, owner: { select: { name: true } } },
        orderBy: [{ stage: { sortOrder: "asc" } }, { expectedCloseDate: "asc" }],
      })
    : [];
  const open = totals(deals.filter((d) => d.stage.kind === "OPEN").map((d) => ({ oneTimeValue: Number(d.oneTimeValue), monthlyValue: Number(d.monthlyValue), probability: d.probability })));
  const activities =
    tab === "activity"
      ? await prisma.activity.findMany({
          where: { clientId: id, deletedAt: null, OR: [{ dealId: null }, { deal: await dealScope(user) }] },
          include: { user: { select: { name: true } }, deal: { select: { id: true, title: true } } },
          orderBy: { occurredAt: "desc" },
          take: 200,
        })
      : [];
  const team = tab === "activity" ? await getTeamIds(user.id) : [];
  const [editable, deletable] = await Promise.all([canEditClient(user, client), canDeleteClient(user, client)]);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "contacts", label: `People (${client.contacts.length + shared.length})` },
    ...(seeDeals ? [{ key: "deals", label: `Deals (${deals.length})` }] : []),
    { key: "activity", label: "Activity" },
    { key: "timeline", label: "Timeline" },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Customers", href: "/clients" },
          ...(client.group ? [{ label: client.group.name, href: `/clients/groups/${client.group.id}` }] : []),
          { label: client.name },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {client.name}
            <Badge tone={CLIENT_STATUS_TONE[client.status]}>{CLIENT_STATUS_LABELS[client.status]}</Badge>
          </span>
        }
        description={[client.sector?.name, client.industry, client.city].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {editable && (
              <Link href={`/clients/${id}/edit`} className={buttonClass("outline")}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            )}
            {deletable && (
              <form action={deleteClientAction}>
                <input type="hidden" name="id" value={id} />
                <ConfirmSubmit variant="outline" className="text-red-600" message={`Delete ${client.name}? An Admin can restore it later.`} pendingText="Deleting...">
                  <Trash2 className="h-4 w-4" /> Delete
                </ConfirmSubmit>
              </form>
            )}
          </>
        }
      />

      <Tabs base={`/clients/${id}`} tabs={tabs} active={tab} />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Details" />
            <CardBody>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">Group</dt>
                  <dd className="mt-0.5">
                    {client.group ? (
                      <Link href={`/clients/groups/${client.group.id}`} className="text-navy hover:underline">
                        {client.group.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">Standalone (no group)</span>
                    )}
                  </dd>
                </div>
                <Item label="Account owner" value={client.owner?.name ?? "No owner"} />
                <Item label="Sector" value={client.sector?.name} />
                <Item label="Industry" value={client.industry} />
                <Item label="Address" value={[client.address, client.city].filter(Boolean).join(", ")} />
                <Item label="Phone" value={client.phone} />
                <Item label="Email" value={client.email} />
                <Item label="Website" value={client.website} />
              </dl>
              {client.notes && (
                <div className="mt-5">
                  <div className="text-xs font-medium uppercase text-gray-500">Notes</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{client.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Key people" actions={<Link href={`/clients/${id}?tab=contacts`} className="text-sm text-navy hover:underline">All</Link>} />
              <CardBody className="space-y-3">
                {client.contacts.length === 0 && <p className="text-sm text-gray-500">No people yet.</p>}
                {client.contacts.slice(0, 4).map((c) => (
                  <div key={c.id} className="text-sm">
                    <div className="flex items-center gap-1 font-medium">
                      {c.name}
                      {c.isDecisionMaker && <Star className="h-3.5 w-3.5 fill-gold text-gold" />}
                    </div>
                    <div className="text-gray-500">{c.title}</div>
                    <div className="text-gray-600">{[c.phone, c.email].filter(Boolean).join(" · ")}</div>
                  </div>
                ))}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Upsell and cross-sell notes" />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{client.upsellNotes || "None yet."}</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div className="space-y-4">
          {client.contacts.length === 0 ? (
            <EmptyState title="No people at this entity yet" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {client.contacts.map((c) => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        {c.name}
                        {c.isDecisionMaker && <Badge tone="gold">Decision maker</Badge>}
                      </div>
                      <div className="text-sm text-gray-500">{c.title}</div>
                    </div>
                    {editable && (
                      <div className="flex gap-1">
                        <Link href={`/clients/${id}/contacts/${c.id}/edit`} className={buttonClass("ghost", "icon")} title="Edit person">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <form action={deleteContactAction}>
                          <input type="hidden" name="clientId" value={id} />
                          <input type="hidden" name="contactId" value={c.id} />
                          <ConfirmSubmit variant="ghost" size="icon" message={`Delete ${c.name}?`} pendingText="" title="Delete person">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </ConfirmSubmit>
                        </form>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-gray-700 hover:text-navy">
                        <Phone className="h-3.5 w-3.5" /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-gray-700 hover:text-navy">
                        <Mail className="h-3.5 w-3.5" /> {c.email}
                      </a>
                    )}
                    {c.notes && <p className="pt-1 text-xs text-gray-500">{c.notes}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
          {shared.length > 0 && (
            <Card>
              <CardHeader title="People from other entities in the group" description="Based at another entity, and also work with this one." />
              <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shared.map((c) => (
                  <div key={c.id} className="rounded-md border border-gray-100 p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      {c.name}
                      {c.isDecisionMaker && <Badge tone="gold">Decision maker</Badge>}
                    </div>
                    <div className="text-gray-500">{c.title}</div>
                    <div className="text-gray-600">{[c.phone, c.email].filter(Boolean).join(" · ")}</div>
                    <Link href={`/clients/${c.client.id}?tab=contacts`} className="mt-1 inline-block text-xs text-navy hover:underline">
                      Based at {c.client.name}
                    </Link>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
          {editable && (
            <Card>
              <CardHeader title="Add a person" />
              <CardBody>
                <ContactForm clientId={id} groupEntities={groupEntities} />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "deals" && seeDeals && (
        <Card>
          <CardHeader
            title="Deals"
            description={`Open: ${open.count} · ${formatMoney(open.oneTime)} one-time + ${formatMoney(open.monthly)}/mo`}
            actions={
              can(user, "deals.create") && (
                <Link href={`/deals/new?client=${id}`} className={buttonClass("primary", "sm")}>
                  New deal
                </Link>
              )
            }
          />
          {deals.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">No deals yet.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Deal</TH>
                  <TH>Stage</TH>
                  <TH>Owner</TH>
                  <TH className="text-right">One-time</TH>
                  <TH className="text-right">Monthly</TH>
                  <TH>Close date</TH>
                </tr>
              </THead>
              <TBody>
                {deals.map((d) => (
                  <TR key={d.id}>
                    <TD>
                      <Link href={`/deals/${d.id}`} className="font-medium text-navy hover:underline">
                        {d.title}
                      </Link>
                    </TD>
                    <TD>
                      <Badge tone={d.stage.kind === "WON" ? "green" : d.stage.kind === "LOST" ? "red" : "navy"}>{d.stage.name}</Badge>
                    </TD>
                    <TD className="text-sm">{d.owner.name}</TD>
                    <TD className="text-right">{formatMoney(Number(d.oneTimeValue))}</TD>
                    <TD className="text-right">{formatMoney(Number(d.monthlyValue))}</TD>
                    <TD className="text-sm">{d.expectedCloseDate ? formatDate(d.expectedCloseDate) : ""}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {tab === "activity" && (
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="Activity" description="Calls, meetings, emails and notes with this entity, including those logged on its deals." />
            <CardBody>
              <ActivityList
                items={activities}
                canDelete={(a) => a.userId === user.id || hasRole(user.roles, "ADMIN", "HEAD_OF_ENTERPRISE") || team.includes(a.userId)}
              />
            </CardBody>
          </Card>
          {editable && (
            <Card className="lg:col-span-2">
              <CardHeader title="Log activity" description="Not about a specific deal? Log it here. For a deal, log it on the deal page." />
              <CardBody>
                <ActivityForm clientId={id} />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "timeline" && (
        <Card>
          <CardHeader title="Timeline" description="Changes to this entity and its people. Calls, meetings and deals are added in the next phase." />
          <CardBody>
            <Timeline
              where={{
                OR: [
                  { entityType: "Client", entityId: id },
                  { entityType: "Contact", entityId: { in: (await prisma.contact.findMany({ where: { clientId: id }, select: { id: true } })).map((c) => c.id) } },
                ],
              }}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{value || <span className="text-gray-400">Not set</span>}</dd>
    </div>
  );
}
