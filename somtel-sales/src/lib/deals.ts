import "server-only";
import type { Prisma } from "@prisma/client";
import { getTeamIds, type CurrentUser } from "./session";
import { hasPermission, hasRole } from "./roles";

/** Which deals this user can see. */
export async function dealScope(user: CurrentUser): Promise<Prisma.DealWhereInput> {
  if (hasPermission(user.roles, "deals.viewAll")) return {};
  if (hasPermission(user.roles, "deals.view")) {
    const team = await getTeamIds(user.id);
    return { ownerId: { in: [user.id, ...team] } };
  }
  return { id: "__none__" };
}

/** Owner, anyone above the owner in the reporting line, Head and Admin. */
export async function canEditDeal(user: CurrentUser, deal: { ownerId: string }): Promise<boolean> {
  if (hasRole(user.roles, "ADMIN", "HEAD_OF_ENTERPRISE")) return true;
  if (!hasPermission(user.roles, "deals.view")) return false;
  if (deal.ownerId === user.id) return true;
  return (await getTeamIds(user.id)).includes(deal.ownerId);
}

/** Users this person may assign as deal owner. */
export async function assignableOwnerIds(user: CurrentUser): Promise<string[] | "all"> {
  if (hasRole(user.roles, "ADMIN", "HEAD_OF_ENTERPRISE")) return "all";
  if (hasPermission(user.roles, "deals.assignOwner")) return [user.id, ...(await getTeamIds(user.id))];
  return [user.id];
}

export const ACTIVITY_LABELS = { CALL: "Call", MEETING: "Meeting", EMAIL: "Email", NOTE: "Note", STAGE_CHANGE: "Stage change" } as const;
