import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CatalogTabs } from "../tabs";

export const metadata = { title: "Distributors" };

export default async function DistributorsPage() {
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const distributors = await prisma.distributor.findMany({
    where: { deletedAt: null, ...(admin ? {} : { active: true }) },
    orderBy: { name: "asc" },
    include: { vendors: { include: { vendor: { select: { name: true } } } } },
  });
  return (
    <>
      <PageHeader
        title="Products catalog"
        description="Distributors sell vendors' products to Somtel. They never appear on client documents."
        actions={
          admin && (
            <Link href="/catalog/distributors/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New distributor
            </Link>
          )
        }
      />
      <CatalogTabs active="distributors" />
      {distributors.length === 0 ? (
        <EmptyState title="No distributors yet" />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Distributor</TH>
                <TH>Country</TH>
                <TH>Currency</TH>
                <TH>Vendors</TH>
              </tr>
            </THead>
            <TBody>
              {distributors.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <Link href={`/catalog/distributors/${d.id}`} className="font-medium text-navy hover:underline">
                      {d.name}
                    </Link>
                    {!d.active && <Badge className="ml-2">Inactive</Badge>}
                  </TD>
                  <TD>{d.country}</TD>
                  <TD>{d.currency}</TD>
                  <TD className="text-xs">{d.vendors.map((v) => v.vendor.name).join(", ") || <span className="text-gray-400">None linked</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
