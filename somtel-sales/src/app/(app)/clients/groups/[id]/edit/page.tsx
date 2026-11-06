import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { canEditClient, groupScope } from "@/lib/clients";
import { hasPermission } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { GroupForm } from "../../group-form";
import { updateGroupAction } from "../../actions";
import { clientFormOptions } from "../../../form-data";

export const metadata = { title: "Edit group" };

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("clients.view");
  const group = await prisma.clientGroup.findFirst({
    where: { AND: [{ id, deletedAt: null }, await groupScope(user)] },
    include: { _count: { select: { entities: { where: { deletedAt: null } } } } },
  });
  if (!group || !(await canEditClient(user, group))) notFound();
  const { sectors, owners } = await clientFormOptions(user);
  if (group.ownerId && !owners.some((o) => o.id === group.ownerId)) {
    const o = await prisma.user.findUnique({ where: { id: group.ownerId }, select: { id: true, name: true } });
    if (o) owners.push(o);
  }
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Edit ${group.name}`}
        breadcrumbs={[{ label: "Customers", href: "/clients" }, { label: "Groups", href: "/clients/groups" }, { label: group.name, href: `/clients/groups/${id}` }, { label: "Edit" }]}
      />
      <GroupForm
        action={updateGroupAction}
        values={group}
        sectors={sectors}
        owners={owners}
        canAssignOwner={hasPermission(user.roles, "clients.assignOwner")}
        cancelHref={`/clients/groups/${id}`}
        entityCount={group._count.entities}
      />
    </div>
  );
}
