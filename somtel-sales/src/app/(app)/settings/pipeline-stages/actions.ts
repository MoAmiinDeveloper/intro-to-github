"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, bool, handleActionError, optStr, str } from "@/lib/action";
import { assertPermission } from "@/lib/session";

const schema = z
  .object({
    name: z.string().min(2, "Enter a name.").max(60),
    description: z.string().max(300).nullable(),
    probability: z.coerce.number().int("Use a whole number.").min(0, "0 to 100.").max(100, "0 to 100."),
    kind: z.enum(["OPEN", "WON", "LOST"]),
    sortOrder: z.coerce.number().int().min(0).max(9999),
    active: z.boolean(),
  })
  .superRefine((s, ctx) => {
    if (s.kind === "WON" && s.probability !== 100) ctx.addIssue({ code: "custom", path: ["probability"], message: "A Won stage must be 100%." });
    if (s.kind === "LOST" && s.probability !== 0) ctx.addIssue({ code: "custom", path: ["probability"], message: "A Lost stage must be 0%." });
  });

export async function saveStageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("settings.manage");
    const id = str(fd, "id");
    const data = schema.parse({
      name: str(fd, "name"),
      description: optStr(fd, "description"),
      probability: str(fd, "probability"),
      kind: str(fd, "kind") || "OPEN",
      sortOrder: str(fd, "sortOrder") || "0",
      active: id ? bool(fd, "active") : true,
    });
    await prisma.$transaction(async (tx) => {
      const dup = await tx.pipelineStage.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } });
      if (dup) throw new UserError("A stage with this name already exists.");
      if (id) {
        const before = await tx.pipelineStage.findUniqueOrThrow({ where: { id } });
        const after = await tx.pipelineStage.update({ where: { id }, data });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: "PipelineStage", entityId: id, summary: `Updated pipeline stage ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const s = await tx.pipelineStage.create({ data });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: "PipelineStage", entityId: s.id, summary: `Added pipeline stage ${s.name}`, after: s });
      }
      for (const kind of ["WON", "LOST"] as const) {
        const n = await tx.pipelineStage.count({ where: { kind, active: true } });
        if (n !== 1) throw new UserError(`There must be exactly one active ${kind === "WON" ? "Won" : "Lost"} stage.`);
      }
    });
    revalidatePath("/settings/pipeline-stages");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return handleActionError(e);
  }
}
