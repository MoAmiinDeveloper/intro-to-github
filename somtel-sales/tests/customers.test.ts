import { describe, expect, it } from "vitest";
import { allowedLinks, applyGroupDefaults, canLinkPerson } from "@/lib/customers";

const group = { sectorId: "logistics", ownerId: "amina" };

describe("group defaults for a new entity", () => {
  it("copies sector and owner from the group when the entity has none", () => {
    expect(applyGroupDefaults({ name: "Sahan Trading", sectorId: null, ownerId: null }, group)).toMatchObject({ sectorId: "logistics", ownerId: "amina" });
  });
  it("keeps the entity's own values (they can differ from the group)", () => {
    expect(applyGroupDefaults({ sectorId: "finance", ownerId: "abdi" }, group)).toEqual({ sectorId: "finance", ownerId: "abdi" });
  });
  it("does nothing for a standalone entity", () => {
    expect(applyGroupDefaults({ sectorId: null, ownerId: null }, null)).toEqual({ sectorId: null, ownerId: null });
  });
});

describe("people working with more than one entity", () => {
  const logistics = { id: "e1", groupId: "sahan" };
  const trading = { id: "e2", groupId: "sahan" };
  const bank = { id: "e3", groupId: "barwaaqo" };
  const standalone = { id: "e4", groupId: null };

  it("allows a link to another entity in the same group", () => {
    expect(canLinkPerson(logistics, trading)).toBe(true);
  });
  it("blocks a link to an entity in another group", () => {
    expect(canLinkPerson(logistics, bank)).toBe(false);
  });
  it("blocks links for standalone entities and to the person's own entity", () => {
    expect(canLinkPerson(standalone, { id: "e5", groupId: null })).toBe(false);
    expect(canLinkPerson(logistics, logistics)).toBe(false);
  });
  it("filters a mixed list down to the allowed links, without duplicates", () => {
    expect(allowedLinks(logistics, [trading, bank, standalone, logistics, trading])).toEqual(["e2"]);
  });
});
