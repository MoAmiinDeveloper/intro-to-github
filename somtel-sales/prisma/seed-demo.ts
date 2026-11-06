/**
 * Demo data for testing every screen. Do NOT run this on the live server.
 * All demo users get the password in DEMO_PASSWORD (default: Somtel2026demo).
 */
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, type ItKind, type Role } from "@prisma/client";

const prisma = new PrismaClient();
const PASSWORD = process.env.DEMO_PASSWORD || "Somtel2026demo";

const TECH_SECTIONS = [
  { name: "Core Network (sample)", email: "core.network@example.com" },
  { name: "VAS Platforms (sample)", email: "vas@example.com" },
  { name: "IT and Cloud (sample)", email: "it.cloud@example.com" },
  { name: "Field Installation (sample)", email: "field@example.com" },
];

const SERVICE_SECTIONS: Record<string, string[]> = {
  "A2P SMS": ["VAS Platforms (sample)"],
  "Hosted IVR / Short Code": ["VAS Platforms (sample)", "Core Network (sample)"],
  "Tracking platform": ["IT and Cloud (sample)", "Field Installation (sample)"],
};

/** Groups and the entities in them. Entities not listed here stay standalone. */
const GROUPS: { name: string; sector: string; owner: string; entities: string[] }[] = [
  { name: "Sahan Group", sector: "Logistics", owner: "am1", entities: ["Sahan Logistics Ltd", "Sahan Trading"] },
  { name: "Barwaaqo Holdings", sector: "Financial Institutions", owner: "am2", entities: ["Barwaaqo Microfinance", "Barwaaqo Insurance Services"] },
];

const DISTRIBUTORS = [
  { name: "Gulf IT Distribution (sample)", country: "United Arab Emirates", currency: "AED", paymentTerms: "100% advance", vendors: ["Fortinet", "Sophos", "Ubiquiti"] },
  { name: "East Africa Tech Supply (sample)", country: "Kenya", currency: "USD", paymentTerms: "50% advance, 50% on delivery", vendors: ["Fortinet", "Microsoft"] },
  { name: "Fleet Devices Trading (sample)", country: "United Arab Emirates", currency: "USD", paymentTerms: "100% advance", vendors: ["Tracker vendor (sample)"] },
];

/** Example IT products. Part numbers are left empty on purpose; fill in the real ones. */
const IT_PRODUCTS: { vendor: string; category: string; name: string; subs: { name: string; kind: ItKind; unit?: string; term?: number; costs?: [string, number, string][] }[] }[] = [
  {
    vendor: "Fortinet",
    category: "Firewall and security",
    name: "FortiGate 60F",
    subs: [
      { name: "FortiGate 60F appliance", kind: "HARDWARE", unit: "device", costs: [["Gulf IT Distribution (sample)", 2200, "AED"], ["East Africa Tech Supply (sample)", 640, "USD"]] },
      { name: "FortiGuard UTP bundle, 1 year", kind: "SOFTWARE", unit: "licence", term: 12, costs: [["Gulf IT Distribution (sample)", 1650, "AED"]] },
    ],
  },
  {
    vendor: "Sophos",
    category: "Endpoint security",
    name: "Sophos Intercept X",
    subs: [{ name: "Intercept X Advanced, 1 year", kind: "SOFTWARE", unit: "user", term: 12 }],
  },
  {
    vendor: "Microsoft",
    category: "Productivity and collaboration",
    name: "Microsoft 365 Business Standard",
    subs: [{ name: "Business Standard licence, 1 year", kind: "SOFTWARE", unit: "user", term: 12, costs: [["East Africa Tech Supply (sample)", 150, "USD"]] }],
  },
  {
    vendor: "Ubiquiti",
    category: "Wireless",
    name: "UniFi U6 Pro",
    subs: [{ name: "U6 Pro access point", kind: "HARDWARE", unit: "device", costs: [["Gulf IT Distribution (sample)", 590, "AED"]] }],
  },
  {
    vendor: "Tracker vendor (sample)",
    category: "Vehicle tracking hardware",
    name: "Vehicle tracking devices",
    subs: [
      { name: "GPS tracker", kind: "HARDWARE", unit: "device" },
      { name: "Speed limiter", kind: "HARDWARE", unit: "device" },
      { name: "Dashcam", kind: "HARDWARE", unit: "device" },
    ],
  },
];

interface DemoUser {
  key: string;
  name: string;
  email: string;
  title: string;
  roles: Role[];
  manager?: string;
  sectors?: string[];
  techSections?: string[];
}

const USERS: DemoUser[] = [
  { key: "admin", name: "System Admin", email: "admin@example.com", title: "System administrator", roles: ["ADMIN"] },
  { key: "head", name: "Rashid Hassan", email: "rashid.hassan@example.com", title: "Head of Enterprise", roles: ["HEAD_OF_ENTERPRISE"] },
  { key: "manager", name: "Mohamed Ahmed Dahir", email: "mohamed.dahir@example.com", title: "Enterprise Sales Manager", roles: ["MANAGER"], manager: "head" },
  { key: "am1", name: "Amina Yusuf", email: "amina.yusuf@example.com", title: "Sector Manager", roles: ["ACCOUNT_MANAGER"], manager: "manager", sectors: ["Private & INGOs", "Logistics"] },
  { key: "am2", name: "Abdirahman Ali", email: "abdirahman.ali@example.com", title: "Sector Manager", roles: ["ACCOUNT_MANAGER"], manager: "manager", sectors: ["Financial Institutions"] },
  { key: "am3", name: "Hodan Farah", email: "hodan.farah@example.com", title: "Sector Manager", roles: ["ACCOUNT_MANAGER"], manager: "manager", sectors: ["Public Sector", "Government"] },
  { key: "support", name: "Khadar Ismail", email: "khadar.ismail@example.com", title: "Enterprise Support", roles: ["ENTERPRISE_SUPPORT"] },
  { key: "proc", name: "Sahra Jama", email: "sahra.jama@example.com", title: "Procurement Officer", roles: ["PROCUREMENT"] },
  { key: "finance", name: "Ibrahim Warsame", email: "ibrahim.warsame@example.com", title: "Finance Officer", roles: ["FINANCE"] },
  { key: "billing", name: "Fadumo Osman", email: "fadumo.osman@example.com", title: "Billing Officer", roles: ["BILLING"] },
  { key: "tech1", name: "Yasin Abdi", email: "yasin.abdi@example.com", title: "VAS Engineer", roles: ["TECH"], techSections: ["VAS Platforms (sample)"] },
  { key: "tech2", name: "Nimco Hussein", email: "nimco.hussein@example.com", title: "Network Engineer", roles: ["TECH"], techSections: ["Core Network (sample)"] },
];

const CLIENTS: { name: string; sector: string; industry: string; owner: string; status: "PROSPECT" | "ACTIVE" | "INACTIVE"; contacts: [string, string, string, boolean][]; upsell?: string }[] = [
  { name: "Sahan Logistics Ltd", sector: "Logistics", industry: "Freight and trucking", owner: "am1", status: "ACTIVE", contacts: [["Mustafe Aden", "Operations Director", "+252 63 410 0001", true], ["Ayaan Nur", "IT Officer", "+252 63 410 0002", false]], upsell: "Fleet of 60 trucks. Good fit for vehicle tracking with speed limiters." },
  { name: "Geed Trading Company", sector: "Private & INGOs", industry: "Import and retail", owner: "am1", status: "PROSPECT", contacts: [["Liban Said", "General Manager", "+252 63 410 0003", true]] },
  { name: "Horn Relief Alliance", sector: "Private & INGOs", industry: "INGO", owner: "am1", status: "ACTIVE", contacts: [["Deka Mohamed", "Country Director", "+252 63 410 0004", true], ["Omar Elmi", "ICT Lead", "+252 63 410 0005", false]], upsell: "Uses A2P SMS for field alerts. Ask about Microsoft 365 renewal." },
  { name: "Barwaaqo Microfinance", sector: "Financial Institutions", industry: "Microfinance", owner: "am2", status: "ACTIVE", contacts: [["Hassan Guled", "CEO", "+252 63 410 0006", true], ["Ifrah Ahmed", "Head of IT", "+252 63 410 0007", false]] },
  { name: "Dalmar Savings Bank", sector: "Financial Institutions", industry: "Banking", owner: "am2", status: "PROSPECT", contacts: [["Abdi Kariye", "IT Manager", "+252 63 410 0008", true]] },
  { name: "Sheeko Insurance", sector: "Financial Institutions", industry: "Insurance", owner: "am2", status: "INACTIVE", contacts: [["Samira Haji", "Operations", "+252 63 410 0009", false]] },
  { name: "Ministry of Sample Affairs", sector: "Government", industry: "Ministry", owner: "am3", status: "PROSPECT", contacts: [["Ahmed Dirie", "Director General", "+252 63 410 0010", true]] },
  { name: "Regional Health Office (sample)", sector: "Public Sector", industry: "Health", owner: "am3", status: "ACTIVE", contacts: [["Halima Abdillahi", "Admin Officer", "+252 63 410 0011", true], ["Jama Hirsi", "ICT Officer", "+252 63 410 0012", false]] },
  { name: "Burao Water Utility (sample)", sector: "Public Sector", industry: "Utilities", owner: "am3", status: "PROSPECT", contacts: [["Khadra Yasin", "Finance Manager", "+252 63 410 0013", true]] },
  { name: "Raad Transport Co", sector: "Logistics", industry: "Passenger transport", owner: "am1", status: "PROSPECT", contacts: [["Guuleed Awale", "Fleet Manager", "+252 63 410 0014", true]] },
  { name: "Sahan Trading", sector: "Logistics", industry: "Import and wholesale", owner: "am1", status: "ACTIVE", contacts: [["Sagal Ismail", "Finance Manager", "+252 63 410 0015", false]] },
  { name: "Barwaaqo Insurance Services", sector: "Financial Institutions", industry: "Insurance", owner: "am2", status: "PROSPECT", contacts: [["Mahad Yusuf", "General Manager", "+252 63 410 0016", true]] },
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  const sectionIds = new Map<string, string>();
  for (const [i, t] of TECH_SECTIONS.entries()) {
    const row = await prisma.techSection.upsert({ where: { name: t.name }, update: {}, create: { ...t, sortOrder: i } });
    sectionIds.set(t.name, row.id);
  }
  for (const [serviceName, sections] of Object.entries(SERVICE_SECTIONS)) {
    const service = await prisma.service.findFirst({ where: { name: serviceName, deletedAt: null } });
    if (!service) continue;
    for (const s of sections) {
      await prisma.serviceTechSection.upsert({
        where: { serviceId_techSectionId: { serviceId: service.id, techSectionId: sectionIds.get(s)! } },
        update: {},
        create: { serviceId: service.id, techSectionId: sectionIds.get(s)! },
      });
    }
  }

  const sectors = new Map((await prisma.sector.findMany()).map((s) => [s.name, s.id]));
  const userIds = new Map<string, string>();
  for (const u of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    const row =
      existing ??
      (await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          title: u.title,
          passwordHash: hash,
          roles: { create: u.roles.map((role) => ({ role })) },
          sectors: { create: (u.sectors ?? []).map((s) => ({ sectorId: sectors.get(s)! })) },
          techSections: { create: (u.techSections ?? []).map((t) => ({ techSectionId: sectionIds.get(t)! })) },
        },
      }));
    userIds.set(u.key, row.id);
  }
  for (const u of USERS) {
    if (u.manager) await prisma.user.update({ where: { id: userIds.get(u.key)! }, data: { managerId: userIds.get(u.manager)! } });
  }

  for (const c of CLIENTS) {
    const exists = await prisma.client.findFirst({ where: { name: c.name } });
    if (exists) continue;
    const ownerId = userIds.get(c.owner)!;
    const client = await prisma.client.create({
      data: {
        name: c.name,
        sectorId: sectors.get(c.sector),
        industry: c.industry,
        city: "Hargeisa",
        status: c.status,
        ownerId,
        createdById: ownerId,
        upsellNotes: c.upsell,
        contacts: {
          create: c.contacts.map(([name, title, phone, isDecisionMaker]) => ({
            name,
            title,
            phone,
            email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
            isDecisionMaker,
            createdById: ownerId,
          })),
        },
      },
    });
    await prisma.auditLog.create({ data: { userId: ownerId, action: "CREATE", entityType: "Client", entityId: client.id, summary: `Created client ${client.name}` } });
  }

  // ---- Groups ----
  for (const g of GROUPS) {
    const group =
      (await prisma.clientGroup.findFirst({ where: { name: g.name, deletedAt: null } })) ??
      (await prisma.clientGroup.create({ data: { name: g.name, sectorId: sectors.get(g.sector), ownerId: userIds.get(g.owner)! } }));
    await prisma.client.updateMany({ where: { name: { in: g.entities }, groupId: null }, data: { groupId: group.id } });
  }
  // The Sahan Logistics operations director also works with Sahan Trading.
  const director = await prisma.contact.findFirst({ where: { name: "Mustafe Aden" } });
  const trading = await prisma.client.findFirst({ where: { name: "Sahan Trading" } });
  if (director && trading)
    await prisma.contactEntityLink.upsert({
      where: { contactId_clientId: { contactId: director.id, clientId: trading.id } },
      update: {},
      create: { contactId: director.id, clientId: trading.id },
    });

  // ---- IT catalog: distributors, vendor links, example products and costs ----
  await prisma.vendor.upsert({ where: { name: "Tracker vendor (sample)" }, update: {}, create: { name: "Tracker vendor (sample)", notes: "Replace with the real tracker brand." } });
  const vendorIds = new Map((await prisma.vendor.findMany()).map((v) => [v.name, v.id]));
  const distIds = new Map<string, string>();
  for (const d of DISTRIBUTORS) {
    const { vendors, ...fields } = d;
    const row = await prisma.distributor.upsert({ where: { name: d.name }, update: {}, create: fields });
    distIds.set(d.name, row.id);
    for (const v of vendors) {
      const vendorId = vendorIds.get(v)!;
      await prisma.vendorDistributor.upsert({ where: { vendorId_distributorId: { vendorId, distributorId: row.id } }, update: {}, create: { vendorId, distributorId: row.id } });
    }
  }
  const catIds = new Map((await prisma.itCategory.findMany()).map((c) => [c.name, c.id]));
  const adminId = userIds.get("admin")!;
  for (const p of IT_PRODUCTS) {
    const vendorId = vendorIds.get(p.vendor)!;
    const product =
      (await prisma.itProduct.findFirst({ where: { vendorId, name: p.name } })) ??
      (await prisma.itProduct.create({ data: { vendorId, categoryId: catIds.get(p.category)!, name: p.name } }));
    for (const sp of p.subs) {
      if (await prisma.itSubProduct.findFirst({ where: { productId: product.id, name: sp.name } })) continue;
      const sub = await prisma.itSubProduct.create({
        data: { productId: product.id, name: sp.name, kind: sp.kind, unitLabel: sp.unit, termMonths: sp.term ?? null, quoteDescription: `${p.vendor} ${sp.name}` },
      });
      for (const [dist, cost, currency] of sp.costs ?? []) {
        await prisma.distributorPrice.create({
          data: {
            distributorId: distIds.get(dist)!,
            subProductId: sub.id,
            unitCost: new Prisma.Decimal(cost),
            currency,
            exchangeRate: new Prisma.Decimal(currency === "AED" ? 3.6725 : 1),
            quotedAt: new Date(Date.now() - 7 * 86_400_000),
            reference: "SAMPLE-PI",
            createdById: adminId,
          },
        });
      }
    }
  }

  console.log(`Demo data is in place. Demo users sign in with password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
