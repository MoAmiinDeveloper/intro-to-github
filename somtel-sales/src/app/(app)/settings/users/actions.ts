"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, bool, handleActionError, list, optStr, str } from "@/lib/action";
import { assertPermission } from "@/lib/session";
import { ALL_ROLES, wouldCreateLoop } from "@/lib/roles";
import { emailSchema, passwordSchema } from "@/lib/validation";

const schema = z.object({
  name: z.string().min(2, "Enter the full name.").max(120),
  email: emailSchema,
  phone: z.string().max(60).nullable(),
  title: z.string().max(120).nullable(),
  active: z.boolean(),
  managerId: z.string().nullable(),
  roles: z.array(z.enum(ALL_ROLES as [Role, ...Role[]])),
  sectorIds: z.array(z.string()),
  techSectionIds: z.array(z.string()),
});

export async function saveUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let savedId = id;
  try {
    const me = await assertPermission("users.manage");
    const data = schema.parse({
      name: str(fd, "name"),
      email: str(fd, "email"),
      phone: optStr(fd, "phone"),
      title: optStr(fd, "title"),
      active: id ? bool(fd, "active") : true,
      managerId: optStr(fd, "managerId"),
      roles: list(fd, "roles"),
      sectorIds: list(fd, "sectorIds"),
      techSectionIds: list(fd, "techSectionIds"),
    });
    const password = fd.get("password")?.toString() ?? "";
    if (!id || password) {
      const p = passwordSchema.safeParse(password);
      if (!p.success) throw new UserError("Please fix the highlighted fields.", { password: p.error.issues[0]!.message });
    }
    if (data.roles.length === 0) throw new UserError("Choose at least one role.", { roles: "Choose at least one role." });
    if (data.roles.includes("TECH") && data.techSectionIds.length === 0)
      throw new UserError("Tech Section users need at least one tech section.", { techSectionIds: "Choose at least one tech section." });

    const dup = await prisma.user.findFirst({ where: { email: data.email, ...(id ? { NOT: { id } } : {}) } });
    if (dup) throw new UserError("Another user already has this email.", { email: "Already used." });

    const users = await prisma.user.findMany({ select: { id: true, managerId: true } });
    if (id && wouldCreateLoop(id, data.managerId, users))
      throw new UserError("This manager reports to this user, so it would make a loop.", { managerId: "Choose someone higher in the reporting line." });

    if (id === me.id) {
      if (!data.roles.includes("ADMIN")) throw new UserError("You cannot remove the Admin role from yourself.", { roles: "Keep the Admin role on your own account." });
      if (!data.active) throw new UserError("You cannot switch off your own account.");
    }
    if (id && (!data.roles.includes("ADMIN") || !data.active)) {
      const otherAdmins = await prisma.user.count({ where: { id: { not: id }, active: true, deletedAt: null, roles: { some: { role: "ADMIN" } } } });
      if (otherAdmins === 0) throw new UserError("There must be at least one active Admin.");
    }

    const { roles, sectorIds, techSectionIds, ...fields } = data;
    await prisma.$transaction(async (tx) => {
      const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
      if (id) {
        const before = await tx.user.findUniqueOrThrow({ where: { id }, include: { roles: true, sectors: true, techSections: true } });
        const after = await tx.user.update({ where: { id }, data: { ...fields, ...(passwordHash ? { passwordHash, failedLogins: 0, lockedUntil: null } : {}) } });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userSector.deleteMany({ where: { userId: id } });
        await tx.userTechSection.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: roles.map((role) => ({ userId: id, role })) });
        await tx.userSector.createMany({ data: sectorIds.map((sectorId) => ({ userId: id, sectorId })) });
        await tx.userTechSection.createMany({ data: techSectionIds.map((techSectionId) => ({ userId: id, techSectionId })) });
        const diff = changedFields(
          { ...strip(before), roles: before.roles.map((r) => r.role).sort(), sectorIds: before.sectors.map((s) => s.sectorId).sort(), techSectionIds: before.techSections.map((t) => t.techSectionId).sort() },
          { ...strip(after), roles: [...roles].sort(), sectorIds: [...sectorIds].sort(), techSectionIds: [...techSectionIds].sort() },
        );
        if (passwordHash) diff.after.password = "changed by Admin";
        if (diff.changed || passwordHash)
          await audit(tx, { userId: me.id, action: "UPDATE", entityType: "User", entityId: id, summary: `Updated user ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const u = await tx.user.create({
          data: {
            ...fields,
            passwordHash: passwordHash!,
            roles: { create: roles.map((role) => ({ role })) },
            sectors: { create: sectorIds.map((sectorId) => ({ sectorId })) },
            techSections: { create: techSectionIds.map((techSectionId) => ({ techSectionId })) },
          },
        });
        savedId = u.id;
        await audit(tx, { userId: me.id, action: "CREATE", entityType: "User", entityId: u.id, summary: `Created user ${u.name}`, after: { ...strip(u), roles, sectorIds, techSectionIds } });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath("/settings/users");
  redirect(`/settings/users?saved=${savedId}`);
}

/** Never put password hashes or login counters in the audit log. */
function strip<T extends Record<string, unknown>>(u: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, failedLogins, lockedUntil, lastLoginAt, ...rest } = u as T & { passwordHash?: string; failedLogins?: number; lockedUntil?: unknown; lastLoginAt?: unknown };
  return rest;
}
