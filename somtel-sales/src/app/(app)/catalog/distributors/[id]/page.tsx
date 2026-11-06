import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deleteDistributorContactAction } from "../../it/actions";
import { DistributorContactForm, DistributorForm } from "./forms";

export const metadata = { title: "Distributor" };

export default async function DistributorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const isNew = id === "new";
  if (isNew && !admin) notFound();
  const d = isNew
    ? null
    : await prisma.distributor.findFirst({
        where: { id, deletedAt: null },
        include: { contacts: { orderBy: { name: "asc" } }, vendors: { include: { vendor: true }, orderBy: { vendor: { name: "asc" } } } },
      });
  if (!isNew && !d) notFound();
  const recentCosts =
    d && can(user, "costs.view")
      ? await prisma.distributorPrice.findMany({
          where: { distributorId: d.id },
          orderBy: [{ quotedAt: "desc" }, { createdAt: "desc" }],
          take: 15,
          include: { subProduct: { include: { product: { include: { vendor: true } } } } },
        })
      : [];

  return (
    <>
      <PageHeader title={d ? d.name : "New distributor"} breadcrumbs={[{ label: "Distributors", href: "/catalog/distributors" }, { label: d ? d.name : "New" }]} />
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-2">
          {admin ? (
            <DistributorForm values={d ?? { currency: "USD", active: true }} />
          ) : (
            d && (
              <Card>
                <CardBody className="space-y-1 text-sm">
                  <p>{[d.country, d.currency].filter(Boolean).join(" · ")}</p>
                  {d.paymentTerms && <p>Payment terms: {d.paymentTerms}</p>}
                  {d.notes && <p className="whitespace-pre-wrap text-gray-700">{d.notes}</p>}
                </CardBody>
              </Card>
            )
          )}
        </div>
        {d && (
          <div className="space-y-5 xl:col-span-3">
            <Card>
              <CardHeader title="Vendors carried" description={admin ? "Link vendors from each vendor's page." : undefined} />
              <CardBody className="flex flex-wrap gap-2">
                {d.vendors.length === 0 && <p className="text-sm text-gray-500">None linked yet.</p>}
                {d.vendors.map((v) => (
                  <Link key={v.vendorId} href={`/catalog/vendors/${v.vendorId}`} className="rounded-full border border-navy-100 bg-navy-50 px-3 py-1 text-sm text-navy hover:bg-navy-100">
                    {v.vendor.name}
                    {v.partnerLevel && <span className="text-xs text-gray-500"> · {v.partnerLevel}</span>}
                  </Link>
                ))}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Contacts" />
              <CardBody className="space-y-3">
                {d.contacts.length === 0 && <p className="text-sm text-gray-500">No contacts yet.</p>}
                {d.contacts.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      {c.title && <div className="text-gray-500">{c.title}</div>}
                      <div className="flex flex-wrap gap-3 text-gray-600">
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-navy">
                            <Mail className="h-3.5 w-3.5" /> {c.email}
                          </a>
                        )}
                      </div>
                    </div>
                    {admin && (
                      <form action={deleteDistributorContactAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmSubmit variant="ghost" size="icon" title="Remove" message={`Remove ${c.name}?`} pendingText="">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </ConfirmSubmit>
                      </form>
                    )}
                  </div>
                ))}
                {admin && (
                  <div className="border-t border-gray-100 pt-4">
                    <DistributorContactForm distributorId={d.id} />
                  </div>
                )}
              </CardBody>
            </Card>
            {recentCosts.length > 0 && (
              <Card>
                <CardHeader title="Recent costs from this distributor" />
                <Table>
                  <THead>
                    <tr>
                      <TH>Quoted</TH>
                      <TH>Item</TH>
                      <TH className="text-right">Unit cost</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {recentCosts.map((c) => (
                      <TR key={c.id}>
                        <TD className="text-xs">{formatDate(c.quotedAt)}</TD>
                        <TD>
                          <Link href={`/catalog/it/sub-products/${c.subProductId}`} className="text-navy hover:underline">
                            {c.subProduct.name}
                          </Link>
                          <div className="text-xs text-gray-500">
                            {c.subProduct.product.vendor.name} · {c.subProduct.product.name}
                          </div>
                        </TD>
                        <TD className="text-right">
                          {Number(c.unitCost).toLocaleString("en-US", { maximumFractionDigits: 4 })} {c.currency}
                        </TD>
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
