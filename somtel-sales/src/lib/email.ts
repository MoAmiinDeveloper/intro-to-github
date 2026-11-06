import nodemailer from "nodemailer";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

export function smtpConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

export function smtpSummary() {
  return {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    from: process.env.SMTP_FROM || "",
  };
}

function transport() {
  const s = smtpSummary();
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: s.user ? { user: s.user, pass: process.env.SMTP_PASSWORD || "" } : undefined,
  });
}

/** Branded HTML wrapper for every email. */
export function emailLayout(title: string, bodyHtml: string, action?: { label: string; url: string }) {
  const button = action
    ? `<p style="margin:24px 0"><a href="${action.url}" style="background:#FFD700;color:#222D5D;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f5f9;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background:#222D5D;padding:16px 24px;border-bottom:4px solid #FFD700;color:#fff;font-size:18px;font-weight:600">Somtel Enterprise</td></tr>
<tr><td style="padding:24px"><h2 style="margin:0 0 12px;color:#222D5D;font-size:18px">${escapeHtml(title)}</h2>${bodyHtml}${button}</td></tr>
<tr><td style="padding:12px 24px;background:#f9fafb;color:#6b7280;font-size:12px">This is an automatic message from the Somtel Enterprise Sales System.</td></tr>
</table></td></tr></table></body></html>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Put an email in the queue. The worker sends it (with retries), so saving never waits on SMTP. */
export async function queueEmail(tx: Tx, mail: { to: string; cc?: string; subject: string; html: string; text?: string }) {
  await tx.emailOutbox.create({ data: { ...mail } });
}

/** Send one email now. Used by the worker and by the "send test email" button. */
export async function sendNow(mail: { to: string; cc?: string | null; subject: string; html: string; text?: string | null }) {
  if (!smtpConfigured()) throw new Error("SMTP is not set up. Fill in SMTP_HOST and the other SMTP values in .env.");
  await transport().sendMail({
    from: process.env.SMTP_FROM,
    to: mail.to,
    cc: mail.cc ?? undefined,
    subject: mail.subject,
    html: mail.html,
    text: mail.text ?? undefined,
  });
}

const MAX_ATTEMPTS = 6;

/** Send queued emails. Retries with a growing wait (1, 2, 4, 8, 16 minutes). */
export async function processOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  if (!smtpConfigured()) return { sent: 0, failed: 0 };
  const batch = await prisma.emailOutbox.findMany({
    where: { status: "PENDING", sendAfter: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  for (const mail of batch) {
    try {
      await sendNow(mail);
      await prisma.emailOutbox.update({ where: { id: mail.id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } } });
      sent++;
    } catch (e) {
      const attempts = mail.attempts + 1;
      await prisma.emailOutbox.update({
        where: { id: mail.id },
        data: {
          attempts,
          lastError: e instanceof Error ? e.message.slice(0, 1000) : String(e),
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          sendAfter: new Date(Date.now() + 2 ** (attempts - 1) * 60_000),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}
