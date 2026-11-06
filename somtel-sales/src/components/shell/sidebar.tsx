"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, FileClock, Home, Package, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav";

const ICONS = { home: Home, clients: Building2, catalog: Package, settings: Settings, audit: FileClock, bell: Bell };

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-navy text-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-navy-400/40 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/branding/logo" alt="Somtel" className="h-9 w-auto rounded bg-white p-0.5" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">Somtel Enterprise</div>
          <div className="text-[11px] text-navy-200">Sales System</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-gold font-semibold text-navy" : "text-navy-100 hover:bg-navy-400/40 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-navy-400/40 p-3 text-[11px] text-navy-200">Part of the Dahabshiil Group</div>
    </aside>
  );
}

export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto bg-navy px-2 py-2 md:hidden">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("whitespace-nowrap rounded px-3 py-1.5 text-xs", active ? "bg-gold text-navy font-semibold" : "text-navy-100")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
