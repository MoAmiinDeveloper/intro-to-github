import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { TERMS_CATEGORY_LABELS } from "./labels";

export const metadata = { title: "T&C templates" };

export default async function TermsPage() {
  const templates = await prisma.termsTemplate.findMany({ where: { deletedAt: null }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader
        title="Terms and Conditions templates"
        description="Sales pick a template on each quote and can edit the text for that quote."
        actions={
          <Link href="/settings/terms/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> New template
          </Link>
        }
      />
      {templates.length === 0 ? (
        <EmptyState title="No templates yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Link key={t.id} href={`/settings/terms/${t.id}`} className="block">
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-navy">{t.name}</div>
                  <div className="flex gap-1">
                    <Badge tone="navy">{TERMS_CATEGORY_LABELS[t.category]}</Badge>
                    {!t.active && <Badge>Inactive</Badge>}
                  </div>
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-gray-600">{t.body}</p>
                <p className="mt-2 text-xs text-gray-400">Updated {formatDate(t.updatedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
