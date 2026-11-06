import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { effectiveMarkup, latestCostPerDistributor } from "@/lib/it-catalog";
import { IT_KIND_LABELS } from "@/lib/pricing";
import { formatDate, formatMoney, toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deleteSubProductAction } from "../../actions";
import { SubProductForm } from "./sub-product-form";
import { CostForm } from "./cost-form";

export const metadata = { title: "Sub-product" };

export default async function SubProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ product?: string; edit?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const isNew = id === "new";
  if (isNew && !admin) notFound();

  const sub = isNew ? null : await prisma.itSubProduct.findFirst({ where: { id, deletedAt: null } });
  if (!isNew && !sub) notFound();
  const product = await prisma.itProduct.findFirst({ where: { id: sub?.productId ?? sp.product ?? "", deletedAt: null }, include: { vendor: true, category: true } });
  if (!product) notFound();

  const defaults = {
    hardware: (await getSetting<number>("costing.markupHardwarePct")) ?? 20,
    software: (await getSetting<number>("costing.markupLicencePct")) ?? 10,
  };
  const editing = admin && (isNew || sp.edit === "1");
  const showCosts = !isNew && can(user, "costs.view");

  const [costs, distributors] = showCosts
    ? await Promise.all([
        prisma.distributorPrice.findMany({
          where: { subProductId: id },
          include: { distributor: { select: { name: true } }, },
          orderBy: [{ quotedAt: "desc" }, { createdAt: "desc" }],
          take: 100,
        }),
        prisma.distributor.findMany({
          where: { deletedAt: null, active: true, vendors: { some: { vendorId: product.vendorId } } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, currency: true },
        }),
      ])
    : [[], []];

  const latest = latestCostPerDistributor(
    costs.map((c) => ({ ...c, unitCost: Number(c.unitCost), exchangeRate: Number(c.exchangeRate), distributorName: c.distributor.name })),
  );
  const markup = sub ? effectiveMarkup(toNumber(sub.markupPct), sub.kind, defaults) : null;

  return (
    <>
      <PageHeader
        title={sub ? sub.name : "New sub-product"}
        description={`${product.vendor.name} · ${product.category.name} · ${product.name}`}
        breadcrumbs={[
          { label: "IT products", href: "/catalog/it" },
          { label: product.vendor.name, href: `/catalog/vendors/${product.vendorId}` },
          { label: product.name, href: `/catalog/it/products/${product.id}` },
          { label: sub ? sub.name : "New sub-product" },
        ]}
        actions={
          admin &&
          sub && (
            <>
              {!editing && (
                <Link href={`/catalog/it/sub-products/${sub.id}?edit=1`} className={buttonClass("outline")}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              )}
              <form action={deleteSubProductAction}>
                <input type="hidden" name="id" value={sub.id} />
                <ConfirmSubmit variant="outline" className="text-red-600" message={`Delete ${sub.name}?`} pendingText="Deleting...">
                  <Trash2 className="h-4 w-4" /> Delete
                </ConfirmSubmit>
              </form>
            </>
          )
        }
      />
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-2">
          {editing ? (
            <SubProductForm
              productId={product.id}
              defaults={defaults}
              values={
                sub
                  ? { ...sub, termMonths: sub.termMonths?.toString() ?? "", markupPct: sub.markupPct?.toString() ?? "" }
                  : { kind: "HARDWARE", active: true, termMonths: "", markupPct: "" }
              }
            />
          ) : (
            sub && (
              <Card>
                <CardHeader title="Details" />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={sub.kind === "HARDWARE" ? "blue" : "gold"}>{IT_KIND_LABELS[sub.kind]}</Badge>
                    {!sub.active && <Badge>Inactive</Badge>}
                  </div>
                  <dl className="grid grid-cols-2 gap-3">
                    <div><dt className="text-xs uppercase text-gray-500">Part number</dt><dd className="font-mono">{sub.sku || "Not set"}</dd></div>
                    <div><dt className="text-xs uppercase text-gray-500">Unit</dt><dd>{sub.unitLabel || "Not set"}</dd></div>
                    {sub.kind === "SOFTWARE" && <div><dt className="text-xs uppercase text-gray-500">Term</dt><dd>{sub.termMonths ? `${sub.termMonths} months` : "Not set"}</dd></div>}
                    <div><dt className="text-xs uppercase text-gray-500">Markup</dt><dd>{markup}%{sub.markupPct === null && " (default)"}</dd></div>
                  </dl>
                  {sub.quoteDescription && (
                    <div>
                      <div className="text-xs uppercase text-gray-500">Text on the quote</div>
                      <p className="mt-1 whitespace-pre-wrap">{sub.quoteDescription}</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          )}
          {showCosts && can(user, "costs.record") && (
            <Card>
              <CardHeader title="Record a distributor cost" description="From a distributor quote or PI. Internal only." />
              <CardBody>
                {distributors.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No distributor is linked to {product.vendor.name} yet.{" "}
                    {admin && (
                      <Link href={`/catalog/vendors/${product.vendorId}`} className="text-navy underline">
                        Link one on the vendor page.
                      </Link>
                    )}
                  </p>
                ) : (
                  <CostForm subProductId={id} distributors={distributors} />
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {showCosts && (
          <div className="space-y-5 xl:col-span-3">
            <Card>
              <CardHeader title="Last cost from each distributor" description={markup !== null ? `Cheapest first. Selling price shown with ${markup}% markup, before remittance, bank charges, freight and customs.` : undefined} />
              {latest.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">No costs recorded yet.</p>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Distributor</TH>
                      <TH>Quoted</TH>
                      <TH className="text-right">Unit cost</TH>
                      <TH className="text-right">In USD</TH>
                      <TH className="text-right">With markup</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {latest.map((c, i) => (
                      <TR key={c.id}>
                        <TD>
                          {c.distributorName} {i === 0 && latest.length > 1 && <Badge tone="green">Cheapest</Badge>}
                        </TD>
                        <TD className="text-xs">{formatDate(c.quotedAt)}{c.reference && <div className="text-gray-500">{c.reference}</div>}</TD>
                        <TD className="text-right">{c.unitCost.toLocaleString("en-US", { maximumFractionDigits: 4 })} {c.currency}</TD>
                        <TD className="text-right">{formatMoney(c.usd)}</TD>
                        <TD className="text-right font-medium">{formatMoney(c.usd * (1 + (markup ?? 0) / 100))}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
            {costs.length > latest.length && (
              <Card>
                <CardHeader title="Cost history" />
                <Table>
                  <THead>
                    <tr>
                      <TH>Quoted</TH>
                      <TH>Distributor</TH>
                      <TH>Reference</TH>
                      <TH className="text-right">Unit cost</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {costs.map((c) => (
                      <TR key={c.id}>
                        <TD className="text-xs">{formatDate(c.quotedAt)}</TD>
                        <TD>{c.distributor.name}</TD>
                        <TD className="text-xs">{c.reference}</TD>
                        <TD className="text-right">{Number(c.unitCost).toLocaleString("en-US", { maximumFractionDigits: 4 })} {c.currency}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
