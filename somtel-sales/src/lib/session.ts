import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "./db";
import { hasPermission, teamMemberIds, type Permission } from "./roles";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  managerId: string | null;
  sectorIds: string[];
  techSectionIds: string[];
}

/** The signed-in user, loaded fresh from the database (so role changes apply at once). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findFirst({
    where: { id, active: true, deletedAt: null },
    include: { roles: true, sectors: true, techSections: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((r) => r.role),
    managerId: user.managerId,
    sectorIds: user.sectors.map((s) => s.sectorId),
    techSectionIds: user.techSections.map((t) => t.techSectionId),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do this.") {
    super(message);
  }
}

/** For pages: sends the user to the "no access" page. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.roles, permission)) redirect("/no-access");
  return user;
}

/** For server actions: throws so the action can return an error. */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Please sign in again.");
  if (!hasPermission(user.roles, permission)) throw new ForbiddenError();
  return user;
}

export function can(user: CurrentUser, permission: Permission): boolean {
  return hasPermission(user.roles, permission);
}

/** Ids of everyone below this user in the reporting line. */
export const getTeamIds = cache(async (userId: string): Promise<string[]> => {
  const users = await prisma.user.findMany({ select: { id: true, managerId: true } });
  return teamMemberIds(userId, users);
});
