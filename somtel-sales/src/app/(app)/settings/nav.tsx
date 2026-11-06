"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings/general", label: "Business rules" },
  { href: "/settings/company", label: "Company and logo" },
  { href: "/settings/users", label: "Users and roles" },
  { href: "/settings/lists/sectors", label: "Sectors" },
  { href: "/settings/lists/tech-sections", label: "Tech sections" },
  { href: "/settings/pipeline-stages", label: "Pipeline stages" },
  { href: "/settings/lists/lost-reasons", label: "Lost reasons" },
  { href: "/settings/lists/it-categories", label: "IT categories" },
  { href: "/settings/terms", label: "T&C templates" },
  { href: "/settings/clauses", label: "T&C clauses" },
  { href: "/settings/email", label: "Email" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((i) => {
        const active = pathname === i.href || pathname.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm",
              active ? "bg-navy text-white font-medium" : "text-gray-700 hover:bg-gray-100",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
