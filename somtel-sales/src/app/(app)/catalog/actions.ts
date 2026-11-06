"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, bool, handleActionError, list, optStr, str } from "@/lib/action";
import { assertPermission } from "@/lib/session";
import { validateTiers, type Tier } from "@/lib/pricing";

const num = (label: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s === "" || Number.isFinite(Number(s)), `${label} must be a number.`)
    .transform((s) => (s === "" ? null : Number(s)));

// ---------------- Categories ----------------

const categorySchema = z.object({
  name: z.string().min(2, "Enter a name.").max(120),
  description: z.string().max(1000).nullable(),
  enabled: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export async function saveCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  try {
    const user = await assertPermission("catalog.manage");
    const data = categorySchema.parse({
      name: str(fd, "name"),
      description: optStr(fd, "description"),
      enabled: bool(fd, "enabled"),
      sortOrder: str(fd, "sortOrder") || "0",
    });
    const dup = await prisma.serviceCategory.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, NOT: id ? { id } : undefined } });
    if (dup) throw new UserError("A category with this name already exists.", { name: "Already exists." });
    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.serviceCategory.findUniqueOrThrow({ where: { id } });
        const after = await tx.serviceCategory.update({ where: { id }, data });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "ServiceCategory", entityId: id, summary: `Updated category ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const f = await tx.serviceCategory.create({ data });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "ServiceCategory", entityId: f.id, summary: `Created category ${f.name}`, after: f });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath("/catalog");
  redirect("/catalog");
}

export async function toggleCategoryAction(fd: FormData) {
  const user = await assertPermission("catalog.manage");
  const id = str(fd, "id");
  const f = await prisma.serviceCategory.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.serviceCategory.update({ where: { id }, data: { enabled: !f.enabled } });
    await audit(tx, { userId: user.id, action: "UPDATE", entityType: "ServiceCategory", entityId: id, summary: `${f.enabled ? "Switched off" : "Switched on"} category ${f.name}`, before: { enabled: f.enabled }, after: { enabled: !f.enabled } });
  });
  revalidatePath("/catalog");
}

// ---------------- Services ----------------

const serviceSchema = z.object({
  categoryId: z.string().min(1, "Choose a category."),
  name: z.string().min(2, "Enter a name.").max(160),
  description: z.string().max(2000).nullable(),
  productType: z.enum(["NON_IT", "TRACKING"]),
  options: z.array(z.string().max(200)).max(20),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  techSectionIds: z.array(z.string()),
});

export async function saveServiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let savedId = id;
  try {
    const user = await assertPermission("catalog.manage");
    const data = serviceSchema.parse({
      categoryId: str(fd, "categoryId"),
      name: str(fd, "name"),
      description: optStr(fd, "description"),
      productType: str(fd, "productType"),
      options: str(fd, "options")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      active: bool(fd, "active"),
      sortOrder: str(fd, "sortOrder") || "0",
      techSectionIds: list(fd, "techSectionIds"),
    });
    const { techSectionIds, ...fields } = data;
    const dup = await prisma.service.findFirst({
      where: { categoryId: fields.categoryId, name: { equals: fields.name, mode: "insensitive" }, deletedAt: null, NOT: id ? { id } : undefined },
    });
    if (dup) throw new UserError("This category already has a service with this name.", { name: "Already exists in this category." });

    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.service.findUniqueOrThrow({ where: { id }, include: { techSections: true } });
        const after = await tx.service.update({ where: { id }, data: fields });
        await tx.serviceTechSection.deleteMany({ where: { serviceId: id } });
        await tx.serviceTechSection.createMany({ data: techSectionIds.map((t) => ({ serviceId: id, techSectionId: t })) });
        const diff = changedFields(
          { ...before, techSectionIds: before.techSections.map((t) => t.techSectionId).sort() },
          { ...after, techSectionIds: [...techSectionIds].sort() },
        );
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "Service", entityId: id, summary: `Updated service ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const s = await tx.service.create({ data: { ...fields, techSections: { create: techSectionIds.map((t) => ({ techSectionId: t })) } } });
        savedId = s.id;
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "Service", entityId: s.id, summary: `Created service ${s.name}`, after: { ...s, techSectionIds } });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath("/catalog");
  redirect(`/catalog/services/${savedId}`);
}

export async function deleteServiceAction(fd: FormData) {
  const user = await assertPermission("catalog.manage");
  const id = str(fd, "id");
  const s = await prisma.service.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await tx.plan.updateMany({ where: { serviceId: id, deletedAt: null }, data: { deletedAt: new Date(), active: false } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "Service", entityId: id, summary: `Deleted service ${s.name} and its plans` });
  });
  revalidatePath("/catalog");
  redirect("/catalog");
}

// ---------------- Plans ----------------

const PRICE_TYPES = ["ONE_TIME", "MONTHLY", "PER_UNIT", "PER_MINUTE", "PER_SMS_TIERED"] as const;

const planSchema = z
  .object({
    serviceId: z.string().min(1),
    name: z.string().min(2, "Enter a name.").max(160),
    description: z.string().max(2000).nullable(),
    priceType: z.enum(PRICE_TYPES),
    billingFrequency: z.enum(["ONE_TIME", "MONTHLY"]),
    unitPrice: num("Price"),
    unitLabel: z.string().max(60).nullable(),
    includedUnits: num("Included units"),
    includedLabel: z.string().max(60).nullable(),
    active: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(9999),
  })
  .superRefine((p, ctx) => {
    const needsPrice = p.priceType !== "PER_SMS_TIERED";
    if (needsPrice && (p.unitPrice === null || p.unitPrice < 0)) ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "Enter a price of 0 or more." });
    if (p.includedUnits !== null && (!Number.isInteger(p.includedUnits) || p.includedUnits < 0))
      ctx.addIssue({ code: "custom", path: ["includedUnits"], message: "Use a whole number." });
  });

function readTiers(fd: FormData): Tier[] {
  try {
    const raw = JSON.parse(str(fd, "tiers") || "[]") as { fromQty: string; toQty: string; unitPrice: string }[];
    return raw.map((t) => ({
      fromQty: Number(t.fromQty),
      toQty: t.toQty === "" || t.toQty === null || t.toQty === undefined ? null : Number(t.toQty),
      unitPrice: Number(t.unitPrice),
    }));
  } catch {
    throw new UserError("The price bands could not be read.");
  }
}

export async function savePlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let serviceId = str(fd, "serviceId");
  try {
    const user = await assertPermission("catalog.manage");
    const data = planSchema.parse({
      serviceId,
      name: str(fd, "name"),
      description: optStr(fd, "description"),
      priceType: str(fd, "priceType"),
      billingFrequency: str(fd, "billingFrequency") || "ONE_TIME",
      unitPrice: str(fd, "unitPrice"),
      unitLabel: optStr(fd, "unitLabel"),
      includedUnits: str(fd, "includedUnits"),
      includedLabel: optStr(fd, "includedLabel"),
      active: bool(fd, "active"),
      sortOrder: str(fd, "sortOrder") || "0",
    });
    serviceId = data.serviceId;
    // Keep the data consistent with the price type.
    if (data.priceType === "MONTHLY") data.billingFrequency = "MONTHLY";
    if (data.priceType === "ONE_TIME") data.billingFrequency = "ONE_TIME";
    if (data.priceType === "PER_SMS_TIERED") data.unitPrice = null;

    const tiers = data.priceType === "PER_SMS_TIERED" ? readTiers(fd) : [];
    if (data.priceType === "PER_SMS_TIERED") {
      const errors = validateTiers(tiers);
      if (errors.length) throw new UserError(errors.join(" "), { tiers: errors.join(" ") });
    }
    const dup = await prisma.plan.findFirst({
      where: { serviceId, name: { equals: data.name, mode: "insensitive" }, deletedAt: null, NOT: id ? { id } : undefined },
    });
    if (dup) throw new UserError("This service already has a plan with this name.", { name: "Already exists for this service." });

    const fields = {
      ...data,
      unitPrice: data.unitPrice === null ? null : new Prisma.Decimal(data.unitPrice),
      marginPct: null,
      includedUnits: data.includedUnits,
    };
    const tierRows = tiers.map((t) => ({ fromQty: t.fromQty, toQty: t.toQty, unitPrice: new Prisma.Decimal(t.unitPrice) }));
    const tierSnap = (rows: { fromQty: number; toQty: number | null; unitPrice: unknown }[]) =>
      rows.map((t) => ({ fromQty: t.fromQty, toQty: t.toQty, unitPrice: Number(String(t.unitPrice)) })).sort((a, b) => a.fromQty - b.fromQty);

    await prisma.$transaction(async (tx) => {
      if (id) {
        const before = await tx.plan.findUniqueOrThrow({ where: { id }, include: { tiers: true } });
        const after = await tx.plan.update({ where: { id }, data: fields });
        await tx.priceTier.deleteMany({ where: { planId: id } });
        if (tierRows.length) await tx.priceTier.createMany({ data: tierRows.map((t) => ({ ...t, planId: id })) });
        const diff = changedFields(
          { ...before, tiers: tierSnap(before.tiers) },
          { ...after, tiers: tierSnap(tierRows) },
        );
        if (diff.changed)
          await audit(tx, { userId: user.id, action: "UPDATE", entityType: "Plan", entityId: id, summary: `Updated plan ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const p = await tx.plan.create({ data: { ...fields, tiers: { create: tierRows } } });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "Plan", entityId: p.id, summary: `Created plan ${p.name}`, after: { ...p, tiers: tierSnap(tierRows) } });
      }
    });
  } catch (e) {
    return handleActionError(e);
  }
  revalidatePath(`/catalog/services/${serviceId}`);
  redirect(`/catalog/services/${serviceId}`);
}

export async function deletePlanAction(fd: FormData) {
  const user = await assertPermission("catalog.manage");
  const id = str(fd, "id");
  const p = await prisma.plan.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.plan.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await audit(tx, { userId: user.id, action: "DELETE", entityType: "Plan", entityId: id, summary: `Deleted plan ${p.name}` });
  });
  revalidatePath(`/catalog/services/${p.serviceId}`);
  redirect(`/catalog/services/${p.serviceId}`);
}
