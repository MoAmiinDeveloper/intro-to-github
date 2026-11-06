import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { SETTINGS, SETTINGS_BY_KEY, type SettingValue } from "./settings-registry";

/** All settings with defaults filled in. Cached for one request. */
export const getAllSettings = cache(async (): Promise<Map<string, SettingValue>> => {
  const rows = await prisma.setting.findMany();
  const stored = new Map(rows.map((r) => [r.key, r.value as SettingValue]));
  const out = new Map<string, SettingValue>();
  for (const def of SETTINGS) out.set(def.key, stored.has(def.key) ? stored.get(def.key)! : def.default);
  return out;
});

export async function getSetting<T extends SettingValue = SettingValue>(key: string): Promise<T> {
  if (!SETTINGS_BY_KEY.has(key)) throw new Error(`Unknown setting ${key}`);
  return (await getAllSettings()).get(key) as T;
}
