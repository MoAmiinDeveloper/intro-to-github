import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { effectiveMarkup } from "@/lib/it-catalog";
import { IT_KIND_LABELS } from "@/lib/pricing";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deleteProductAction } from "../../actions";
import { ProductForm } from "./product-form";

export const metadata = { title: "IT product" };

export default async function ItProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vendor?: string }> }) {
  const { id } = await params;
  const { vendor: vendorParam } = await searchParams;
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const isNew = id === "new";
  if (isNew && !admin) notFound();
  const product = isNew
    ? null
    : await prisma.itProduct.findFirst({
        where: { id, deletedAt: null },
        include: { vendor: true, category: true, subProducts: { where: { deletedAt: null }, orderBy: [{ kind: "asc" }, { name: "asc" }] } },
      });
  if (!isNew && !product) notFound();

  const [vendors, categories] = await Promise.all([
    prisma.vendor.findMany({ where: { deletedAt: null, active: true }, orderBy: { name: "asc" } }),
    prisma.itCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const defaults = {
    hardware: (await getSetting<number>("costing.markupHardwarePct")) ?? 20,
    software: (await getSetting<number>("costing.markupLicencePct")) ?? 10,
  };

  return (
    <>
      <PageHeader
        title={product ? product.name : "New IT product"}
        description={product ? `${product.vendor.name} · ${product.category.name}` : undefined}
        breadcrumbs={[{ label: "IT products", href: "/catalog/it" }, ...(product ? [{ label: product.vendor.name, href: `/catalog/vendors/${product.vendorId}` }] : []), { label: product ? product.name : "New" }]}
        actions={
          admin &&
          product && (
            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <ConfirmSubmit variant="outline" className="text-red-600" message={`Delete ${product.name} and its sub-products?`} pendingText="Deleting...">
                <Trash2 className="h-4 w-4" /> Delete product
              </ConfirmSubmit>
            </form>
          )
        }
      />
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          {admin ? (
            <ProductForm
              values={product ?? { vendorId: vendorParam ?? "", categoryId: "", active: true }}
              vendors={vendors}
              categories={categories}
            />
          ) : (
            product?.description && (
              <Card>
                <CardBody className="whitespace-pre-wrap text-sm text-gray-700">{product.description}</CardBody>
              </Card>
            )
          )}
        </div>
        {product && (
          <Card className="xl:col-span-3">
            <CardHeader
              title="Sub-products"
              description="Hardware can have customs on costing. Software cannot."
              actions={
                admin && (
                  <Link href={`/catalog/it/sub-products/new?product=${product.id}`} className={buttonClass("primary", "sm")}>
                    <Plus className="h-3.5 w-3.5" /> New sub-product
                  </Link>
                )
              }
            />
            {product.subProducts.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">No sub-products yet.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Sub-product</TH>
                    <TH>Type</TH>
                    <TH>Part number</TH>
                    <TH>Markup</TH>
                    {admin && <TH />}
                  </tr>
                </THead>
                <TBody>
                  {product.subProducts.map((s) => {
                    const own = toNumber(s.markupPct);
                    return (
                      <TR key={s.id}>
                        <TD>
                          <Link href={`/catalog/it/sub-products/${s.id}`} className="font-medium text-navy hover:underline">
                            {s.name}
                          </Link>
                          {s.termMonths && <div className="text-xs text-gray-500">{s.termMonths} months</div>}
                          {!s.active && <Badge className="mt-1">Inactive</Badge>}
                        </TD>
                        <TD>
                          <Badge tone={s.kind === "HARDWARE" ? "blue" : "gold"}>{IT_KIND_LABELS[s.kind]}</Badge>
                        </TD>
                        <TD className="font-mono text-xs">{s.sku}</TD>
                        <TD className="text-xs">
                          {effectiveMarkup(own, s.kind, defaults)}%{own === null && <span className="text-gray-400"> (default)</span>}
                        </TD>
                        {admin && (
                          <TD className="text-right">
                            <Link href={`/catalog/it/sub-products/${s.id}?edit=1`} className={buttonClass("ghost", "icon")} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </TD>
                        )}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
