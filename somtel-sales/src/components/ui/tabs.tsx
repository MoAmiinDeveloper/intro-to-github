import Link from "next/link";
import { cn } from "@/lib/utils";

export function Tabs({ base, tabs, active }: { base: string; tabs: { key: string; label: string }[]; active: string }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200">
      {tabs.map((t, i) => (
        <Link
          key={t.key}
          href={i === 0 ? base : `${base}?tab=${t.key}`}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm",
            active === t.key ? "border-gold font-semibold text-navy" : "border-transparent text-gray-500 hover:text-navy",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
