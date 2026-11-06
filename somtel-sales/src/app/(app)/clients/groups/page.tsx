import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { clientScope, groupScope } from "@/lib/clients";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CustomerTabs } from "../tabs";

export const metadata = { title: "Customer groups" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const q = raw?.trim();
  const user = await requirePermission("clients.view");
  const entityScope = await clientScope(user);
  const groups = await prisma.clientGroup.findMany({
    where: { AND: [await groupScope(user), { deletedAt: null }, q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { entities: { some: { deletedAt: null, name: { contains: q, mode: "insensitive" } } } }] } : {}] },
    include: {
      sector: true,
      owner: { select: { name: true } },
      entities: { where: { AND: [entityScope, { deletedAt: null }] }, select: { name: true, status: true }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        title="Customers"
        description={`${groups.length} ${groups.length === 1 ? "group" : "groups"}`}
        actions={
          can(user, "clients.create") && (
            <Link href="/clients/groups/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New group
            </Link>
          )
        }
      />
      <CustomerTabs active="groups" />
      <Card className="mb-4 p-3">
        <form className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="Search group or entity name" className="w-72" />
          <button className={buttonClass("navy")}>Search</button>
        </form>
      </Card>
      {groups.length === 0 ? (
        <EmptyState title="No groups yet">A group holds related entities, for example a holding company and its subsidiaries.</EmptyState>
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Group</TH>
                <TH>Entities</TH>
                <TH>Sector</TH>
                <TH>Owner</TH>
              </tr>
            </THead>
            <TBody>
              {groups.map((g) => (
                <TR key={g.id}>
                  <TD>
                    <Link href={`/clients/groups/${g.id}`} className="font-medium text-navy hover:underline">
                      {g.name}
                    </Link>
                  </TD>
                  <TD className="text-xs">
                    <span className="font-medium text-gray-900">{g.entities.length}</span>
                    {g.entities.length > 0 && <span className="text-gray-500">: {g.entities.map((e) => e.name).join(", ")}</span>}
                  </TD>
                  <TD>{g.sector?.name ?? <span className="text-gray-400">Not set</span>}</TD>
                  <TD>{g.owner?.name ?? <span className="text-gray-400">No owner</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
