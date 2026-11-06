import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "./user-form";

export const metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = id === "new" ? null : await prisma.user.findFirst({ where: { id, deletedAt: null }, include: { roles: true, sectors: true, techSections: true } });
  if (id !== "new" && !user) notFound();
  const [managers, sectors, techSections] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, deletedAt: null, NOT: user ? { id: user.id } : undefined, roles: { some: { role: { in: ["MANAGER", "HEAD_OF_ENTERPRISE", "ADMIN"] } } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.sector.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.techSection.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title={user ? user.name : "New user"} breadcrumbs={[{ label: "Users", href: "/settings/users" }, { label: user ? user.name : "New" }]} />
      <UserForm
        values={
          user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                title: user.title,
                active: user.active,
                managerId: user.managerId,
                roles: user.roles.map((r) => r.role),
                sectorIds: user.sectors.map((s) => s.sectorId),
                techSectionIds: user.techSections.map((t) => t.techSectionId),
              }
            : { active: true, roles: [], sectorIds: [], techSectionIds: [] }
        }
        managers={managers}
        sectors={sectors}
        techSections={techSections}
      />
    </div>
  );
}
