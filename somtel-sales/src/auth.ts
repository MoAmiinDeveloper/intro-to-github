import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/db";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

class LockedError extends CredentialsSignin {
  code = "locked";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active || user.deletedAt) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) throw new LockedError();

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed >= MAX_FAILED ? 0 : failed,
              lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          });
          await prisma.auditLog.create({
            data: { userId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id },
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await prisma.auditLog.create({
          data: { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id },
        });
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
    // Microsoft 365 login can be added here later with the "microsoft-entra-id" provider.
  ],
});
