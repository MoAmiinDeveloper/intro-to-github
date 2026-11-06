import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  HEAD_OF_ENTERPRISE: "Head of Enterprise",
  MANAGER: "Manager",
  ACCOUNT_MANAGER: "Sector Manager / Account Manager",
  ENTERPRISE_SUPPORT: "Enterprise Support",
  PROCUREMENT: "Procurement",
  FINANCE: "Finance",
  BILLING: "Billing",
  TECH: "Tech Section",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];

export type Permission =
  | "settings.manage"
  | "users.manage"
  | "catalog.view"
  | "catalog.manage"
  | "clients.view"
  | "clients.viewAll"
  | "clients.create"
  | "clients.assignOwner"
  | "audit.view";

const PERMISSIONS: Record<Permission, Role[]> = {
  "settings.manage": ["ADMIN"],
  "users.manage": ["ADMIN"],
  "catalog.manage": ["ADMIN"],
  "catalog.view": [
    "ADMIN",
    "HEAD_OF_ENTERPRISE",
    "MANAGER",
    "ACCOUNT_MANAGER",
    "ENTERPRISE_SUPPORT",
    "PROCUREMENT",
    "FINANCE",
    "BILLING",
  ],
  // Who can open the clients area at all.
  "clients.view": [
    "ADMIN",
    "HEAD_OF_ENTERPRISE",
    "MANAGER",
    "ACCOUNT_MANAGER",
    "ENTERPRISE_SUPPORT",
    "PROCUREMENT",
    "FINANCE",
    "BILLING",
  ],
  // Who sees every client (read). Sales people and managers see their own and their team's.
  "clients.viewAll": ["ADMIN", "HEAD_OF_ENTERPRISE", "ENTERPRISE_SUPPORT", "PROCUREMENT", "FINANCE", "BILLING"],
  "clients.create": ["ADMIN", "HEAD_OF_ENTERPRISE", "MANAGER", "ACCOUNT_MANAGER"],
  "clients.assignOwner": ["ADMIN", "HEAD_OF_ENTERPRISE", "MANAGER"],
  "audit.view": ["ADMIN", "HEAD_OF_ENTERPRISE"],
};

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => r === "ADMIN" || PERMISSIONS[permission].includes(r));
}

export function hasRole(roles: readonly Role[], ...wanted: Role[]): boolean {
  return roles.some((r) => wanted.includes(r));
}

/**
 * Users in the reporting line below `rootId` (direct and indirect reports).
 * Works on an in-memory list so it can be unit tested.
 */
export function teamMemberIds(
  rootId: string,
  users: readonly { id: string; managerId: string | null }[],
): string[] {
  const byManager = new Map<string, string[]>();
  for (const u of users) {
    if (!u.managerId) continue;
    const list = byManager.get(u.managerId) ?? [];
    list.push(u.id);
    byManager.set(u.managerId, list);
  }
  const out: string[] = [];
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of byManager.get(id) ?? []) {
      if (seen.has(child)) continue; // guards against loops in bad data
      seen.add(child);
      out.push(child);
      queue.push(child);
    }
  }
  return out;
}

/**
 * True if making `managerId` the manager of `userId` would create a loop.
 */
export function wouldCreateLoop(
  userId: string,
  managerId: string | null,
  users: readonly { id: string; managerId: string | null }[],
): boolean {
  if (!managerId) return false;
  if (managerId === userId) return true;
  return teamMemberIds(userId, users).includes(managerId);
}
