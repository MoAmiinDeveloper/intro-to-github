"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, bool, handleActionError, optStr, str } from "@/lib/action";
import { ForbiddenError, assertPermission, getCurrentUser } from "@/lib/session";
import { canDeleteClient, canEditClient } from "@/lib/clients";
import { hasPermission } from "@/lib/roles";

const schema = z.object({
  name: z.string().min(2, "Enter the group name.").max(200),
  sectorId: z.string().nullable(),
  ownerId: z.string().nullable(),
  notes: z.string().max(5000).nullable(),
});

function read(fd: FormData) {
  return { name: str(fd, "name"), sectorId: optStr(fd, "sectorId"), ownerId: optStr(fd, "ownerId"), notes: optStr(fd, "notes") };
}

async function assertUnique(name: string, exceptId?: string) {
  const dup = await prisma.clientGroup.findFirst({ where: { name: { equals: name, mode: "insensitive" }, deletedAt: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) } });
  if (dup) throw new UserError("A group with this name already exists.", { name: "A group with this name already exists." });
}

export async function createGroupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await assertPermission("clients.create");
    const data = schema.parse(read(fd));
    data.ownerId = hasPermission(user.roles, "clients.assignOwner") ? (data.ownerId ?? user.id) : user.id;
    await assertUnique(data.name);
    const g = await prisma.$transaction(async (tx) => {
      const g = await tx.clientGroup.create({ data: { ...data, createdById: user.id } });
      await audit(tx, { userId: user.id, action: "CREATE", entityType: "ClientGroup", entityId: g.id, summary: `Created group ${g.name}`, after: g });
      return g;
    });
    id = g.id;
  } catch (e) {
    return handleActionError(e);
  }
  redirect(`/clients/groups/${id}`);
}

export async function updateGroupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  try {
    const user = await getCurrentUser();
    if (!user) throw new ForbiddenError("Please sign in again.");
    const existing = await prisma.clientGroup.findFirst({ where: { id, deletedAt: null } });
    if (!existing || !(await canEditClient(user, existing))) throw new ForbiddenError();
    const data = schema.parse(read(fd));
    if (!hasPermission(user.roles, "clients.assignOwner")) data.ownerId = existing.ownerId;
    else data.ownerId = data.ownerId ?? existing.ownerId;
    await assertUnique(data.name, id);
    const applyToEntities = bool(fd, "applyToEntities");
    await prisma.$transaction(async (tx) => {
      const updated = await tx.clientGroup.update({ where: { id }, data });
      const diff = changedFields(existing, updated);
      if (diff.changed)
        await audit(tx, { userId: user.id, action: "UPDATE", entityType: "ClientGroup", entityId: id, summary: `Updated group ${updated.name}`, before: diff.before, after: diff.after });
      if (applyToEntities) {
        const entities = await tx.client.findMany({ where: { groupId: id, deletedAt: null } });
        for (const e of entities) {
          if (e.sectorId === data.sectorId && e.ownerId === data.ownerId) continue;
          await tx.client.update({ where: { id: e.id }, data: { sectorId: data.sectorId, ownerId: data.ownerId } });
          await audit(tx, {
            userId: user.id,
            action: "UPDATE",
            entityType: "Client",
            entityId: e.id,
            summary: `Sector and owner copied from group ${updated.name}`,
            before: { sectorId: e.sectorId, ownerId: e.ownerId },
            after: { sectorId: data.sectorId, ownerId: data.ownerId },
          });
        }
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath(`/clients/groups/${id}`);
  redirect(`/clients/groups/${id}`);
}

export async function deleteGroupAction(fd: FormData) {
  const id = str(fd, "id");
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  const existing = await prisma.clientGroup.findFirst({ where: { id, deletedAt: null }, include: { _count: { select: { entities: { where: { deletedAt: null } } } } } });
  if (!existing || !(await canDeleteClient(user, existing))) throw new ForbiddenError();
  if (existing._count.entities > 0) throw new Error("Move or delete the entities in this group first.");
  await prisma.$transaction(async (tx) => {
    await tx.clientGroup.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "ClientGroup", entityId: id, summary: `Deleted group ${existing.name}` });
  });
  revalidatePath("/clients/groups");
  redirect("/clients/groups");
}
