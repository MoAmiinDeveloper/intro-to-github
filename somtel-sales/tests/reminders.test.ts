/**
 * Database test for the worker reminders. Runs only when TEST_DATABASE_URL points at a test database
 * that already has the migrations and seed data (it is skipped otherwise).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("worker reminders (database)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let runReminders: typeof import("@/lib/reminders").runReminders;
  const created: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ prisma } = await import("@/lib/db"));
    ({ runReminders } = await import("@/lib/reminders"));
  });
  afterAll(async () => {
    await prisma.reminderLog.deleteMany({ where: { dealId: { in: created } } });
    await prisma.notification.deleteMany({ where: { link: { in: created.map((id) => `/deals/${id}`) } } });
    await prisma.deal.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it("sends one follow-up and one stale reminder, and never twice", async () => {
    const owner = await prisma.user.findFirstOrThrow({ where: { active: true } });
    const client = await prisma.client.findFirstOrThrow({ where: { deletedAt: null } });
    const stage = await prisma.pipelineStage.findFirstOrThrow({ where: { kind: "OPEN" } });
    const morning = new Date("2026-11-07T06:00:00Z"); // 09:00 in Hargeisa
    const deal = await prisma.deal.create({
      data: {
        title: "Reminder test",
        clientId: client.id,
        productType: "NON_IT",
        stageId: stage.id,
        probability: stage.probability,
        ownerId: owner.id,
        nextFollowUpAt: new Date("2026-11-07T00:00:00Z"),
        lastActivityAt: new Date("2026-09-01T00:00:00Z"),
      },
    });
    created.push(deal.id);
    const first = await runReminders(morning);
    expect(first.followUps).toBeGreaterThanOrEqual(1);
    expect(first.stale).toBeGreaterThanOrEqual(1);
    const notes = await prisma.notification.findMany({ where: { link: `/deals/${deal.id}` } });
    expect(notes.map((n) => n.type).sort()).toEqual(["FOLLOW_UP_DUE", "STALE_DEAL"]);
    await runReminders(morning);
    expect(await prisma.notification.count({ where: { link: `/deals/${deal.id}` } })).toBe(2);
  });

  it("does not send follow-ups before 7:00 Hargeisa time", async () => {
    const owner = await prisma.user.findFirstOrThrow({ where: { active: true } });
    const client = await prisma.client.findFirstOrThrow({ where: { deletedAt: null } });
    const stage = await prisma.pipelineStage.findFirstOrThrow({ where: { kind: "OPEN" } });
    const deal = await prisma.deal.create({
      data: { title: "Early test", clientId: client.id, productType: "NON_IT", stageId: stage.id, probability: 10, ownerId: owner.id, nextFollowUpAt: new Date("2026-11-08T00:00:00Z") },
    });
    created.push(deal.id);
    await runReminders(new Date("2026-11-08T02:00:00Z")); // 05:00 local
    expect(await prisma.notification.count({ where: { link: `/deals/${deal.id}`, type: "FOLLOW_UP_DUE" } })).toBe(0);
  });
});
