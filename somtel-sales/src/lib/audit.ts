import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Plain JSON copy of a record for the audit log (Decimals and Dates become strings). */
export function snapshot(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === null || v === undefined) return undefined;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

/** Only the fields that changed, for a compact audit entry. */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (key === "updatedAt") continue;
    const x = JSON.stringify(before[key] ?? null);
    const y = JSON.stringify(after[key] ?? null);
    if (x !== y) {
      b[key] = before[key] ?? null;
      a[key] = after[key] ?? null;
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}

export async function audit(
  tx: Tx,
  entry: {
    userId: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    summary?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: snapshot(entry.before),
      after: snapshot(entry.after),
    },
  });
}
