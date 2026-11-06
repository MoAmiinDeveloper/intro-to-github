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
import { optionalEmail } from "@/lib/validation";

const clientSchema = z.object({
  name: z.string().min(2, "Enter the client name.").max(200),
  sectorId: z.string().nullable(),
  industry: z.string().max(120).nullable(),
  address: z.string().max(300).nullable(),
  city: z.string().max(120).nullable(),
  phone: z.string().max(60).nullable(),
  email: optionalEmail,
  website: z.string().max(200).nullable(),
  status: z.enum(["PROSPECT", "ACTIVE", "INACTIVE"]),
  ownerId: z.string().nullable(),
  notes: z.string().max(5000).nullable(),
  upsellNotes: z.string().max(5000).nullable(),
});

function readClient(fd: FormData) {
  return {
    name: str(fd, "name"),
    sectorId: optStr(fd, "sectorId"),
    industry: optStr(fd, "industry"),
    address: optStr(fd, "address"),
    city: optStr(fd, "city"),
    phone: optStr(fd, "phone"),
    email: str(fd, "email"),
    website: optStr(fd, "website"),
    status: str(fd, "status") || "PROSPECT",
    ownerId: optStr(fd, "ownerId"),
    notes: optStr(fd, "notes"),
    upsellNotes: optStr(fd, "upsellNotes"),
  };
}

async function assertUniqueName(name: string, exceptId?: string) {
  const dup = await prisma.client.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, deletedAt: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new UserError("A client with this name already exists.", { name: "A client with this name already exists." });
}

async function assertValidOwner(ownerId: string | null) {
  if (!ownerId) return;
  const owner = await prisma.user.findFirst({ where: { id: ownerId, active: true, deletedAt: null } });
  if (!owner) throw new UserError("Choose an active user as the account owner.", { ownerId: "Choose an active user." });
}

export async function createClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const user = await assertPermission("clients.create");
    const data = clientSchema.parse(readClient(fd));
    if (!hasPermission(user.roles, "clients.assignOwner")) data.ownerId = user.id;
    else data.ownerId = data.ownerId ?? user.id;
    await assertValidOwner(data.ownerId);
    await assertUniqueName(data.name);
    const client = await prisma.$transaction(async (tx) => {
      const c = await tx.client.create({ data: { ...data, createdById: user.id } });
      await audit(tx, { userId: user.id, action: "CREATE", entityType: "Client", entityId: c.id, summary: `Created client ${c.name}`, after: c });
      return c;
    });
    id = client.id;
  } catch (e) {
    return handleActionError(e);
  }
  redirect(`/clients/${id}`);
}

export async function updateClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  try {
    const user = await getCurrentUser();
    if (!user) throw new ForbiddenError("Please sign in again.");
    const existing = await prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!existing || !(await canEditClient(user, existing))) throw new ForbiddenError();
    const data = clientSchema.parse(readClient(fd));
    if (!hasPermission(user.roles, "clients.assignOwner")) data.ownerId = existing.ownerId;
    else data.ownerId = data.ownerId ?? existing.ownerId;
    await assertValidOwner(data.ownerId);
    await assertUniqueName(data.name, id);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({ where: { id }, data });
      const diff = changedFields(existing, updated);
      if (diff.changed)
        await audit(tx, { userId: user.id, action: "UPDATE", entityType: "Client", entityId: id, summary: `Updated client ${updated.name}`, before: diff.before, after: diff.after });
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClientAction(fd: FormData) {
  const id = str(fd, "id");
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  const existing = await prisma.client.findFirst({ where: { id, deletedAt: null } });
  if (!existing || !(await canDeleteClient(user, existing))) throw new ForbiddenError();
  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "Client", entityId: id, summary: `Deleted client ${existing.name}` });
  });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function restoreClientAction(fd: FormData) {
  const id = str(fd, "id");
  const user = await assertPermission("settings.manage");
  const existing = await prisma.client.findFirst({ where: { id, NOT: { deletedAt: null } } });
  if (!existing) return;
  await assertUniqueName(existing.name).catch(() => {
    throw new Error("Another client already uses this name. Rename it first.");
  });
  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { deletedAt: null } });
    await audit(tx, { userId: user.id, action: "RESTORE", entityType: "Client", entityId: id, summary: `Restored client ${existing.name}` });
  });
  revalidatePath("/clients");
}

// ---------------- Contacts ----------------

const contactSchema = z.object({
  name: z.string().min(2, "Enter the contact name.").max(200),
  title: z.string().max(120).nullable(),
  phone: z.string().max(60).nullable(),
  email: optionalEmail,
  isDecisionMaker: z.boolean(),
  notes: z.string().max(2000).nullable(),
});

function readContact(fd: FormData) {
  return {
    name: str(fd, "name"),
    title: optStr(fd, "title"),
    phone: optStr(fd, "phone"),
    email: str(fd, "email"),
    isDecisionMaker: bool(fd, "isDecisionMaker"),
    notes: optStr(fd, "notes"),
  };
}

async function editableClient(clientId: string) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Please sign in again.");
  const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
  if (!client || !(await canEditClient(user, client))) throw new ForbiddenError();
  return { user, client };
}

export async function saveContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const clientId = str(fd, "clientId");
  const contactId = str(fd, "contactId");
  try {
    const { user, client } = await editableClient(clientId);
    const data = contactSchema.parse(readContact(fd));
    if (!data.phone && !data.email) throw new UserError("Add a phone number or an email.", { phone: "Add a phone number or an email." });
    await prisma.$transaction(async (tx) => {
      if (contactId) {
        const existing = await tx.contact.findFirst({ where: { id: contactId, clientId, deletedAt: null } });
        if (!existing) throw new UserError("This contact no longer exists.");
        const updated = await tx.contact.update({ where: { id: contactId }, data });
        const diff = changedFields(existing, updated);
        if (diff.changed)
          await audit(tx, { userId: user.id, action: "UPDATE", entityType: "Contact", entityId: contactId, summary: `Updated contact ${updated.name} at ${client.name}`, before: diff.before, after: diff.after });
      } else {
        const c = await tx.contact.create({ data: { ...data, clientId, createdById: user.id } });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "Contact", entityId: c.id, summary: `Added contact ${c.name} to ${client.name}`, after: c });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath(`/clients/${clientId}`);
  if (contactId) redirect(`/clients/${clientId}?tab=contacts`);
  return { ok: true, message: "Contact added." };
}

export async function deleteContactAction(fd: FormData) {
  const clientId = str(fd, "clientId");
  const contactId = str(fd, "contactId");
  const { user, client } = await editableClient(clientId);
  const existing = await prisma.contact.findFirst({ where: { id: contactId, clientId, deletedAt: null } });
  if (!existing) return;
  await prisma.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: contactId }, data: { deletedAt: new Date() } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "Contact", entityId: contactId, summary: `Deleted contact ${existing.name} at ${client.name}` });
  });
  revalidatePath(`/clients/${clientId}`);
}
