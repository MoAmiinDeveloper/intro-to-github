import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { CategoryForm } from "./category-form";

export const metadata = { title: "Service category" };

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("catalog.manage");
  const category = id === "new" ? null : await prisma.serviceCategory.findFirst({ where: { id, deletedAt: null } });
  if (id !== "new" && !category) notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader
        title={category ? `Edit ${category.name}` : "New category"}
        breadcrumbs={[{ label: "Somtel services", href: "/catalog" }, { label: category ? category.name : "New category" }]}
      />
      <CategoryForm values={category ?? { enabled: true, sortOrder: 0 }} />
    </div>
  );
}
