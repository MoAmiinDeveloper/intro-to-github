import { requirePermission } from "@/lib/session";
import { SettingsNav } from "./nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("settings.manage");
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-52 lg:shrink-0">
        <div className="mb-3 hidden text-xs font-semibold uppercase tracking-wide text-gray-500 lg:block">Settings</div>
        <SettingsNav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
