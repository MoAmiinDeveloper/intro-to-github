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

export const metadata = { title: "Vendors" };

export default async function VendorsPage() {
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const vendors = await prisma.vendor.findMany({
    where: { deletedAt: null, ...(admin ? {} : { active: true }) },
    orderBy: { name: "asc" },
    include: {
      distributors: { include: { distributor: { select: { name: true } } } },
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
  });
  return (
    <>
      <PageHeader
        title="Products catalog"
        description="Vendors make the IT products. Each vendor can be bought from one or more distributors."
        actions={
          admin && (
            <Link href="/catalog/vendors/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> New vendor
            </Link>
          )
        }
      />
      <CatalogTabs active="vendors" />
      {vendors.length === 0 ? (
        <EmptyState title="No vendors yet" />
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>Vendor</TH>
                <TH className="text-right">Products</TH>
                <TH>Distributors</TH>
              </tr>
            </THead>
            <TBody>
              {vendors.map((v) => (
                <TR key={v.id}>
                  <TD>
                    <Link href={`/catalog/vendors/${v.id}`} className="font-medium text-navy hover:underline">
                      {v.name}
                    </Link>
                    {!v.active && <Badge className="ml-2">Inactive</Badge>}
                  </TD>
                  <TD className="text-right">
                    <Link href={`/catalog/it?vendor=${v.id}`} className="hover:underline">
                      {v._count.products}
                    </Link>
                  </TD>
                  <TD className="text-xs">{v.distributors.map((d) => d.distributor.name).join(", ") || <span className="text-gray-400">None linked</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
