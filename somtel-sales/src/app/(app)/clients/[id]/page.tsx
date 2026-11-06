import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Phone, Star, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
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
  return { title: c?.name ?? "Client" };
}

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const user = await requirePermission("clients.view");
  const client = await prisma.client.findFirst({
    where: { AND: [{ id, deletedAt: null }, await clientScope(user)] },
    include: {
      sector: true,
      owner: { select: { name: true, email: true } },
      contacts: { where: { deletedAt: null }, orderBy: [{ isDecisionMaker: "desc" }, { name: "asc" }] },
    },
  });
  if (!client) notFound();
  const [editable, deletable] = await Promise.all([canEditClient(user, client), canDeleteClient(user, client)]);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "contacts", label: `Contacts (${client.contacts.length})` },
    { key: "timeline", label: "Timeline" },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]}
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
              <CardHeader title="Key contacts" actions={<Link href={`/clients/${id}?tab=contacts`} className="text-sm text-navy hover:underline">All</Link>} />
              <CardBody className="space-y-3">
                {client.contacts.length === 0 && <p className="text-sm text-gray-500">No contacts yet.</p>}
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
            <EmptyState title="No contacts yet" />
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
                        <Link href={`/clients/${id}/contacts/${c.id}/edit`} className={buttonClass("ghost", "icon")} title="Edit contact">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <form action={deleteContactAction}>
                          <input type="hidden" name="clientId" value={id} />
                          <input type="hidden" name="contactId" value={c.id} />
                          <ConfirmSubmit variant="ghost" size="icon" message={`Delete contact ${c.name}?`} pendingText="" title="Delete contact">
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
          {editable && (
            <Card>
              <CardHeader title="Add a contact" />
              <CardBody>
                <ContactForm clientId={id} />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === "timeline" && (
        <Card>
          <CardHeader title="Timeline" description="Changes to this client and its contacts. Calls, meetings and deals are added in the next phase." />
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
