"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { type ActionState, handleActionError } from "@/lib/action";
import { assertPermission } from "@/lib/session";
import { SETTINGS, parseSettingInput, validateSettingsTogether, type SettingValue } from "@/lib/settings-registry";

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission("settings.manage");
    const group = fd.get("_group")?.toString();
    const defs = SETTINGS.filter((s) => !group || s.group === group);

    const current = new Map((await prisma.setting.findMany()).map((r) => [r.key, r.value as SettingValue]));
    const merged = new Map<string, SettingValue>(SETTINGS.map((d) => [d.key, current.has(d.key) ? current.get(d.key)! : d.default]));
    const fieldErrors: Record<string, string> = {};
    const updates = new Map<string, SettingValue>();

    for (const def of defs) {
      const raw = def.type === "weekdays" ? fd.getAll(def.key).map(String) : fd.get(def.key)?.toString();
      const res = parseSettingInput(def, raw);
      if (!res.ok) fieldErrors[def.key] = res.error;
      else {
        updates.set(def.key, res.value);
        merged.set(def.key, res.value);
      }
    }
    Object.assign(fieldErrors, validateSettingsTogether(merged));
    if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of updates) {
        const old = current.has(key) ? current.get(key) : SETTINGS.find((d) => d.key === key)!.default;
        if (JSON.stringify(old) === JSON.stringify(value)) continue;
        before[key] = old;
        after[key] = value;
        const json = value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
        await tx.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
      }
      if (Object.keys(after).length)
        await audit(tx, { userId: user.id, action: "UPDATE", entityType: "Setting", summary: `Changed settings: ${Object.keys(after).join(", ")}`, before, after });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: Object.keys(after).length ? "Settings saved." : "No changes to save." };
  } catch (e) {
    return handleActionError(e);
  }
}
