import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LIST_KINDS, isListKind } from "../config";
import { AddListItem, ListRow } from "../list-editor";

export default async function ListPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isListKind(kind)) notFound();
  const cfg = LIST_KINDS[kind];
  const orderBy = [{ sortOrder: "asc" as const }, { name: "asc" as const }];
  const rows =
    kind === "sectors"
      ? await prisma.sector.findMany({ orderBy })
      : kind === "tech-sections"
        ? await prisma.techSection.findMany({ orderBy })
        : kind === "it-categories"
          ? await prisma.itCategory.findMany({ orderBy })
          : await prisma.lostReason.findMany({ orderBy });

  return (
    <>
      <PageHeader title={cfg.title} description={cfg.help} />
      <Card className="mb-5">
        <CardHeader title={`Add a ${cfg.singular}`} />
        <CardBody>
          <AddListItem kind={kind} hasEmail={cfg.hasEmail} singular={cfg.singular} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`${rows.length} ${rows.length === 1 ? cfg.singular : cfg.title.toLowerCase()}`} description="Switch off items you no longer use. They stay on old records." />
        {rows.length === 0 && <p className="px-5 py-4 text-sm text-gray-500">None yet.</p>}
        {rows.map((r) => (
          <ListRow key={r.id} kind={kind} row={r} hasEmail={cfg.hasEmail} />
        ))}
      </Card>
    </>
  );
}
