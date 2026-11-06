import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, Settings2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { can, requirePermission } from "@/lib/session";
import { latestCostPerDistributor } from "@/lib/it-catalog";
import { IT_KIND_LABELS } from "@/lib/pricing";
import { formatMoney } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CatalogTabs } from "../tabs";

export const metadata = { title: "IT products" };

type SP = { q?: string; vendor?: string; category?: string; kind?: string };

export default async function ItProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requirePermission("catalog.view");
  const admin = can(user, "catalog.manage");
  const showCosts = can(user, "costs.view");
  const q = sp.q?.trim();
  const kind = sp.kind === "HARDWARE" || sp.kind === "SOFTWARE" ? sp.kind : undefined;

  const subWhere: Prisma.ItSubProductWhereInput = { deletedAt: null, ...(admin ? {} : { active: true }), ...(kind ? { kind } : {}) };
  const where: Prisma.ItProductWhereInput = {
    deletedAt: null,
    ...(admin ? {} : { active: true }),
    vendor: { deletedAt: null, ...(admin ? {} : { active: true }) },
    ...(sp.vendor ? { vendorId: sp.vendor } : {}),
    ...(sp.category ? { categoryId: sp.category } : {}),
    ...(kind ? { subProducts: { some: subWhere } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { subProducts: { some: { deletedAt: null, OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } } },
          ],
        }
      : {}),
  };

  const [products, vendors, categories] = await Promise.all([
    prisma.itProduct.findMany({
      where,
      orderBy: [{ vendor: { name: "asc" } }, { category: { sortOrder: "asc" } }, { name: "asc" }],
      include: {
        vendor: true,
        category: true,
        subProducts: {
          where: subWhere,
          orderBy: [{ kind: "asc" }, { name: "asc" }],
          include: showCosts ? { costs: { include: { distributor: { select: { name: true } } } } } : undefined,
        },
      },
    }),
    prisma.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.itCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  const byVendor = new Map<string, typeof products>();
  for (const p of products) byVendor.set(p.vendor.name, [...(byVendor.get(p.vendor.name) ?? []), p]);

  return (
    <>
      <PageHeader
        title="Products catalog"
        description="IT products: vendor, then category, then product, then hardware or software sub-products. Prices come from distributor costs plus markup."
        actions={
          admin && (
            <>
              <Link href="/settings/lists/it-categories" className={buttonClass("outline")}>
                <Settings2 className="h-4 w-4" /> IT categories
              </Link>
              <Link href="/catalog/it/products/new" className={buttonClass("primary")}>
                <Plus className="h-4 w-4" /> New product
              </Link>
            </>
          )
        }
      />
      <CatalogTabs active="it" />

      <Card className="mb-4 p-3">
        <form className="flex flex-wrap items-center gap-2">
          <Input name="q" defaultValue={q} placeholder="Search product, sub-product or part number" className="w-72" />
          <Select name="vendor" defaultValue={sp.vendor ?? ""} className="w-44">
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          <Select name="category" defaultValue={sp.category ?? ""} className="w-48">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select name="kind" defaultValue={kind ?? ""} className="w-52">
            <option value="">Hardware and software</option>
            <option value="HARDWARE">Hardware</option>
            <option value="SOFTWARE">Software</option>
          </Select>
          <button className={buttonClass("navy")}>Filter</button>
          {(q || sp.vendor || sp.category || kind) && (
            <Link href="/catalog/it" className={buttonClass("ghost")}>
              Clear
            </Link>
          )}
        </form>
      </Card>

      {products.length === 0 ? (
        <EmptyState title="No IT products found">{admin && "Add vendors first, then click New product."}</EmptyState>
      ) : (
        <div className="space-y-5">
          {[...byVendor.entries()].map(([vendorName, list]) => (
            <Card key={vendorName}>
              <CardHeader title={<Link href={`/catalog/vendors/${list[0]!.vendorId}`} className="hover:underline">{vendorName}</Link>} description={`${list.length} ${list.length === 1 ? "product" : "products"}`} />
              <Table>
                <THead>
                  <tr>
                    <TH className="w-1/4">Product</TH>
                    <TH>Category</TH>
                    <TH>Sub-products</TH>
                    {showCosts && <TH className="text-right">Best last cost (USD)</TH>}
                  </tr>
                </THead>
                <TBody>
                  {list.map((p) => (
                    <TR key={p.id}>
                      <TD>
                        <Link href={`/catalog/it/products/${p.id}`} className="font-medium text-navy hover:underline">
                          {p.name}
                        </Link>
                        {!p.active && <Badge className="ml-2">Inactive</Badge>}
                      </TD>
                      <TD className="text-xs">{p.category.name}</TD>
                      <TD>
                        <ul className="space-y-1 text-xs">
                          {p.subProducts.map((s) => (
                            <li key={s.id} className="flex flex-wrap items-center gap-2">
                              <Badge tone={s.kind === "HARDWARE" ? "blue" : "gold"}>{IT_KIND_LABELS[s.kind]}</Badge>
                              <Link href={`/catalog/it/sub-products/${s.id}`} className="text-gray-800 hover:text-navy hover:underline">
                                {s.name}
                              </Link>
                              {s.sku && <span className="font-mono text-gray-500">{s.sku}</span>}
                              {s.termMonths && <span className="text-gray-500">{s.termMonths} months</span>}
                            </li>
                          ))}
                          {p.subProducts.length === 0 && <li className="text-gray-400">None yet</li>}
                        </ul>
                      </TD>
                      {showCosts && (
                        <TD className="text-right text-xs">
                          <ul className="space-y-1">
                            {p.subProducts.map((s) => {
                              const costs = "costs" in s ? latestCostPerDistributor((s.costs as CostWithDist[]).map(toRow)) : [];
                              const best = costs[0];
                              return <li key={s.id}>{best ? <span title={best.distributorName}>{formatMoney(best.usd)}</span> : <span className="text-gray-400">No cost yet</span>}</li>;
                            })}
                          </ul>
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

type CostWithDist = { id: string; distributorId: string; unitCost: unknown; exchangeRate: unknown; quotedAt: Date; createdAt: Date; distributor: { name: string } };
const toRow = (c: CostWithDist) => ({
  id: c.id,
  distributorId: c.distributorId,
  distributorName: c.distributor.name,
  unitCost: Number(String(c.unitCost)),
  exchangeRate: Number(String(c.exchangeRate)),
  quotedAt: c.quotedAt,
  createdAt: c.createdAt,
});
