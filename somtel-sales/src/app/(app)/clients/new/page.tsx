import { requirePermission } from "@/lib/session";
import { hasPermission } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";
import { clientFormOptions } from "../form-data";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  const user = await requirePermission("clients.create");
  const { sectors, owners } = await clientFormOptions(user);
  const canAssign = hasPermission(user.roles, "clients.assignOwner");
  if (!owners.some((o) => o.id === user.id)) owners.unshift({ id: user.id, name: user.name });
  return (
    <div className="max-w-3xl">
      <PageHeader title="New client" breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: "New" }]} />
      <ClientForm
        action={createClientAction}
        values={{ ownerId: user.id, sectorId: user.sectorIds[0] ?? null }}
        sectors={sectors}
        owners={canAssign ? owners : owners.filter((o) => o.id === user.id)}
        canAssignOwner={canAssign}
        cancelHref="/clients"
      />
    </div>
  );
}
