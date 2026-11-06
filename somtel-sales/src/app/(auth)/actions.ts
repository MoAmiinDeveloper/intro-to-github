"use server";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { type ActionState, str } from "@/lib/action";
import { emailLayout, escapeHtml, queueEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { passwordSchema } from "@/lib/validation";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const next = str(fd, "next");
  try {
    await signIn("credentials", {
      email: str(fd, "email"),
      password: fd.get("password")?.toString() ?? "",
      redirectTo: next.startsWith("/") && !next.startsWith("//") ? next : "/",
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code;
      if (code === "locked") return { error: "Too many failed attempts. Try again in 15 minutes." };
      return { error: "Wrong email or password." };
    }
    throw e;
  }
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address." };
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.active && !user.deletedAt) {
    const token = randomBytes(32).toString("base64url");
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) },
      });
      const url = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password/${token}`;
      await queueEmail(tx, {
        to: user.email,
        subject: "Reset your password",
        html: emailLayout(
          "Reset your password",
          `<p>Hello ${escapeHtml(user.name)},</p><p>Someone asked to reset the password for your account. The link below works for 1 hour. If you did not ask for this, you can ignore this email.</p>`,
          { label: "Set a new password", url },
        ),
      });
    });
  }
  // Same message either way, so the form does not reveal which emails exist.
  return { ok: true, message: "If that email has an account, a reset link is on its way." };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = str(fd, "token");
  const password = fd.get("password")?.toString() ?? "";
  const confirm = fd.get("confirm")?.toString() ?? "";
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { fieldErrors: { password: parsed.error.issues[0]!.message } };
  if (password !== confirm) return { fieldErrors: { confirm: "The passwords do not match." } };

  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { error: "This link has expired. Please ask for a new one." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: null },
    });
    await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await audit(tx, { userId: row.userId, action: "PASSWORD_RESET", entityType: "User", entityId: row.userId, summary: "Password reset by email link" });
  });
  redirect("/login?reset=1");
}
