import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmit } from "@/components/ui/form";
import { deleteTemplateAction } from "../actions";
import { TemplateForm } from "./template-form";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = id === "new" ? null : await prisma.termsTemplate.findFirst({ where: { id, deletedAt: null } });
  if (id !== "new" && !t) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t ? t.name : "New T&C template"}
        breadcrumbs={[{ label: "T&C templates", href: "/settings/terms" }, { label: t ? t.name : "New" }]}
        actions={
          t && (
            <form action={deleteTemplateAction}>
              <input type="hidden" name="id" value={t.id} />
              <ConfirmSubmit variant="outline" className="text-red-600" message={`Delete template ${t.name}?`}>
                <Trash2 className="h-4 w-4" /> Delete
              </ConfirmSubmit>
            </form>
          )
        }
      />
      <TemplateForm values={t ?? { category: "GENERAL", active: true }} />
    </div>
  );
}
