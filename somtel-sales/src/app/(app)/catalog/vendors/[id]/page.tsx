import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { removeVendorDistributorAction } from "../../it/actions";
import { VendorForm, VendorDistributorForm } from "./forms";

export const metadata = { title: "Vendor" };

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const isNew = id === "new";
  if (isNew && !admin) notFound();
  const vendor = isNew
    ? null
    : await prisma.vendor.findFirst({
        where: { id, deletedAt: null },
        include: {
          distributors: { include: { distributor: true }, orderBy: { distributor: { name: "asc" } } },
          products: { where: { deletedAt: null }, include: { category: true, _count: { select: { subProducts: { where: { deletedAt: null } } } } }, orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }] },
        },
      });
  if (!isNew && !vendor) notFound();
  const allDistributors = admin ? await prisma.distributor.findMany({ where: { deletedAt: null, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  const linked = new Set(vendor?.distributors.map((d) => d.distributorId));

  return (
    <>
      <PageHeader title={vendor ? vendor.name : "New vendor"} breadcrumbs={[{ label: "Vendors", href: "/catalog/vendors" }, { label: vendor ? vendor.name : "New" }]} />
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          {admin ? (
            <VendorForm values={vendor ?? { active: true }} />
          ) : (
            vendor && (
              <Card>
                <CardBody className="space-y-2 text-sm">
                  {vendor.website && <p>{vendor.website}</p>}
                  {vendor.notes && <p className="whitespace-pre-wrap text-gray-700">{vendor.notes}</p>}
                </CardBody>
              </Card>
            )
          )}
        </div>
        {vendor && (
          <div className="space-y-5 xl:col-span-3">
            <Card>
              <CardHeader title="Distributors" description="Where Somtel buys this vendor's products." />
              {vendor.distributors.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">No distributors linked yet.</p>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Distributor</TH>
                      <TH>Partner level</TH>
                      <TH>Our account no.</TH>
                      <TH>Notes</TH>
                      {admin && <TH />}
                    </tr>
                  </THead>
                  <TBody>
                    {vendor.distributors.map((l) => (
                      <TR key={l.distributorId}>
                        <TD>
                          <Link href={`/catalog/distributors/${l.distributorId}`} className="font-medium text-navy hover:underline">
                            {l.distributor.name}
                          </Link>
                          <div className="text-xs text-gray-500">{[l.distributor.country, l.distributor.currency].filter(Boolean).join(" · ")}</div>
                        </TD>
                        <TD className="text-xs">{l.partnerLevel}</TD>
                        <TD className="font-mono text-xs">{l.accountNumber}</TD>
                        <TD className="text-xs">{l.notes}</TD>
                        {admin && (
                          <TD className="text-right">
                            <form action={removeVendorDistributorAction}>
                              <input type="hidden" name="vendorId" value={vendor.id} />
                              <input type="hidden" name="distributorId" value={l.distributorId} />
                              <ConfirmSubmit variant="ghost" size="icon" title="Remove link" message={`Remove ${l.distributor.name} as a distributor of ${vendor.name}?`} pendingText="">
                                <X className="h-4 w-4 text-red-600" />
                              </ConfirmSubmit>
                            </form>
                          </TD>
                        )}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
              {admin && (
                <CardBody className="border-t border-gray-100">
                  <VendorDistributorForm vendorId={vendor.id} distributors={allDistributors} linkedIds={[...linked]} />
                </CardBody>
              )}
            </Card>
            <Card>
              <CardHeader
                title="Products"
                actions={
                  admin && (
                    <Link href={`/catalog/it/products/new?vendor=${vendor.id}`} className={buttonClass("primary", "sm")}>
                      <Plus className="h-3.5 w-3.5" /> New product
                    </Link>
                  )
                }
              />
              {vendor.products.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">No products yet.</p>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Product</TH>
                      <TH>Category</TH>
                      <TH className="text-right">Sub-products</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {vendor.products.map((p) => (
                      <TR key={p.id}>
                        <TD>
                          <Link href={`/catalog/it/products/${p.id}`} className="text-navy hover:underline">
                            {p.name}
                          </Link>
                        </TD>
                        <TD className="text-xs">{p.category.name}</TD>
                        <TD className="text-right">{p._count.subProducts}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
