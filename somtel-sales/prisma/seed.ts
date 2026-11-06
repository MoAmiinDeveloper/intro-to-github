import { Prisma, PrismaClient } from "@prisma/client";
import { CLAUSES, IT_CATEGORIES, LOST_REASONS, PIPELINE_STAGES, SECTORS, SERVICE_CATEGORIES, SERVICES, TERMS_TEMPLATES, VENDORS } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  for (const [i, name] of SECTORS.entries()) {
    await prisma.sector.upsert({ where: { name }, update: {}, create: { name, sortOrder: i } });
  }
  for (const [i, s] of PIPELINE_STAGES.entries()) {
    await prisma.pipelineStage.upsert({ where: { name: s.name }, update: {}, create: { ...s, sortOrder: (i + 1) * 10 } });
  }
  for (const [i, name] of LOST_REASONS.entries()) {
    await prisma.lostReason.upsert({ where: { name }, update: {}, create: { name, sortOrder: i } });
  }
  await prisma.companyProfile.upsert({
    where: { id: "company" },
    update: {},
    create: { id: "company", name: "Somtel Enterprise", legalName: "Somtel", city: "Hargeisa", footerText: "Somtel Enterprise, part of the Dahabshiil Group" },
  });

  const categoryIds = new Map<string, string>();
  for (const [i, c] of SERVICE_CATEGORIES.entries()) {
    const row = await prisma.serviceCategory.upsert({ where: { name: c.name }, update: {}, create: { ...c, sortOrder: (i + 1) * 10 } });
    categoryIds.set(c.name, row.id);
  }

  for (const [i, s] of SERVICES.entries()) {
    const categoryId = categoryIds.get(s.category)!;
    const { plans, category, ...fields } = s;
    void category;
    const service = await prisma.service.upsert({
      where: { categoryId_name: { categoryId, name: s.name } },
      update: {},
      create: { ...fields, options: fields.options ?? [], categoryId, sortOrder: (i + 1) * 10 },
    });
    for (const [j, p] of plans.entries()) {
      const exists = await prisma.plan.findUnique({ where: { serviceId_name: { serviceId: service.id, name: p.name } } });
      if (exists) continue;
      const { tiers, unitPrice, ...planFields } = p;
      await prisma.plan.create({
        data: {
          ...planFields,
          serviceId: service.id,
          sortOrder: (j + 1) * 10,
          unitPrice: unitPrice === undefined ? null : new Prisma.Decimal(unitPrice),
          tiers: tiers ? { create: tiers.map((t) => ({ ...t, unitPrice: new Prisma.Decimal(t.unitPrice) })) } : undefined,
        },
      });
    }
  }

  for (const [i, name] of IT_CATEGORIES.entries()) {
    await prisma.itCategory.upsert({ where: { name }, update: {}, create: { name, sortOrder: (i + 1) * 10 } });
  }
  for (const v of VENDORS) {
    await prisma.vendor.upsert({ where: { name: v.name }, update: {}, create: v });
  }

  for (const t of TERMS_TEMPLATES) {
    const exists = await prisma.termsTemplate.findUnique({ where: { name: t.name } });
    if (!exists) await prisma.termsTemplate.create({ data: t });
  }
  for (const [i, c] of CLAUSES.entries()) {
    const exists = await prisma.termsClause.findFirst({ where: { text: c.text } });
    if (!exists) await prisma.termsClause.create({ data: { ...c, sortOrder: i } });
  }

  console.log("Reference data is in place.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
