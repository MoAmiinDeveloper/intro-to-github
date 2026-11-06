"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, changedFields } from "@/lib/audit";
import { type ActionState, UserError, bool, handleActionError, str } from "@/lib/action";
import { assertPermission } from "@/lib/session";
import { optionalEmail } from "@/lib/validation";
import { LIST_KINDS, isListKind } from "./config";

type Row = { id: string; name: string; active: boolean; sortOrder: number; email?: string | null };
interface Delegate {
  findFirst(args: unknown): Promise<Row | null>;
  findUniqueOrThrow(args: unknown): Promise<Row>;
  create(args: unknown): Promise<Row>;
  update(args: unknown): Promise<Row>;
}

const schema = z.object({
  name: z.string().min(2, "Enter a name.").max(120),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  email: optionalEmail.optional(),
});

export async function saveListItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("settings.manage");
    const kind = str(fd, "kind");
    if (!isListKind(kind)) throw new UserError("Unknown list.");
    const cfg = LIST_KINDS[kind];
    const id = str(fd, "id");
    const parsed = schema.parse({
      name: str(fd, "name"),
      active: id ? bool(fd, "active") : true,
      sortOrder: str(fd, "sortOrder") || "0",
      ...(cfg.hasEmail ? { email: str(fd, "email") } : {}),
    });
    const data = cfg.hasEmail ? parsed : { name: parsed.name, active: parsed.active, sortOrder: parsed.sortOrder };

    await prisma.$transaction(async (tx) => {
      const model = (tx as unknown as Record<string, Delegate>)[cfg.model]!;
      const dup = await model.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) } });
      if (dup) throw new UserError(`A ${cfg.singular} with this name already exists.`);
      if (id) {
        const before = await model.findUniqueOrThrow({ where: { id } });
        const after = await model.update({ where: { id }, data });
        const diff = changedFields(before, after);
        if (diff.changed) await audit(tx, { userId: user.id, action: "UPDATE", entityType: cfg.entity, entityId: id, summary: `Updated ${cfg.singular} ${after.name}`, before: diff.before, after: diff.after });
      } else {
        const row = await model.create({ data });
        await audit(tx, { userId: user.id, action: "CREATE", entityType: cfg.entity, entityId: row.id, summary: `Added ${cfg.singular} ${row.name}`, after: row });
      }
    });
    revalidatePath(`/settings/lists/${kind}`);
    return { ok: true, message: id ? "Saved." : "Added." };
  } catch (e) {
    return handleActionError(e);
  }
}
