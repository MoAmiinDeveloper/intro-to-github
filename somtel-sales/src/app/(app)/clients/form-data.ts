import "server-only";
import { prisma } from "@/lib/db";
import { getTeamIds, type CurrentUser } from "@/lib/session";
import { hasRole } from "@/lib/roles";

/** Sectors and the owners this user may assign. */
export async function clientFormOptions(user: CurrentUser) {
  const sectors = await prisma.sector.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  let owners;
  if (hasRole(user.roles, "ADMIN", "HEAD_OF_ENTERPRISE")) {
    owners = await prisma.user.findMany({
      where: { active: true, deletedAt: null, roles: { some: { role: { in: ["ACCOUNT_MANAGER", "MANAGER", "HEAD_OF_ENTERPRISE"] } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } else {
    const ids = [user.id, ...(await getTeamIds(user.id))];
    owners = await prisma.user.findMany({
      where: { id: { in: ids }, active: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }
  return { sectors, owners };
}
