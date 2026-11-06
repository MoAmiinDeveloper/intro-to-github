import { Prisma, PrismaClient } from "@prisma/client";
import { CLAUSES, FAMILIES, LOST_REASONS, PIPELINE_STAGES, SECTORS, SERVICES, TERMS_TEMPLATES } from "./seed-data";

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

  const familyIds = new Map<string, string>();
  for (const [i, f] of FAMILIES.entries()) {
    const row = await prisma.productFamily.upsert({ where: { name: f.name }, update: {}, create: { ...f, sortOrder: (i + 1) * 10 } });
    familyIds.set(f.name, row.id);
  }

  for (const [i, s] of SERVICES.entries()) {
    const familyId = familyIds.get(s.family)!;
    const { plans, family, ...fields } = s;
    void family;
    const service = await prisma.service.upsert({
      where: { familyId_name: { familyId, name: s.name } },
      update: {},
      create: { ...fields, options: fields.options ?? [], familyId, sortOrder: (i + 1) * 10 },
    });
    for (const [j, p] of plans.entries()) {
      const exists = await prisma.plan.findUnique({ where: { serviceId_name: { serviceId: service.id, name: p.name } } });
      if (exists) continue;
      const { tiers, unitPrice, marginPct, ...planFields } = p;
      await prisma.plan.create({
        data: {
          ...planFields,
          serviceId: service.id,
          sortOrder: (j + 1) * 10,
          unitPrice: unitPrice === undefined ? null : new Prisma.Decimal(unitPrice),
          marginPct: marginPct === undefined ? null : new Prisma.Decimal(marginPct),
          tiers: tiers ? { create: tiers.map((t) => ({ ...t, unitPrice: new Prisma.Decimal(t.unitPrice) })) } : undefined,
        },
      });
    }
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
