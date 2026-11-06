/**
 * Background worker: sends queued emails now. Later phases add scheduled jobs
 * (stale deals, follow-ups, renewal alerts, quote expiry) to the same loop.
 */
import { prisma } from "../src/lib/db";
import { processOutbox, smtpConfigured } from "../src/lib/email";

const INTERVAL_MS = 30_000;
let stopping = false;

async function tick() {
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
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  await prisma.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
loop();
