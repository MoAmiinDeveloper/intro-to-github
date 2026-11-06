import { Tabs } from "@/components/ui/tabs";

const TABS = [
  { key: "services", label: "Somtel services", href: "/catalog" },
  { key: "it", label: "IT products", href: "/catalog/it" },
  { key: "vendors", label: "Vendors", href: "/catalog/vendors" },
  { key: "distributors", label: "Distributors", href: "/catalog/distributors" },
];

export function CatalogTabs({ active }: { active: "services" | "it" | "vendors" | "distributors" }) {
  return <Tabs tabs={TABS} active={active} />;
}
