import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_TONE, clientScope } from "@/lib/clients";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";
import { restoreClientAction } from "./actions";
import { CustomerTabs } from "./tabs";

export const metadata = { title: "Customers" };

const PAGE_SIZE = 50;

type SP = { q?: string; sector?: string; status?: string; owner?: string; group?: string; page?: string; deleted?: string };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requirePermission("clients.view");
  const showDeleted = sp.deleted === "1" && can(user, "settings.manage");
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  const where: Prisma.ClientWhereInput = {
    AND: [
      await clientScope(user),
      showDeleted ? { NOT: { deletedAt: null } } : { deletedAt: null },
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { group: { name: { contains: q, mode: "insensitive" } } },
              { city: { contains: q, mode: "insensitive" } },
              { industry: { contains: q, mode: "insensitive" } },
              { contacts: { some: { deletedAt: null, OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } } },
            ],
          }
        : {},
      sp.sector ? { sectorId: sp.sector } : {},
      sp.status && sp.status in CLIENT_STATUS_LABELS ? { status: sp.status as keyof typeof CLIENT_STATUS_LABELS } : {},
      sp.owner ? { ownerId: sp.owner } : {},
      sp.group ? { groupId: sp.group } : {},
    ],
  };

  const [clients, total, sectors, owners, groups] = await Promise.all([
    prisma.client.findMany({
      where,
      include: { sector: true, group: { select: { id: true, name: true } }, owner: { select: { name: true } }, _count: { select: { contacts: { where: { deletedAt: null } } } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.client.count({ where }),
    prisma.sector.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({
      where: { deletedAt: null, ownedClients: { some: { deletedAt: null } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.clientGroup.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const hasFilters = !!(q || sp.sector || sp.status || sp.owner || sp.group);

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${total} ${total === 1 ? "entity" : "entities"}${showDeleted ? " (deleted)" : ""}`}
        actions={
          can(user, "clients.create") && (
            <Link href="/clients/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New entity
            </Link>
          )
        }
      />

      <CustomerTabs active="entities" />
      <Card className="mb-4 p-3">
        <form className="flex flex-wrap items-center gap-2">
          <Input name="q" defaultValue={q} placeholder="Search entity, group, city or person" className="w-72" />
          <Select name="sector" defaultValue={sp.sector ?? ""} className="w-48">
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select name="group" defaultValue={sp.group ?? ""} className="w-48">
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""} className="w-36">
            <option value="">All statuses</option>
            {Object.entries(CLIENT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select name="owner" defaultValue={sp.owner ?? ""} className="w-48">
            <option value="">All owners</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          {showDeleted && <input type="hidden" name="deleted" value="1" />}
          <button className={buttonClass("navy", "md")}>Filter</button>
          {hasFilters && (
            <Link href={showDeleted ? "/clients?deleted=1" : "/clients"} className={buttonClass("ghost", "md")}>
              Clear
            </Link>
          )}
          {can(user, "settings.manage") && (
            <Link href={showDeleted ? "/clients" : "/clients?deleted=1"} className="ml-auto text-xs text-gray-500 hover:text-navy">
              {showDeleted ? "Show active entities" : "Show deleted entities"}
            </Link>
          )}
        </form>
      </Card>

      {clients.length === 0 ? (
        <EmptyState title={hasFilters ? "No entities match these filters" : "No entities yet"}>
          {!hasFilters && can(user, "clients.create") && "Click New entity to add the first one."}
        </EmptyState>
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Entity</TH>
                <TH>Group</TH>
                <TH>Sector</TH>
                <TH>City</TH>
                <TH>Owner</TH>
                <TH>Status</TH>
                <TH className="text-right">People</TH>
                <TH>{showDeleted ? "" : "Added"}</TH>
              </tr>
            </THead>
            <TBody>
              {clients.map((c) => (
                <TR key={c.id}>
                  <TD>
                    {showDeleted ? (
                      <span className="font-medium">{c.name}</span>
                    ) : (
                      <Link href={`/clients/${c.id}`} className="font-medium text-navy hover:underline">
                        {c.name}
                      </Link>
                    )}
                    {c.industry && <div className="text-xs text-gray-500">{c.industry}</div>}
                  </TD>
                  <TD>
                    {c.group ? (
                      <Link href={`/clients/groups/${c.group.id}`} className="text-gray-800 hover:text-navy hover:underline">
                        {c.group.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </TD>
                  <TD>{c.sector?.name ?? <span className="text-gray-400">Not set</span>}</TD>
                  <TD>{c.city}</TD>
                  <TD>{c.owner?.name ?? <span className="text-gray-400">No owner</span>}</TD>
                  <TD>
                    <Badge tone={CLIENT_STATUS_TONE[c.status]}>{CLIENT_STATUS_LABELS[c.status]}</Badge>
                  </TD>
                  <TD className="text-right">{c._count.contacts}</TD>
                  <TD className="text-gray-500">
                    {showDeleted ? (
                      <form action={restoreClientAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className={buttonClass("outline", "sm")}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restore
                        </button>
                      </form>
                    ) : (
                      formatDate(c.createdAt)
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} searchParams={sp} />
        </Card>
      )}
    </>
  );
}
