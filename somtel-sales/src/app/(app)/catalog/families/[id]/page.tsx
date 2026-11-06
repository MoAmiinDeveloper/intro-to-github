import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { FamilyForm } from "./family-form";

export const metadata = { title: "Product family" };

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("catalog.manage");
  const family = id === "new" ? null : await prisma.productFamily.findFirst({ where: { id, deletedAt: null } });
  if (id !== "new" && !family) notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader
        title={family ? `Edit ${family.name}` : "New product family"}
        breadcrumbs={[{ label: "Catalog", href: "/catalog" }, { label: family ? family.name : "New family" }]}
      />
      <FamilyForm values={family ?? { enabled: true, sortOrder: 0 }} />
    </div>
  );
}
