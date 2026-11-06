import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { planPriceSummary } from "@/lib/catalog";
import { PRODUCT_TYPE_LABELS } from "@/lib/pricing";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { toggleCategoryAction } from "./actions";
import { CatalogTabs } from "./tabs";

export const metadata = { title: "Somtel services" };

export default async function CatalogPage() {
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const categories = await prisma.serviceCategory.findMany({
    where: { deletedAt: null, ...(admin ? {} : { enabled: true }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      services: {
        where: { deletedAt: null, ...(admin ? {} : { active: true }) },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          techSections: { include: { techSection: true } },
          plans: { where: { deletedAt: null, ...(admin ? {} : { active: true }) }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { tiers: true } },
        },
      },
    },
  });

  return (
    <>
      <PageHeader
        title="Products catalog"
        description="Somtel services: category, then service, then plan. The price is set on the plan."
        actions={
          admin && (
            <Link href="/catalog/categories/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New category
            </Link>
          )
        }
      />
      <CatalogTabs active="services" />
      <div className="space-y-5">
        {categories.map((f) => (
          <Card key={f.id} className={f.enabled ? "" : "opacity-75"}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {f.name}
                  {!f.enabled && <Badge tone="gray">Switched off</Badge>}
                </span>
              }
              description={f.description ?? undefined}
              actions={
                admin && (
                  <>
                    <form action={toggleCategoryAction}>
                      <input type="hidden" name="id" value={f.id} />
                      <button className={buttonClass("outline", "sm")}>{f.enabled ? "Switch off" : "Switch on"}</button>
                    </form>
                    <Link href={`/catalog/categories/${f.id}`} className={buttonClass("ghost", "sm")}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                    <Link href={`/catalog/services/new?category=${f.id}`} className={buttonClass("navy", "sm")}>
                      <Plus className="h-3.5 w-3.5" /> Service
                    </Link>
                  </>
                )
              }
            />
            {f.services.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">No services yet.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH className="w-1/4">Service</TH>
                    <TH>Type</TH>
                    <TH>Tech sections</TH>
                    <TH>Plans and prices</TH>
                  </tr>
                </THead>
                <TBody>
                  {f.services.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <Link href={`/catalog/services/${s.id}`} className="font-medium text-navy hover:underline">
                          {s.name}
                        </Link>
                        {!s.active && <Badge className="ml-2">Inactive</Badge>}
                      </TD>
                      <TD>
                        <Badge tone={s.productType === "TRACKING" ? "amber" : "navy"}>{PRODUCT_TYPE_LABELS[s.productType]}</Badge>
                      </TD>
                      <TD className="text-xs">
                        {s.techSections.length ? s.techSections.map((t) => t.techSection.name).join(", ") : <span className="text-gray-400">None</span>}
                      </TD>
                      <TD>
                        <ul className="space-y-0.5 text-xs">
                          {s.plans.map((p) => (
                            <li key={p.id} className={p.active ? "" : "text-gray-400 line-through"}>
                              <span className="font-medium text-gray-800">{p.name}:</span> {planPriceSummary(p)}
                            </li>
                          ))}
                          {s.plans.length === 0 && <li className="text-gray-400">No plans</li>}
                        </ul>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
