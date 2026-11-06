"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, bool, handleActionError, optStr, str } from "@/lib/action";
import { assertPermission } from "@/lib/session";
import { optionalEmail } from "@/lib/validation";
import { distributorCarriesVendor } from "@/lib/it-catalog";

const numOrNull = (label: string, min = 0, max = 1_000_000_000) =>
  z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s === "" || Number.isFinite(Number(s)), `${label} must be a number.`)
    .transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (n >= min && n <= max), `${label} must be between ${min} and ${max}.`);

async function dupCheck(found: unknown, message: string, field = "name") {
  if (found) throw new UserError(message, { [field]: message });
}

// ---------------- Vendors ----------------

const vendorSchema = z.object({
  name: z.string().min(2, "Enter the vendor name.").max(120),
  website: z.string().max(200).nullable(),
  notes: z.string().max(5000).nullable(),
  active: z.boolean(),
});

export async function saveVendorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let savedId = id;
  try {
    const user = await assertPermission("catalog.manage");
    const data = vendorSchema.parse({ name: str(fd, "name"), website: optStr(fd, "website"), notes: optStr(fd, "notes"), active: id ? bool(fd, "active") : true });
    await dupCheck(await prisma.vendor.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } }), "A vendor with this name already exists.");
    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.vendor.findUniqueOrThrow({ where: { id } });
        const after = await tx.vendor.update({ where: { id }, data });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "Vendor", entityId: id, summary: `Updated vendor ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const v = await tx.vendor.create({ data });
        savedId = v.id;
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "Vendor", entityId: v.id, summary: `Added vendor ${v.name}`, after: v });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath("/catalog/vendors");
  redirect(`/catalog/vendors/${savedId}`);
}

const linkSchema = z.object({
  vendorId: z.string().min(1),
  distributorId: z.string().min(1, "Choose a distributor."),
  partnerLevel: z.string().max(120).nullable(),
  accountNumber: z.string().max(120).nullable(),
  notes: z.string().max(1000).nullable(),
});

/** Add or update the link between a vendor and a distributor. */
export async function saveVendorDistributorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("catalog.manage");
    const data = linkSchema.parse({
      vendorId: str(fd, "vendorId"),
      distributorId: str(fd, "distributorId"),
      partnerLevel: optStr(fd, "partnerLevel"),
      accountNumber: optStr(fd, "accountNumber"),
      notes: optStr(fd, "notes"),
    });
    const [vendor, distributor] = await Promise.all([
      prisma.vendor.findUniqueOrThrow({ where: { id: data.vendorId } }),
      prisma.distributor.findUniqueOrThrow({ where: { id: data.distributorId } }),
    ]);
    await prisma.$transaction(async (tx) => {
      const key = { vendorId_distributorId: { vendorId: data.vendorId, distributorId: data.distributorId } };
      const existing = await tx.vendorDistributor.findUnique({ where: key });
      await tx.vendorDistributor.upsert({ where: key, create: data, update: data });
      await audit(tx, {
        userId: user.id,
        action: existing ? "UPDATE" : "CREATE",
        entityType: "VendorDistributor",
        entityId: `${data.vendorId}:${data.distributorId}`,
        summary: `${existing ? "Updated" : "Linked"} ${distributor.name} as a distributor of ${vendor.name}`,
        before: existing ?? undefined,
        after: data,
      });
    });
    revalidatePath(`/catalog/vendors/${data.vendorId}`);
    revalidatePath(`/catalog/distributors/${data.distributorId}`);
    return { ok: true, message: "Saved." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function removeVendorDistributorAction(fd: FormData) {
  const user = await assertPermission("catalog.manage");
  const vendorId = str(fd, "vendorId");
  const distributorId = str(fd, "distributorId");
  const link = await prisma.vendorDistributor.findUnique({ where: { vendorId_distributorId: { vendorId, distributorId } }, include: { vendor: true, distributor: true } });
  if (!link) return;
  await prisma.$transaction(async (tx) => {
    await tx.vendorDistributor.delete({ where: { vendorId_distributorId: { vendorId, distributorId } } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "VendorDistributor", entityId: `${vendorId}:${distributorId}`, summary: `${link.distributor.name} no longer distributes ${link.vendor.name}`, before: link });
  });
  revalidatePath(`/catalog/vendors/${vendorId}`);
  revalidatePath(`/catalog/distributors/${distributorId}`);
}

// ---------------- Distributors ----------------

const distributorSchema = z.object({
  name: z.string().min(2, "Enter the distributor name.").max(160),
  country: z.string().max(80).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3 letter currency code, for example USD or AED."),
  paymentTerms: z.string().max(300).nullable(),
  remittanceNotes: z.string().max(2000).nullable(),
  website: z.string().max(200).nullable(),
  notes: z.string().max(5000).nullable(),
  active: z.boolean(),
});

export async function saveDistributorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let savedId = id;
  try {
    const user = await assertPermission("catalog.manage");
    const data = distributorSchema.parse({
      name: str(fd, "name"),
      country: optStr(fd, "country"),
      currency: str(fd, "currency").toUpperCase() || "USD",
      paymentTerms: optStr(fd, "paymentTerms"),
      remittanceNotes: optStr(fd, "remittanceNotes"),
      website: optStr(fd, "website"),
      notes: optStr(fd, "notes"),
      active: id ? bool(fd, "active") : true,
    });
    await dupCheck(await prisma.distributor.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } }), "A distributor with this name already exists.");
    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.distributor.findUniqueOrThrow({ where: { id } });
        const after = await tx.distributor.update({ where: { id }, data });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "Distributor", entityId: id, summary: `Updated distributor ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const d = await tx.distributor.create({ data });
        savedId = d.id;
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "Distributor", entityId: d.id, summary: `Added distributor ${d.name}`, after: d });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath("/catalog/distributors");
  redirect(`/catalog/distributors/${savedId}`);
}

const distContactSchema = z.object({
  distributorId: z.string().min(1),
  name: z.string().min(2, "Enter the name.").max(160),
  title: z.string().max(120).nullable(),
  phone: z.string().max(60).nullable(),
  email: optionalEmail,
});

export async function addDistributorContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("catalog.manage");
    const data = distContactSchema.parse({ distributorId: str(fd, "distributorId"), name: str(fd, "name"), title: optStr(fd, "title"), phone: optStr(fd, "phone"), email: str(fd, "email") });
    if (!data.phone && !data.email) throw new UserError("Add a phone number or an email.", { phone: "Add a phone number or an email." });
    await prisma.$transaction(async (tx) => {
      const c = await tx.distributorContact.create({ data });
      await audit(tx, { userId: user.id, action: "CREATE", entityType: "DistributorContact", entityId: c.id, summary: `Added contact ${c.name} at a distributor`, after: c });
    });
    revalidatePath(`/catalog/distributors/${data.distributorId}`);
    return { ok: true, message: "Contact added." };
  } catch (e) {
    return handleActionError(e);
  }
}

export async function deleteDistributorContactAction(fd: FormData) {
  const user = await assertPermission("catalog.manage");
  const id = str(fd, "id");
  const c = await prisma.distributorContact.findUnique({ where: { id } });
  if (!c) return;
  await prisma.$transaction(async (tx) => {
    await tx.distributorContact.delete({ where: { id } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "DistributorContact", entityId: id, summary: `Removed distributor contact ${c.name}`, before: c });
  });
  revalidatePath(`/catalog/distributors/${c.distributorId}`);
}

// ---------------- Products ----------------

const productSchema = z.object({
  vendorId: z.string().min(1, "Choose a vendor."),
  categoryId: z.string().min(1, "Choose a category."),
  name: z.string().min(2, "Enter the product name.").max(200),
  description: z.string().max(5000).nullable(),
  active: z.boolean(),
});

export async function saveProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let savedId = id;
  try {
    const user = await assertPermission("catalog.manage");
    const data = productSchema.parse({ vendorId: str(fd, "vendorId"), categoryId: str(fd, "categoryId"), name: str(fd, "name"), description: optStr(fd, "description"), active: id ? bool(fd, "active") : true });
    await dupCheck(
      await prisma.itProduct.findFirst({ where: { vendorId: data.vendorId, name: { equals: data.name, mode: "insensitive" }, deletedAt: null, ...(id ? { NOT: { id } } : {}) } }),
      "This vendor already has a product with this name.",
    );
    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.itProduct.findUniqueOrThrow({ where: { id } });
        const after = await tx.itProduct.update({ where: { id }, data });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "ItProduct", entityId: id, summary: `Updated IT product ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const p = await tx.itProduct.create({ data });
        savedId = p.id;
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "ItProduct", entityId: p.id, summary: `Added IT product ${p.name}`, after: p });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath("/catalog/it");
  redirect(`/catalog/it/products/${savedId}`);
}

export async function deleteProductAction(fd: FormData) {
  const user = await assertPermission("catalog.manage");
  const id = str(fd, "id");
  const p = await prisma.itProduct.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.itProduct.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await tx.itSubProduct.updateMany({ where: { productId: id, deletedAt: null }, data: { deletedAt: new Date(), active: false } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "ItProduct", entityId: id, summary: `Deleted IT product ${p.name} and its sub-products` });
  });
  revalidatePath("/catalog/it");
  redirect("/catalog/it");
}

// ---------------- Sub-products ----------------

const subSchema = z
  .object({
    productId: z.string().min(1),
    name: z.string().min(2, "Enter a name.").max(200),
    sku: z.string().max(80).nullable(),
    kind: z.enum(["HARDWARE", "SOFTWARE"], { message: "Choose hardware or software." }),
    quoteDescription: z.string().max(2000).nullable(),
    unitLabel: z.string().max(60).nullable(),
    termMonths: numOrNull("Term", 1, 120),
    markupPct: numOrNull("Markup", 0, 1000),
    active: z.boolean(),
  })
  .superRefine((s, ctx) => {
    if (s.termMonths !== null && !Number.isInteger(s.termMonths)) ctx.addIssue({ code: "custom", path: ["termMonths"], message: "Use a whole number of months." });
  });

export async function saveSubProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let productId = str(fd, "productId");
  try {
    const user = await assertPermission("catalog.manage");
    const data = subSchema.parse({
      productId,
      name: str(fd, "name"),
      sku: optStr(fd, "sku"),
      kind: str(fd, "kind"),
      quoteDescription: optStr(fd, "quoteDescription"),
      unitLabel: optStr(fd, "unitLabel"),
      termMonths: str(fd, "termMonths"),
      markupPct: str(fd, "markupPct"),
      active: id ? bool(fd, "active") : true,
    });
    productId = data.productId;
    if (data.kind === "HARDWARE") data.termMonths = null;
    const product = await prisma.itProduct.findUniqueOrThrow({ where: { id: productId } });
    await dupCheck(
      await prisma.itSubProduct.findFirst({ where: { productId, name: { equals: data.name, mode: "insensitive" }, deletedAt: null, ...(id ? { NOT: { id } } : {}) } }),
      "This product already has a sub-product with this name.",
    );
    if (data.sku)
      await dupCheck(
        await prisma.itSubProduct.findFirst({ where: { sku: { equals: data.sku, mode: "insensitive" }, deletedAt: null, product: { vendorId: product.vendorId }, ...(id ? { NOT: { id } } : {}) } }),
        "This part number is already used for this vendor.",
        "sku",
      );
    const fields = { ...data, markupPct: data.markupPct === null ? null : new Prisma.Decimal(data.markupPct) };
    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.itSubProduct.findUniqueOrThrow({ where: { id } });
        const after = await tx.itSubProduct.update({ where: { id }, data: fields });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "ItSubProduct", entityId: id, summary: `Updated sub-product ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const s = await tx.itSubProduct.create({ data: fields });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "ItSubProduct", entityId: s.id, summary: `Added sub-product ${s.name} to ${product.name}`, after: s });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath(`/catalog/it/products/${productId}`);
  redirect(`/catalog/it/products/${productId}`);
}

export async function deleteSubProductAction(fd: FormData) {
  const user = await assertPermission("catalog.manage");
  const id = str(fd, "id");
  const s = await prisma.itSubProduct.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.itSubProduct.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "ItSubProduct", entityId: id, summary: `Deleted sub-product ${s.name}` });
  });
  revalidatePath(`/catalog/it/products/${s.productId}`);
  redirect(`/catalog/it/products/${s.productId}`);
}

// ---------------- Costs ----------------

const costSchema = z.object({
  subProductId: z.string().min(1),
  distributorId: z.string().min(1, "Choose a distributor."),
  unitCost: numOrNull("Unit cost").refine((n) => n !== null && n > 0, "Enter the unit cost."),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3 letter currency code."),
  exchangeRate: numOrNull("Exchange rate", 0.000001, 1_000_000).refine((n) => n !== null, "Enter the exchange rate."),
  quotedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the quote date."),
  reference: z.string().max(120).nullable(),
  notes: z.string().max(1000).nullable(),
});

export async function recordCostAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("costs.record");
    const currency = str(fd, "currency").toUpperCase() || "USD";
    const data = costSchema.parse({
      subProductId: str(fd, "subProductId"),
      distributorId: str(fd, "distributorId"),
      unitCost: str(fd, "unitCost"),
      currency,
      exchangeRate: currency === "USD" ? "1" : str(fd, "exchangeRate"),
      quotedAt: str(fd, "quotedAt"),
      reference: optStr(fd, "reference"),
      notes: optStr(fd, "notes"),
    });
    const sub = await prisma.itSubProduct.findUniqueOrThrow({ where: { id: data.subProductId }, include: { product: true } });
    const links = await prisma.vendorDistributor.findMany({ where: { vendorId: sub.product.vendorId } });
    if (!distributorCarriesVendor(links, sub.product.vendorId, data.distributorId))
      throw new UserError("This distributor is not linked to this vendor. Link them on the vendor page first.", { distributorId: "Not a distributor of this vendor." });
    const quotedAt = new Date(`${data.quotedAt}T00:00:00Z`);
    if (quotedAt.getTime() > Date.now() + 86_400_000) throw new UserError("The quote date cannot be in the future.", { quotedAt: "Cannot be in the future." });
    await prisma.$transaction(async (tx) => {
      const row = await tx.distributorPrice.create({
        data: {
          ...data,
          unitCost: new Prisma.Decimal(data.unitCost!),
          exchangeRate: new Prisma.Decimal(data.exchangeRate!),
          quotedAt,
          createdById: user.id,
        },
      });
      await audit(tx, { userId: user.id, action: "CREATE", entityType: "DistributorPrice", entityId: row.id, summary: `Recorded a distributor cost for ${sub.name}`, after: row });
    });
    revalidatePath(`/catalog/it/sub-products/${data.subProductId}`);
    return { ok: true, message: "Cost recorded." };
  } catch (e) {
    return handleActionError(e);
  }
}
