/**
 * Background worker:
 * - sends queued emails every 30 seconds
 * - checks follow-up and stale-deal reminders every 15 minutes
 * Later phases add renewal alerts and order reminders to the same loop.
 */
import { prisma } from "../src/lib/db";
import { processOutbox, smtpConfigured } from "../src/lib/email";
import { runReminders } from "../src/lib/reminders";

const EMAIL_EVERY_MS = 30_000;
const REMINDERS_EVERY_MS = 15 * 60_000;
let stopping = false;
let lastReminders = 0;

async function tick() {
  try {
    if (Date.now() - lastReminders >= REMINDERS_EVERY_MS) {
      lastReminders = Date.now();
      const r = await runReminders();
      if (r.followUps || r.stale) console.log(`[worker] reminders: follow-ups ${r.followUps}, stale ${r.stale}`);
    }
  } catch (e) {
    console.error("[worker] reminder error", e);
  }
  try {
    const r = await processOutbox();
    if (r.sent || r.failed) console.log(`[worker] emails sent ${r.sent}, failed ${r.failed}`);
  } catch (e) {
    console.error("[worker] email error", e);
  }
}

async function loop() {
  console.log(`[worker] started. SMTP ${smtpConfigured() ? "is set up" : "is NOT set up, emails will wait in the queue"}.`);
  while (!stopping) {
    await tick();
    await new Promise((r) => setTimeout(r, EMAIL_EVERY_MS));
  }
  await prisma.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
loop();
