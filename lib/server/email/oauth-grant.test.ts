import { describe, expect, it } from "vitest";

import {
  assertUsableResendOauthScope,
  parseResendOauthTokenBundle,
  serializeResendOauthTokenBundle,
} from "@/lib/server/email/oauth-grant";

describe("Resend OAuth grants", () => {
  it("accepts send-only and broader grants but rejects grants that cannot send", () => {
    expect(() => assertUsableResendOauthScope("emails:send")).not.toThrow();
    expect(() => assertUsableResendOauthScope("full_access")).not.toThrow();
    expect(() => assertUsableResendOauthScope("domains:read")).toThrow("did not grant permission");
  });

  it("round-trips the rotating token pair stored in the secret envelope", () => {
    const serialized = serializeResendOauthTokenBundle({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    expect(parseResendOauthTokenBundle(serialized)).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });
});
