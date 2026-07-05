import { describe, expect, it } from "vitest";

import { getVisibleScansFilter } from "@/lib/server/scans/access";
import type { ActorContext } from "@/lib/session/actor-context";

function actorWithRole(role: ActorContext["user"]["role"]): ActorContext {
  return {
    user: {
      id: "user_01",
      email: "user@example.com",
      displayName: "User",
      image: null,
      role,
    },
    apiKeyAccessEnabled: true,
    requiresPasswordChange: false,
    source: "ui",
    apiKey: null,
  };
}

describe("getVisibleScansFilter", () => {
  it("allows non-admin users to see instance-wide scans", () => {
    expect(getVisibleScansFilter(actorWithRole("user"))).toBeUndefined();
    expect(getVisibleScansFilter(actorWithRole("viewer"))).toBeUndefined();
  });

  it("keeps admins on instance-wide scan visibility", () => {
    expect(getVisibleScansFilter(actorWithRole("admin"))).toBeUndefined();
  });
});
