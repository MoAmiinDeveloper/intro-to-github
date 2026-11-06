"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, handleActionError, optStr, str } from "@/lib/action";
import { assertPermission } from "@/lib/session";
import { saveUpload } from "@/lib/files";
import { optionalEmail } from "@/lib/validation";

const schema = z.object({
  name: z.string().min(2, "Enter the company name.").max(200),
  legalName: z.string().max(200).nullable(),
  address: z.string().max(300).nullable(),
  city: z.string().max(120).nullable(),
  phone: z.string().max(60).nullable(),
  email: optionalEmail,
  website: z.string().max(200).nullable(),
  footerText: z.string().max(500).nullable(),
});

export async function saveCompanyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("settings.manage");
    const data = schema.parse({
      name: str(fd, "name"),
      legalName: optStr(fd, "legalName"),
      address: optStr(fd, "address"),
      city: optStr(fd, "city"),
      phone: optStr(fd, "phone"),
      email: str(fd, "email"),
      website: optStr(fd, "website"),
      footerText: optStr(fd, "footerText"),
    });
    let logoPath: string | undefined;
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) {
      try {
        logoPath = await saveUpload(logo, "branding", [".png", ".jpg", ".jpeg", ".svg", ".webp"], 2 * 1024 * 1024);
      } catch (e) {
        throw new UserError((e as Error).message, { logo: (e as Error).message });
      }
    }
    const resetLogo = fd.get("resetLogo") === "on";
    await prisma.$transaction(async (tx) => {
      const before = await tx.companyProfile.findUnique({ where: { id: "company" } });
      const next = { ...data, ...(logoPath ? { logoPath } : resetLogo ? { logoPath: null } : {}) };
      const after = await tx.companyProfile.upsert({ where: { id: "company" }, create: { id: "company", ...next }, update: next });
      const diff = changedFields(before ?? {}, after);
      if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "CompanyProfile", entityId: "company", summary: "Updated company details", before: diff.before, after: diff.after });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Company details saved." };
  } catch (e) {
    return handleActionError(e);
  }
}
