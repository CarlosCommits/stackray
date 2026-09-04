import { describe, expect, it } from "vitest";

import { roleHasPermission } from "@/lib/auth/permissions";

describe("alert and baseline permissions", () => {
  it("keeps instance-wide alert configuration admin-only", () => {
    for (const permission of ["alerts:manage", "alerts:view-deliveries", "baselines:manage"] as const) {
      expect(roleHasPermission("admin", permission)).toBe(true);
      expect(roleHasPermission("user", permission)).toBe(false);
      expect(roleHasPermission("viewer", permission)).toBe(false);
    }
  });

  it("keeps scan visibility available to every app role", () => {
    expect(roleHasPermission("admin", "scans:view")).toBe(true);
    expect(roleHasPermission("user", "scans:view")).toBe(true);
    expect(roleHasPermission("viewer", "scans:view")).toBe(true);
  });
});
