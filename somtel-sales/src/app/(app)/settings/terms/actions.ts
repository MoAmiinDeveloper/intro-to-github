"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, bool, handleActionError, str } from "@/lib/action";
import { assertPermission } from "@/lib/session";

const templateSchema = z.object({
  name: z.string().min(2, "Enter a name.").max(120),
  category: z.enum(["IT_RESALE", "A2P_SMS", "IVR", "TRACKING", "GENERAL"]),
  body: z.string().min(5, "Enter the terms.").max(20000),
  active: z.boolean(),
});

export async function saveTemplateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("settings.manage");
    const id = str(fd, "id");
    const data = templateSchema.parse({ name: str(fd, "name"), category: str(fd, "category"), body: fd.get("body")?.toString().trim() ?? "", active: id ? bool(fd, "active") : true });
    await prisma.$transaction(async (tx) => {
      const dup = await tx.termsTemplate.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, deletedAt: null, ...(id ? { NOT: { id } } : {}) } });
      if (dup) throw new UserError("A template with this name already exists.", { name: "Already exists." });
      if (id) {
        const before = await tx.termsTemplate.findUniqueOrThrow({ where: { id } });
        const after = await tx.termsTemplate.update({ where: { id }, data });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "TermsTemplate", entityId: id, summary: `Updated T&C template ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const t = await tx.termsTemplate.create({ data });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "TermsTemplate", entityId: t.id, summary: `Added T&C template ${t.name}`, after: t });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath("/settings/terms");
  redirect("/settings/terms");
}

export async function deleteTemplateAction(fd: FormData) {
  const user = await assertPermission("settings.manage");
  const id = str(fd, "id");
  const t = await prisma.termsTemplate.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.termsTemplate.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "TermsTemplate", entityId: id, summary: `Deleted T&C template ${t.name}` });
  });
  revalidatePath("/settings/terms");
  redirect("/settings/terms");
}

const clauseSchema = z.object({
  category: z.enum(["PAYMENT", "SCOPE", "DELIVERY", "WARRANTY", "VALIDITY", "OTHER"]),
  text: z.string().min(3, "Enter the clause.").max(2000),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  active: z.boolean(),
});

export async function saveClauseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("settings.manage");
    const id = str(fd, "id");
    const data = clauseSchema.parse({ category: str(fd, "category"), text: str(fd, "text"), sortOrder: str(fd, "sortOrder") || "0", active: id ? bool(fd, "active") : true });
    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.termsClause.findUniqueOrThrow({ where: { id } });
        const after = await tx.termsClause.update({ where: { id }, data });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "TermsClause", entityId: id, summary: "Updated a T&C clause", before: diff.before, after: diff.after });
      } else {
        const c = await tx.termsClause.create({ data });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "TermsClause", entityId: c.id, summary: "Added a T&C clause", after: c });
      }
    });
    revalidatePath("/settings/clauses");
    return { ok: true, message: id ? "Saved." : "Clause added." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function deleteClauseAction(fd: FormData) {
  const user = await assertPermission("settings.manage");
  const id = str(fd, "id");
  await prisma.$transaction(async (tx) => {
    await tx.termsClause.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "TermsClause", entityId: id, summary: "Deleted a T&C clause" });
  });
  revalidatePath("/settings/clauses");
}
