/**
 * Scheduled reminders, run by the worker:
 * - follow-up due: once per deal per follow-up date, from 7:00 local time on that day (or later if overdue)
 * - stale deal: once each time a deal goes stale (no activity for the stale days setting)
 * Each reminder is an in-app notification; each user also gets one summary email per run.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { emailLayout, escapeHtml, queueEmail } from "./email";
import { SETTINGS_BY_KEY } from "./settings-registry";
import { APP_TIMEZONE, dateKey, todayIn } from "./pipeline";

async function numberSetting(key: string): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const v = row ? row.value : SETTINGS_BY_KEY.get(key)!.default;
  return typeof v === "number" ? v : Number(v);
}

export function localHour(now: Date, timeZone = APP_TIMEZONE): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** Records the reminder; false if it was already sent. */
async function claim(kind: string, dealId: string, key: string): Promise<boolean> {
  try {
    await prisma.reminderLog.create({ data: { kind, dealId, key } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

type Item = { title: string; body: string; link: string };

export async function runReminders(now = new Date()): Promise<{ followUps: number; stale: number }> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const today = todayIn(now);
  const perUser = new Map<string, { email: string; name: string; followUps: Item[]; stale: Item[] }>();
  const add = (u: { id: string; email: string; name: string }, kind: "followUps" | "stale", item: Item) => {
    const entry = perUser.get(u.id) ?? { email: u.email, name: u.name, followUps: [], stale: [] };
    entry[kind].push(item);
    perUser.set(u.id, entry);
  };
  let followUps = 0;
  let stale = 0;

  // Follow-ups: not before 7:00 in the morning (Hargeisa time).
  if (localHour(now) >= 7) {
    const due = await prisma.deal.findMany({
      where: { deletedAt: null, stage: { kind: "OPEN" }, nextFollowUpAt: { lte: new Date(`${today}T00:00:00Z`) }, owner: { active: true, deletedAt: null } },
      include: { owner: true, client: { select: { name: true } } },
    });
    for (const d of due) {
      if (!(await claim("FOLLOW_UP", d.id, dateKey(d.nextFollowUpAt!)))) continue;
      const overdue = dateKey(d.nextFollowUpAt!) < today;
      const item = {
        title: overdue ? `Follow-up overdue: ${d.title}` : `Follow-up due today: ${d.title}`,
        body: `${d.client.name}${d.nextStep ? `. Next step: ${d.nextStep}` : ""}`,
        link: `/deals/${d.id}`,
      };
      await prisma.notification.create({ data: { userId: d.ownerId, type: "FOLLOW_UP_DUE", ...item } });
      add(d.owner, "followUps", item);
      followUps++;
    }
  }

  // Stale deals: one reminder each time a deal goes stale.
  const staleDays = await numberSetting("pipeline.staleDays");
  const staleDeals = await prisma.deal.findMany({
    where: { deletedAt: null, stage: { kind: "OPEN" }, lastActivityAt: { lte: new Date(now.getTime() - staleDays * 86_400_000) }, owner: { active: true, deletedAt: null } },
    include: { owner: true, client: { select: { name: true } } },
  });
  for (const d of staleDeals) {
    if (!(await claim("STALE", d.id, d.lastActivityAt.toISOString()))) continue;
    const item = { title: `Stale deal: ${d.title}`, body: `${d.client.name}. No activity for ${staleDays} days or more.`, link: `/deals/${d.id}` };
    await prisma.notification.create({ data: { userId: d.ownerId, type: "STALE_DEAL", ...item } });
    add(d.owner, "stale", item);
    stale++;
  }

  // One summary email per person.
  for (const u of perUser.values()) {
    const list = (items: Item[]) =>
      `<ul>${items.map((i) => `<li><a href="${appUrl}${i.link}">${escapeHtml(i.title)}</a><br><span style="color:#6b7280">${escapeHtml(i.body)}</span></li>`).join("")}</ul>`;
    const parts = [
      u.followUps.length ? `<p><strong>Follow-ups</strong></p>${list(u.followUps)}` : "",
      u.stale.length ? `<p><strong>Deals with no recent activity</strong></p>${list(u.stale)}` : "",
    ].join("");
    const count = u.followUps.length + u.stale.length;
    await queueEmail(prisma, {
      to: u.email,
      subject: `${count} ${count === 1 ? "deal needs" : "deals need"} your attention`,
      html: emailLayout(`Hello ${u.name.split(" ")[0]}`, parts, { label: "Open my follow-ups", url: `${appUrl}/follow-ups` }),
    });
  }
  return { followUps, stale };
}
