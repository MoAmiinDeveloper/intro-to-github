import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission, ROLE_LABELS } from "@/lib/roles";
import { NAV } from "@/components/shell/nav";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
  const items = NAV.filter((i) => !i.permission || hasPermission(user.roles, i.permission));
  const roleLabel = user.roles.map((r) => ROLE_LABELS[r]).join(", ") || "No role yet";

  return (
    <div className="min-h-screen">
      <Sidebar items={items} />
      <div className="md:pl-60">
        <TopBar name={user.name} roleLabel={roleLabel} unread={unread} />
        <MobileNav items={items} />
        <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
