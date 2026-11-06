import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Audit log" };
const PAGE = 50;

type SP = { user?: string; entity?: string; from?: string; to?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.user ? { userId: sp.user } : {}),
    ...(sp.entity ? { entityType: sp.entity } : {}),
    ...(sp.from || sp.to
      ? { createdAt: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(`${sp.to}T23:59:59`) } : {}) } }
      : {}),
  };
  const [rows, total, users, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Audit log" description="Who changed what and when. Records are never removed." />
      <Card className="mb-4 p-3">
        <form className="flex flex-wrap items-center gap-2">
          <Select name="user" defaultValue={sp.user ?? ""} className="w-48">
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select name="entity" defaultValue={sp.entity ?? ""} className="w-44">
            <option value="">All record types</option>
            {entities.map((e) => (
              <option key={e.entityType} value={e.entityType}>
                {e.entityType}
              </option>
            ))}
          </Select>
          <Input type="date" name="from" defaultValue={sp.from} className="w-40" aria-label="From" />
          <Input type="date" name="to" defaultValue={sp.to} className="w-40" aria-label="To" />
          <button className={buttonClass("navy")}>Filter</button>
          <Link href="/audit" className={buttonClass("ghost")}>
            Clear
          </Link>
        </form>
      </Card>
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>User</TH>
              <TH>Action</TH>
              <TH>What</TH>
              <TH>Changes</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</TD>
                <TD className="text-xs">{r.user?.name ?? "System"}</TD>
                <TD>
                  <Badge tone={r.action === "DELETE" || r.action === "LOGIN_FAILED" ? "red" : r.action === "CREATE" ? "green" : "navy"}>{r.action.replace("_", " ").toLowerCase()}</Badge>
                </TD>
                <TD className="text-sm">
                  {r.summary ?? r.entityType}
                  <div className="text-xs text-gray-400">{r.entityType}</div>
                </TD>
                <TD className="max-w-md text-xs">
                  {r.action === "UPDATE" && r.after ? <Changes before={r.before as Record<string, unknown> | null} after={r.after as Record<string, unknown>} /> : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Pagination page={page} pageSize={PAGE} total={total} searchParams={sp} />
      </Card>
    </>
  );
}

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Changes({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> }) {
  return (
    <ul className="space-y-0.5">
      {Object.keys(after).map((k) => (
        <li key={k} className="break-words">
          <span className="font-medium text-gray-700">{k}:</span> <span className="text-gray-500 line-through">{show(before?.[k])}</span> <span className="text-gray-900">{show(after[k])}</span>
        </li>
      ))}
    </ul>
  );
}
