import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  RESTORE: "Restored",
  APPROVE: "Approved",
  REJECT: "Rejected",
  STAGE_CHANGE: "Stage changed",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  groupId: "Group",
  otherEntities: "Also works with",
  sectorId: "Sector",
  ownerId: "Owner",
  status: "Status",
  industry: "Industry",
  city: "City",
  address: "Address",
  phone: "Phone",
  email: "Email",
  website: "Website",
  notes: "Notes",
  upsellNotes: "Upsell notes",
  title: "Job title",
  isDecisionMaker: "Decision maker",
};

export async function Timeline({ where, take = 100 }: { where: Prisma.AuditLogWhereInput; take?: number }) {
  const rows = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
  if (rows.length === 0) return <p className="text-sm text-gray-500">Nothing yet.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-navy-100 pl-5">
      {rows.map((r) => {
        const after = (r.after ?? {}) as Record<string, unknown>;
        const fields = r.action === "UPDATE" ? Object.keys(after).map((k) => FIELD_LABELS[k] ?? k) : [];
        return (
          <li key={r.id} className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-gold ring-1 ring-navy-200" />
            <div className="text-sm text-gray-900">{r.summary ?? `${ACTION_LABEL[r.action] ?? r.action} ${r.entityType}`}</div>
            {fields.length > 0 && <div className="text-xs text-gray-500">Changed: {fields.join(", ")}</div>}
            <div className="text-xs text-gray-400">
              {formatDateTime(r.createdAt)}
              {r.user ? ` by ${r.user.name}` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
