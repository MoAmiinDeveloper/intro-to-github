import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { canEditClient, clientScope } from "@/lib/clients";
import { hasPermission } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../../client-form";
import { updateClientAction } from "../../actions";
import { clientFormOptions } from "../../form-data";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("clients.view");
  const client = await prisma.client.findFirst({ where: { AND: [{ id, deletedAt: null }, await clientScope(user)] } });
  if (!client || !(await canEditClient(user, client))) notFound();
  const { sectors, owners } = await clientFormOptions(user);
  const canAssign = hasPermission(user.roles, "clients.assignOwner");
  // Make sure the current owner is always in the list.
  if (client.ownerId && !owners.some((o) => o.id === client.ownerId)) {
    const o = await prisma.user.findUnique({ where: { id: client.ownerId }, select: { id: true, name: true } });
    if (o) owners.push(o);
  }
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Edit ${client.name}`}
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: client.name, href: `/clients/${id}` }, { label: "Edit" }]}
      />
      <ClientForm
        action={updateClientAction}
        values={client}
        sectors={sectors}
        owners={owners}
        canAssignOwner={canAssign}
        cancelHref={`/clients/${id}`}
      />
    </div>
  );
}
