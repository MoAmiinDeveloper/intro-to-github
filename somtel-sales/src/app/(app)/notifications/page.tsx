import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };

async function markAllRead() {
  "use server";
  const me = await getCurrentUser();
  if (!me) return;
  await prisma.notification.updateMany({ where: { userId: me.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const me = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "All caught up"}
        actions={
          unread > 0 && (
            <form action={markAllRead}>
              <Button variant="outline">Mark all as read</Button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet">Approvals, tasks handed to you, follow-ups and renewals will show here.</EmptyState>
      ) : (
        <Card className="divide-y divide-gray-100">
          {items.map((n) => {
            const body = (
              <div className={cn("flex gap-3 px-5 py-3", !n.readAt && "bg-gold-50/60")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-gray-300" : "bg-gold")} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{n.title}</div>
                  {n.body && <div className="text-sm text-gray-600">{n.body}</div>}
                  <div className="text-xs text-gray-400">{formatDateTime(n.createdAt)}</div>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-gray-50">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </Card>
      )}
    </>
  );
}
