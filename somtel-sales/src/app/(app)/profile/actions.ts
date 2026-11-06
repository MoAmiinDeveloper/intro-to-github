"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { type ActionState, handleActionError, optStr, str } from "@/lib/action";
import { ForbiddenError, getCurrentUser } from "@/lib/session";
import { passwordSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await getCurrentUser();
    if (!me) throw new ForbiddenError("Please sign in again.");
    const data = z.object({ name: z.string().min(2, "Enter your name.").max(120), phone: z.string().max(60).nullable(), title: z.string().max(120).nullable() }).parse({
      name: str(fd, "name"),
      phone: optStr(fd, "phone"),
      title: optStr(fd, "title"),
    });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: me.id }, data });
      await audit(tx, { userId: me.id, action: "UPDATE", entityType: "User", entityId: me.id, summary: "Updated own profile", after: data });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await getCurrentUser();
    if (!me) throw new ForbiddenError("Please sign in again.");
    const current = fd.get("current")?.toString() ?? "";
    const next = fd.get("password")?.toString() ?? "";
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await bcrypt.compare(current, user.passwordHash))) return { fieldErrors: { current: "This is not your current password." } };
    const p = passwordSchema.safeParse(next);
    if (!p.success) return { fieldErrors: { password: p.error.issues[0]!.message } };
    if (next !== fd.get("confirm")?.toString()) return { fieldErrors: { confirm: "The passwords do not match." } };
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
      await audit(tx, { userId: me.id, action: "PASSWORD_RESET", entityType: "User", entityId: me.id, summary: "Changed own password" });
    });
    return { ok: true, message: "Password changed." };
  } catch (e) {
    return handleActionError(e);
  }
}
