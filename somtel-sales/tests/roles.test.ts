import { describe, expect, it } from "vitest";
import { hasPermission, teamMemberIds, wouldCreateLoop } from "@/lib/roles";

// Reporting line from the brief: Sector Managers -> Manager -> Head of Enterprise
const users = [
  { id: "head", managerId: null },
  { id: "manager", managerId: "head" },
  { id: "am1", managerId: "manager" },
  { id: "am2", managerId: "manager" },
  { id: "other", managerId: null },
];

describe("reporting line", () => {
  it("a manager's team is everyone below them", () => {
    expect(teamMemberIds("manager", users).sort()).toEqual(["am1", "am2"]);
    expect(teamMemberIds("head", users).sort()).toEqual(["am1", "am2", "manager"]);
    expect(teamMemberIds("am1", users)).toEqual([]);
  });
  it("does not loop forever on bad data", () => {
    const loop = [
      { id: "a", managerId: "b" },
      { id: "b", managerId: "a" },
    ];
    expect(teamMemberIds("a", loop)).toEqual(["b"]);
  });
  it("blocks a manager change that would make a loop", () => {
    expect(wouldCreateLoop("manager", "am1", users)).toBe(true);
    expect(wouldCreateLoop("head", "am2", users)).toBe(true);
    expect(wouldCreateLoop("am1", "am1", users)).toBe(true);
    expect(wouldCreateLoop("am1", "other", users)).toBe(false);
    expect(wouldCreateLoop("am1", null, users)).toBe(false);
  });
});

describe("permissions", () => {
  it("Admin can do everything", () => {
    expect(hasPermission(["ADMIN"], "settings.manage")).toBe(true);
    expect(hasPermission(["ADMIN"], "catalog.manage")).toBe(true);
  });
  it("only Admin manages settings, users and the catalog", () => {
    for (const role of ["HEAD_OF_ENTERPRISE", "MANAGER", "ACCOUNT_MANAGER", "FINANCE", "BILLING", "TECH"] as const) {
      expect(hasPermission([role], "settings.manage")).toBe(false);
      expect(hasPermission([role], "users.manage")).toBe(false);
      expect(hasPermission([role], "catalog.manage")).toBe(false);
    }
  });
  it("Tech Section users do not see clients or the catalog", () => {
    expect(hasPermission(["TECH"], "clients.view")).toBe(false);
    expect(hasPermission(["TECH"], "catalog.view")).toBe(false);
  });
  it("account managers see only their own clients, Head sees all", () => {
    expect(hasPermission(["ACCOUNT_MANAGER"], "clients.viewAll")).toBe(false);
    expect(hasPermission(["MANAGER"], "clients.viewAll")).toBe(false);
    expect(hasPermission(["HEAD_OF_ENTERPRISE"], "clients.viewAll")).toBe(true);
  });
  it("distributor costs are hidden from Billing and Tech", () => {
    expect(hasPermission(["BILLING"], "costs.view")).toBe(false);
    expect(hasPermission(["TECH"], "costs.view")).toBe(false);
    expect(hasPermission(["ACCOUNT_MANAGER"], "costs.view")).toBe(true);
    expect(hasPermission(["PROCUREMENT"], "costs.record")).toBe(true);
    expect(hasPermission(["FINANCE"], "costs.record")).toBe(false);
  });
  it("roles add up when a user has more than one", () => {
    expect(hasPermission(["TECH", "ACCOUNT_MANAGER"], "clients.create")).toBe(true);
  });
});
