import { describe, expect, it } from "vitest";
import { hasPermission, isAdmin } from "./permissions";

describe("hasPermission", () => {
  it("returns true when the user has the role explicitly", () => {
    expect(hasPermission("Requester", ["Requester"])).toBe(true);
    expect(hasPermission("Solution Owner", ["Estimator", "Solution Owner"])).toBe(true);
  });

  it("returns true when the user has Admin (the implication)", () => {
    expect(hasPermission("Requester", ["Admin"])).toBe(true);
    expect(hasPermission("Solution Owner", ["Admin"])).toBe(true);
    expect(hasPermission("Estimator", ["Admin"])).toBe(true);
  });

  it("returns false when the user has neither the role nor Admin", () => {
    expect(hasPermission("Requester", ["Solution Owner"])).toBe(false);
    expect(hasPermission("Solution Owner", ["Requester"])).toBe(false);
    expect(hasPermission("Admin", ["Estimator"])).toBe(false);
  });

  it("returns false for an empty role list", () => {
    expect(hasPermission("Requester", [])).toBe(false);
  });

  it("compares role names case-insensitively", () => {
    // The constants in lib/types use title case ("Admin", "Solution Owner")
    // but a defensive test pins the case-insensitive comparison.
    expect(hasPermission("admin", ["Admin"])).toBe(true);
    expect(hasPermission("REQUESTER", ["requester"])).toBe(true);
  });
});

describe("isAdmin", () => {
  it("returns true only when the user literally has the Admin role", () => {
    expect(isAdmin(["Admin"])).toBe(true);
    expect(isAdmin(["Admin", "Solution Owner"])).toBe(true);
  });

  it("returns false for any non-Admin role combination", () => {
    expect(isAdmin(["Solution Owner"])).toBe(false);
    expect(isAdmin(["Requester", "Estimator"])).toBe(false);
    expect(isAdmin([])).toBe(false);
  });
});
