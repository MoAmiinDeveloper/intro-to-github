/**
 * Creates the first Admin user (or resets an existing user's password and adds the Admin role).
 *   ADMIN_EMAIL=you@somtel.com ADMIN_NAME="Your Name" ADMIN_PASSWORD="..." npm run create-admin
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { passwordSchema } from "../src/lib/validation";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || "System Admin").trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email) throw new Error("Set ADMIN_EMAIL.");
  const check = passwordSchema.safeParse(password);
  if (!check.success) throw new Error(`ADMIN_PASSWORD: ${check.error.issues[0]!.message}`);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, active: true, deletedAt: null, failedLogins: 0, lockedUntil: null },
    create: { email, name, passwordHash },
  });
  await prisma.userRole.upsert({ where: { userId_role: { userId: user.id, role: "ADMIN" } }, update: {}, create: { userId: user.id, role: "ADMIN" } });
  await prisma.auditLog.create({ data: { action: "CREATE", entityType: "User", entityId: user.id, summary: `Admin account set up for ${email} from the command line` } });
  console.log(`Admin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
