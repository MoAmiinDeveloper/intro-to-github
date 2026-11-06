import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Users and roles" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { roles: true, manager: { select: { name: true } }, sectors: { include: { sector: true } }, techSections: { include: { techSection: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <>
      <PageHeader
        title="Users and roles"
        description="One user can have more than one role. The manager field sets the reporting line used for team views and approvals."
        actions={
          <Link href="/settings/users/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> New user
          </Link>
        }
      />
      {saved && <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">User saved.</p>}
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Roles</TH>
              <TH>Reports to</TH>
              <TH>Sectors / sections</TH>
              <TH>Last sign in</TH>
            </tr>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id} className={u.active ? "" : "opacity-60"}>
                <TD>
                  <Link href={`/settings/users/${u.id}`} className="font-medium text-navy hover:underline">
                    {u.name}
                  </Link>
                  {!u.active && <Badge className="ml-2">Switched off</Badge>}
                  <div className="text-xs text-gray-500">{u.email}</div>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.role} tone={r.role === "ADMIN" ? "gold" : "navy"}>
                        {ROLE_LABELS[r.role]}
                      </Badge>
                    ))}
                  </div>
                </TD>
                <TD>{u.manager?.name ?? <span className="text-gray-400">None</span>}</TD>
                <TD className="text-xs">{[...u.sectors.map((s) => s.sector.name), ...u.techSections.map((t) => t.techSection.name)].join(", ")}</TD>
                <TD className="text-xs text-gray-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
