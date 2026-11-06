import { requirePermission } from "@/lib/session";
import { hasPermission } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";
import { clientFormOptions } from "../form-data";

export const metadata = { title: "New entity" };

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group } = await searchParams;
  const user = await requirePermission("clients.create");
  const { sectors, owners, groups } = await clientFormOptions(user);
  const g = groups.find((x) => x.id === group);
  const canAssign = hasPermission(user.roles, "clients.assignOwner");
  if (!owners.some((o) => o.id === user.id)) owners.unshift({ id: user.id, name: user.name });
  return (
    <div className="max-w-3xl">
      <PageHeader title="New entity" breadcrumbs={[{ label: "Customers", href: "/clients" }, { label: "New entity" }]} />
      <ClientForm
        action={createClientAction}
        values={{ groupId: g?.id ?? null, ownerId: (canAssign && g?.ownerId) || user.id, sectorId: g?.sectorId ?? user.sectorIds[0] ?? null }}
        sectors={sectors}
        groups={groups}
        owners={canAssign ? owners : owners.filter((o) => o.id === user.id)}
        canAssignOwner={canAssign}
        cancelHref="/clients"
      />
    </div>
  );
}
