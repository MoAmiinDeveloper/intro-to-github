import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { dealScope } from "@/lib/deals";
import { totals } from "@/lib/pipeline";
import { formatMoney } from "@/lib/utils";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_TONE, canDeleteClient, canEditClient, clientScope, groupScope } from "@/lib/clients";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deleteGroupAction } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await prisma.clientGroup.findUnique({ where: { id }, select: { name: true } });
  return { title: g?.name ?? "Group" };
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("clients.view");
  const group = await prisma.clientGroup.findFirst({
    where: { AND: [{ id, deletedAt: null }, await groupScope(user)] },
    include: {
      sector: true,
      owner: { select: { name: true } },
      entities: {
        where: { AND: [await clientScope(user), { deletedAt: null }] },
        orderBy: { name: "asc" },
        include: {
          sector: true,
          owner: { select: { name: true } },
          contacts: { where: { deletedAt: null }, orderBy: [{ isDecisionMaker: "desc" }, { name: "asc" }], include: { otherEntities: { include: { client: { select: { name: true } } } } } },
        },
      },
      _count: { select: { entities: { where: { deletedAt: null } } } },
    },
  });
  if (!group) notFound();
  const [editable, deletable] = await Promise.all([canEditClient(user, group), canDeleteClient(user, group)]);
  const people = group.entities.flatMap((e) => e.contacts.map((c) => ({ ...c, entityName: e.name, entityId: e.id })));
  const hidden = group._count.entities - group.entities.length;
  const active = group.entities.filter((e) => e.status === "ACTIVE").length;
  const openDeals = can(user, "deals.view")
    ? await prisma.deal.findMany({
        where: { AND: [await dealScope(user), { deletedAt: null, stage: { kind: "OPEN" }, client: { groupId: id, deletedAt: null } }] },
        select: { oneTimeValue: true, monthlyValue: true, probability: true },
      })
    : null;
  const pipe = openDeals ? totals(openDeals.map((d) => ({ oneTimeValue: Number(d.oneTimeValue), monthlyValue: Number(d.monthlyValue), probability: d.probability }))) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/clients" }, { label: "Groups", href: "/clients/groups" }, { label: group.name }]}
        title={group.name}
        description={[group.sector?.name, group.owner ? `Owner: ${group.owner.name}` : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {can(user, "clients.create") && (
              <Link href={`/clients/new?group=${id}`} className={buttonClass("primary")}>
                <Plus className="h-4 w-4" /> New entity in group
              </Link>
            )}
            {editable && (
              <Link href={`/clients/groups/${id}/edit`} className={buttonClass("outline")}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            )}
            {deletable && group._count.entities === 0 && (
              <form action={deleteGroupAction}>
                <input type="hidden" name="id" value={id} />
                <ConfirmSubmit variant="outline" className="text-red-600" message={`Delete group ${group.name}?`} pendingText="Deleting...">
                  <Trash2 className="h-4 w-4" /> Delete
                </ConfirmSubmit>
              </form>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Entities" value={group._count.entities} />
        <Stat label="Active entities" value={active} />
        <Stat label="People" value={people.length} />
        {pipe && (
          <Card className="border-l-4 border-l-gold p-4">
            <div className="text-sm text-gray-500">Open pipeline ({pipe.count} deals)</div>
            <div className="mt-1 text-xl font-semibold text-navy">{formatMoney(pipe.oneTime)}</div>
            <div className="text-xs text-gray-500">+ {formatMoney(pipe.monthly)}/mo · weighted {formatMoney(pipe.weightedOneTime)} + {formatMoney(pipe.weightedMonthly)}/mo</div>
          </Card>
        )}
      </div>
      <p className="mb-5 text-xs text-gray-500">Orders, active services and revenue for the whole group will appear here as the next phases are built.</p>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Entities" description={hidden > 0 ? `${hidden} more owned by other teams.` : undefined} />
          {group.entities.length === 0 ? (
            <CardBody>
              <EmptyState title="No entities in this group yet" />
            </CardBody>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Entity</TH>
                  <TH>Sector</TH>
                  <TH>Owner</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {group.entities.map((e) => (
                  <TR key={e.id}>
                    <TD>
                      <Link href={`/clients/${e.id}`} className="font-medium text-navy hover:underline">
                        {e.name}
                      </Link>
                      {e.city && <div className="text-xs text-gray-500">{e.city}</div>}
                    </TD>
                    <TD>{e.sector?.name}</TD>
                    <TD>{e.owner?.name}</TD>
                    <TD>
                      <Badge tone={CLIENT_STATUS_TONE[e.status]}>{CLIENT_STATUS_LABELS[e.status]}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="People across the group" />
            <CardBody className="space-y-3">
              {people.length === 0 && <p className="text-sm text-gray-500">No people yet.</p>}
              {people.map((p) => (
                <div key={p.id} className="text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    {p.name}
                    {p.isDecisionMaker && <Badge tone="gold">Decision maker</Badge>}
                  </div>
                  <div className="text-gray-500">{[p.title, p.entityName].filter(Boolean).join(" at ")}</div>
                  {p.otherEntities.length > 0 && <div className="text-xs text-gray-500">Also works with {p.otherEntities.map((o) => o.client.name).join(", ")}</div>}
                  <div className="text-gray-600">{[p.phone, p.email].filter(Boolean).join(" · ")}</div>
                </div>
              ))}
            </CardBody>
          </Card>
          {group.notes && (
            <Card>
              <CardHeader title="Notes" />
              <CardBody className="whitespace-pre-wrap text-sm text-gray-700">{group.notes}</CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-l-4 border-l-gold p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-navy">{value}</div>
    </Card>
  );
}
