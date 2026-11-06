import Link from "next/link";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/session";
import { clientScope, groupScope } from "@/lib/clients";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw = "" } = await searchParams;
  const q = raw.trim();
  const user = await requireUser();
  if (!q || !can(user, "clients.view")) return <PageHeader title="Search" description="Type in the search box at the top." />;
  const scope = await clientScope(user);
  const [groups, clients, contacts] = await Promise.all([
    prisma.clientGroup.findMany({
      where: { AND: [await groupScope(user), { deletedAt: null, name: { contains: q, mode: "insensitive" } }] },
      take: 20,
      orderBy: { name: "asc" },
      include: { _count: { select: { entities: { where: { deletedAt: null } } } } },
    }),
    prisma.client.findMany({
      where: { AND: [scope, { deletedAt: null }, { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { industry: { contains: q, mode: "insensitive" } }] }] },
      take: 20,
      orderBy: { name: "asc" },
      include: { sector: true },
    }),
    prisma.contact.findMany({
      where: {
        deletedAt: null,
        client: { AND: [scope, { deletedAt: null }] },
        OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }],
      },
      take: 20,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <>
      <PageHeader title={`Results for "${q}"`} />
      {groups.length === 0 && clients.length === 0 && contacts.length === 0 && <EmptyState title="Nothing found" />}
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.length > 0 && (
          <Card>
            <CardHeader title={`Groups (${groups.length})`} />
            <div className="divide-y divide-gray-100">
              {groups.map((g) => (
                <Link key={g.id} href={`/clients/groups/${g.id}`} className="block px-5 py-2.5 text-sm hover:bg-gray-50">
                  <span className="font-medium text-navy">{g.name}</span>
                  <span className="ml-2 text-gray-500">{g._count.entities} entities</span>
                </Link>
              ))}
            </div>
          </Card>
        )}
        {clients.length > 0 && (
          <Card>
            <CardHeader title={`Entities (${clients.length})`} />
            <div className="divide-y divide-gray-100">
              {clients.map((c) => (
                <Link key={c.id} href={`/clients/${c.id}`} className="block px-5 py-2.5 text-sm hover:bg-gray-50">
                  <span className="font-medium text-navy">{c.name}</span>
                  <span className="ml-2 text-gray-500">{[c.sector?.name, c.city].filter(Boolean).join(" · ")}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}
        {contacts.length > 0 && (
          <Card>
            <CardHeader title={`People (${contacts.length})`} />
            <div className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <Link key={c.id} href={`/clients/${c.client.id}?tab=contacts`} className="block px-5 py-2.5 text-sm hover:bg-gray-50">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  <span className="ml-2 text-gray-500">{c.client.name}</span>
                  <div className="text-xs text-gray-500">{[c.title, c.phone, c.email].filter(Boolean).join(" · ")}</div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
