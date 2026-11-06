"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { type ActionState, handleActionError, str } from "@/lib/action";
import { assertPermission } from "@/lib/session";
import { emailLayout, sendNow } from "@/lib/email";
import { emailSchema } from "@/lib/validation";

export async function sendTestEmailAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await assertPermission("settings.manage");
    const to = emailSchema.parse(str(fd, "to"));
    await sendNow({
      to,
      subject: "Test email from the Somtel Enterprise Sales System",
      html: emailLayout("Email is working", "<p>If you can read this, the SMTP settings are correct.</p>"),
    });
    return { ok: true, message: `Test email sent to ${to}.` };
  } catch (e) {
    if (e instanceof Error && !("digest" in e) && e.name !== "ZodError" && e.message) return { error: `Could not send: ${e.message}` };
    return handleActionError(e);
  }
}

export async function retryFailedEmailsAction() {
  await assertPermission("settings.manage");
  await prisma.emailOutbox.updateMany({ where: { status: "FAILED" }, data: { status: "PENDING", attempts: 0, sendAfter: new Date() } });
  revalidatePath("/settings/email");
}
