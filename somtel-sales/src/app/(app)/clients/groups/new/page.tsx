import { requirePermission } from "@/lib/session";
import { hasPermission } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { GroupForm } from "../group-form";
import { createGroupAction } from "../actions";
import { clientFormOptions } from "../../form-data";

export const metadata = { title: "New group" };

export default async function NewGroupPage() {
  const user = await requirePermission("clients.create");
  const { sectors, owners } = await clientFormOptions(user);
  const canAssign = hasPermission(user.roles, "clients.assignOwner");
  if (!owners.some((o) => o.id === user.id)) owners.unshift({ id: user.id, name: user.name });
  return (
    <div className="max-w-3xl">
      <PageHeader title="New group" breadcrumbs={[{ label: "Customers", href: "/clients" }, { label: "Groups", href: "/clients/groups" }, { label: "New" }]} />
      <GroupForm
        action={createGroupAction}
        values={{ ownerId: user.id, sectorId: user.sectorIds[0] ?? null }}
        sectors={sectors}
        owners={canAssign ? owners : owners.filter((o) => o.id === user.id)}
        canAssignOwner={canAssign}
        cancelHref="/clients/groups"
      />
    </div>
  );
}
