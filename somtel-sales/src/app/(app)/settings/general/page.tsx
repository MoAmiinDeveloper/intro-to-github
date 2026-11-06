import { getAllSettings } from "@/lib/settings";
import { SETTINGS, SETTING_GROUPS, type SettingGroup } from "@/lib/settings-registry";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsGroupForm } from "./settings-form";

export const metadata = { title: "Business rules" };

export default async function GeneralSettingsPage() {
  const all = await getAllSettings();
  const values = Object.fromEntries(all);
  return (
    <>
      <PageHeader title="Business rules" description="Numbers and rules used across the system. Every change is recorded in the audit log." />
      <div className="space-y-5">
        {(Object.keys(SETTING_GROUPS) as SettingGroup[]).map((g) => (
          <SettingsGroupForm key={g} group={g} title={SETTING_GROUPS[g]} defs={SETTINGS.filter((s) => s.group === g)} values={values} />
        ))}
      </div>
    </>
  );
}
