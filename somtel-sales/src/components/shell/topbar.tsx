import Link from "next/link";
import { Bell, LogOut, Search, UserCircle } from "lucide-react";
import { signOut } from "@/auth";
import { initials } from "@/lib/utils";

export function TopBar({ name, roleLabel, unread }: { name: string; roleLabel: string; unread: number }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
      <form action="/search" className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          name="q"
          placeholder="Search customers, people..."
          className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm focus:border-navy-300 focus:bg-white focus:outline-none"
        />
      </form>
      <div className="ml-auto flex items-center gap-3">
        <Link href="/notifications" className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100" title="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold text-navy">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <Link href="/profile" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100" title="My profile">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-gold">
            {initials(name) || <UserCircle className="h-5 w-5" />}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium text-gray-900">{name}</span>
            <span className="block text-xs text-gray-500">{roleLabel}</span>
          </span>
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100" title="Sign out">
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
