import { Tabs } from "@/components/ui/tabs";

export function CustomerTabs({ active }: { active: "entities" | "groups" }) {
  return (
    <Tabs
      active={active}
      tabs={[
        { key: "entities", label: "Entities", href: "/clients" },
        { key: "groups", label: "Groups", href: "/clients/groups" },
      ]}
    />
  );
}
