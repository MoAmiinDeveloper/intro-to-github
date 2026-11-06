export const LIST_KINDS = {
  sectors: { title: "Sectors", singular: "sector", model: "sector", entity: "Sector", hasEmail: false, help: "Client sectors. Account managers are linked to one or more sectors." },
  "tech-sections": {
    title: "Tech sections",
    singular: "tech section",
    model: "techSection",
    entity: "TechSection",
    hasEmail: true,
    help: "Teams that activate services. Each catalog service is linked to the sections it needs. The email is the team mailbox for order notifications.",
  },
  "lost-reasons": { title: "Lost reasons", singular: "lost reason", model: "lostReason", entity: "LostReason", hasEmail: false, help: "Shown when a deal is moved to Lost. A reason is required." },
} as const;

export type ListKind = keyof typeof LIST_KINDS;
export const isListKind = (k: string): k is ListKind => k in LIST_KINDS;
