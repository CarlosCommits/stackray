import { describe, expect, it } from "vitest";

import { env } from "@/lib/env/server";
import type { ActorContext } from "@/lib/session/actor-context";
import { getAlertSetupReadiness, getTargetAlertCoverage, listAlertChannels, listAlertPolicies } from "@/lib/server/alerts/service";

function actor(role: ActorContext["user"]["role"]): ActorContext {
  return {
    user: {
      id: "777be4a0-573b-4da8-9f68-ce9f5a472d87",
      email: `${role}@example.com`,
      displayName: role,
      image: null,
      role,
    },
    apiKeyAccessEnabled: false,
    requiresPasswordChange: false,
    source: "ui",
    apiKey: null,
  };
}

describe("alert settings service permissions", () => {
  it.each(["user", "viewer"] as const)("rejects %s actors before querying alert configuration", async (role) => {
    await expect(listAlertChannels(actor(role))).rejects.toThrow("permission");
    await expect(listAlertPolicies(actor(role))).rejects.toThrow("permission");
    await expect(getTargetAlertCoverage(actor(role), "6da61847-8d5a-455d-bbb5-97ea23689312")).rejects.toThrow("permission");
  });
});

describe("alert setup readiness", () => {
  it("keeps webhooks available without an encryption key", async () => {
    const originalKey = env.STACKRAY_ENCRYPTION_KEY;
    env.STACKRAY_ENCRYPTION_KEY = undefined;

    try {
      expect((await getAlertSetupReadiness({ emailReady: false })).webhooks).toEqual({
        status: "ready",
        detail: "Webhooks are available, but credentials are stored without application-layer encryption.",
        missingEnvironmentVariables: ["STACKRAY_ENCRYPTION_KEY"],
      });
    } finally {
      env.STACKRAY_ENCRYPTION_KEY = originalKey;
    }
  });

  it("falls back to plaintext when the configured key is invalid", async () => {
    const originalKey = env.STACKRAY_ENCRYPTION_KEY;
    env.STACKRAY_ENCRYPTION_KEY = "not-a-valid-key";

    try {
      expect((await getAlertSetupReadiness({ emailReady: false })).webhooks).toEqual({
        status: "ready",
        detail: "Webhooks are available without encryption because STACKRAY_ENCRYPTION_KEY is invalid.",
        missingEnvironmentVariables: ["STACKRAY_ENCRYPTION_KEY"],
      });
    } finally {
      env.STACKRAY_ENCRYPTION_KEY = originalKey;
    }
  });
});
