import type { Permission } from "@/lib/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: "home" | "clients" | "catalog" | "settings" | "audit" | "bell";
  permission?: Permission;
}

export const NAV: NavItem[] = [
  { href: "/", label: "My dashboard", icon: "home" },
  { href: "/clients", label: "Customers", icon: "clients", permission: "clients.view" },
  { href: "/catalog", label: "Catalog", icon: "catalog", permission: "catalog.view" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/settings", label: "Settings", icon: "settings", permission: "settings.manage" },
  { href: "/audit", label: "Audit log", icon: "audit", permission: "audit.view" },
];
