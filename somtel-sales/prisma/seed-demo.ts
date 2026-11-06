/**
 * Demo data for testing every screen. Do NOT run this on the live server.
 * All demo users get the password in DEMO_PASSWORD (default: Somtel2026demo).
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type Role } from "@prisma/client";

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
  "Tracking platform": ["IT and Cloud (sample)"],
  "Tracking devices": ["Field Installation (sample)"],
};

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
];

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  const sectionIds = new Map<string, string>();
  for (const [i, t] of TECH_SECTIONS.entries()) {
    const row = await prisma.techSection.upsert({ where: { name: t.name }, update: {}, create: { ...t, sortOrder: i } });
    sectionIds.set(t.name, row.id);
  }
  for (const [serviceName, sections] of Object.entries(SERVICE_SECTIONS)) {
    const service = await prisma.service.findFirst({ where: { name: serviceName } });
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

  console.log(`Demo data is in place. Demo users sign in with password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
