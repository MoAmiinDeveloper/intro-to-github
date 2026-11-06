import "server-only";
import type { Prisma } from "@prisma/client";
import { getTeamIds, type CurrentUser } from "./session";
import { hasPermission, hasRole } from "./roles";

/** Which clients this user can see. */
export async function clientScope(user: CurrentUser): Promise<Prisma.ClientWhereInput> {
  if (hasPermission(user.roles, "clients.viewAll")) return {};
  if (hasRole(user.roles, "MANAGER", "ACCOUNT_MANAGER")) {
    const team = await getTeamIds(user.id);
    return { ownerId: { in: [user.id, ...team] } };
  }
  return { id: "__none__" };
}

/** Owner, anyone above the owner in the reporting line, Head and Admin can edit. */
export async function canEditClient(user: CurrentUser, client: { ownerId: string | null }): Promise<boolean> {
  if (hasRole(user.roles, "ADMIN", "HEAD_OF_ENTERPRISE")) return true;
  if (!hasRole(user.roles, "MANAGER", "ACCOUNT_MANAGER")) return false;
  if (!client.ownerId) return hasRole(user.roles, "MANAGER");
  if (client.ownerId === user.id) return true;
  return (await getTeamIds(user.id)).includes(client.ownerId);
}

export async function canDeleteClient(user: CurrentUser, client: { ownerId: string | null }) {
  return hasRole(user.roles, "ADMIN", "HEAD_OF_ENTERPRISE", "MANAGER") && (await canEditClient(user, client));
}

export const CLIENT_STATUS_LABELS = { PROSPECT: "Prospect", ACTIVE: "Active", INACTIVE: "Inactive" } as const;
export const CLIENT_STATUS_TONE = { PROSPECT: "blue", ACTIVE: "green", INACTIVE: "gray" } as const;
