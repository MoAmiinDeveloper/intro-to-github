import type { Permission } from "@/lib/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: "home" | "clients" | "catalog" | "settings" | "audit" | "bell" | "pipeline" | "followups";
  permission?: Permission;
  badge?: number;
}

export const NAV: NavItem[] = [
  { href: "/", label: "My dashboard", icon: "home" },
  { href: "/pipeline", label: "Pipeline", icon: "pipeline", permission: "deals.view" },
  { href: "/follow-ups", label: "Follow-ups", icon: "followups", permission: "deals.view" },
  { href: "/clients", label: "Customers", icon: "clients", permission: "clients.view" },
  { href: "/catalog", label: "Catalog", icon: "catalog", permission: "catalog.view" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/settings", label: "Settings", icon: "settings", permission: "settings.manage" },
  { href: "/audit", label: "Audit log", icon: "audit", permission: "audit.view" },
];
