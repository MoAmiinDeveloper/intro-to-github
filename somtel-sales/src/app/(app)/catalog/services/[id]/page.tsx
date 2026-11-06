import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { getSetting } from "@/lib/settings";
import { planPriceSummary } from "@/lib/catalog";
import { BILLING_FREQUENCY_LABELS, ITEM_KIND_LABELS, PRICE_TYPE_LABELS, PRODUCT_TYPE_LABELS } from "@/lib/pricing";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/form";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deleteServiceAction } from "../../actions";
import { ServiceForm } from "./service-form";

export const metadata = { title: "Service" };

export default async function ServicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ family?: string }> }) {
  const { id } = await params;
  const { family: familyParam } = await searchParams;
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const isNew = id === "new";
  if (isNew && !admin) notFound();

  const service = isNew
    ? null
    : await prisma.service.findFirst({
        where: { id, deletedAt: null },
        include: {
          family: true,
          techSections: { include: { techSection: true } },
          plans: { where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { tiers: true } },
        },
      });
  if (!isNew && !service) notFound();

  const [families, techSections] = await Promise.all([
    prisma.productFamily.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.techSection.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const defaults = {
    licence: (await getSetting<number>("costing.markupLicencePct")) ?? 10,
    hardware: (await getSetting<number>("costing.markupHardwarePct")) ?? 20,
  };

  const familyName = service?.family.name ?? families.find((f) => f.id === familyParam)?.name;

  return (
    <>
      <PageHeader
        title={service ? service.name : "New service"}
        breadcrumbs={[{ label: "Catalog", href: "/catalog" }, ...(familyName ? [{ label: familyName }] : []), { label: service ? service.name : "New service" }]}
        actions={
          admin &&
          service && (
            <form action={deleteServiceAction}>
              <input type="hidden" name="id" value={service.id} />
              <ConfirmSubmit variant="outline" className="text-red-600" message={`Delete ${service.name} and all its plans?`} pendingText="Deleting...">
                <Trash2 className="h-4 w-4" /> Delete service
              </ConfirmSubmit>
            </form>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          {admin ? (
            <ServiceForm
              values={
                service
                  ? { ...service, techSectionIds: service.techSections.map((t) => t.techSectionId) }
                  : { familyId: familyParam ?? families[0]?.id ?? "", productType: "NON_IT", itemKind: "SERVICE", options: [], active: true, sortOrder: 0, techSectionIds: [] }
              }
              families={families}
              techSections={techSections}
            />
          ) : (
            service && (
              <Card>
                <CardHeader title="Service details" />
                <CardBody className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="navy">{PRODUCT_TYPE_LABELS[service.productType]}</Badge>
                    <Badge>{ITEM_KIND_LABELS[service.itemKind]}</Badge>
                  </div>
                  {service.vendor && <p>Vendor: {service.vendor}</p>}
                  {service.description && <p className="whitespace-pre-wrap text-gray-700">{service.description}</p>}
                  {service.options.length > 0 && (
                    <div>
                      <div className="text-xs font-medium uppercase text-gray-500">Options</div>
                      <ul className="list-inside list-disc">{service.options.map((o) => <li key={o}>{o}</li>)}</ul>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-medium uppercase text-gray-500">Tech sections</div>
                    {service.techSections.map((t) => t.techSection.name).join(", ") || "None"}
                  </div>
                </CardBody>
              </Card>
            )
          )}
        </div>

        {service && (
          <Card className="xl:col-span-3">
            <CardHeader
              title="Plans and prices"
              description="All prices in USD."
              actions={
                admin && (
                  <Link href={`/catalog/plans/new?service=${service.id}`} className={buttonClass("primary", "sm")}>
                    <Plus className="h-3.5 w-3.5" /> New plan
                  </Link>
                )
              }
            />
            {service.plans.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">No plans yet.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Plan</TH>
                    <TH>Price type</TH>
                    <TH>Price</TH>
                    {admin && <TH />}
                  </tr>
                </THead>
                <TBody>
                  {service.plans.map((p) => (
                    <TR key={p.id}>
                      <TD>
                        <div className="font-medium">{p.name}</div>
                        {p.description && <div className="text-xs text-gray-500">{p.description}</div>}
                        {!p.active && <Badge className="mt-1">Inactive</Badge>}
                      </TD>
                      <TD className="text-xs">
                        {PRICE_TYPE_LABELS[p.priceType]}
                        <div className="text-gray-500">{BILLING_FREQUENCY_LABELS[p.billingFrequency]} billing</div>
                      </TD>
                      <TD className="text-xs">{planPriceSummary(p, defaults, service.itemKind)}</TD>
                      {admin && (
                        <TD className="text-right">
                          <Link href={`/catalog/plans/${p.id}`} className={buttonClass("ghost", "icon")} title="Edit plan">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
