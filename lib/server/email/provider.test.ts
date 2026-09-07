import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfiguredResendOauthGrant: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/server/email/oauth-grant", () => ({
  getConfiguredResendOauthGrant: mocks.getConfiguredResendOauthGrant,
}));

import { deliverConfiguredEmail } from "./provider.ts";
import { ResendOauthRequestError } from "./resend-oauth.ts";

const message = {
  to: "admin@example.com",
  subject: "Test",
  html: "<p>Test</p>",
  text: "Test",
};

describe("configured email delivery", () => {
  beforeEach(() => {
    mocks.getConfiguredResendOauthGrant.mockReset();
  });

  it("retries transient OAuth refresh failures", async () => {
    mocks.getConfiguredResendOauthGrant.mockRejectedValue(new ResendOauthRequestError(
      "provider unavailable",
      { retryable: true, statusCode: 503 },
    ));

    await expect(deliverConfiguredEmail(message)).resolves.toEqual({
      ok: false,
      category: "provider_error",
      retryable: true,
      safeMessage: "The email provider credential refresh request temporarily failed.",
    });
  });

  it("keeps rejected grants nonretryable", async () => {
    mocks.getConfiguredResendOauthGrant.mockRejectedValue(new ResendOauthRequestError(
      "invalid grant",
      { retryable: false, statusCode: 400 },
    ));

    await expect(deliverConfiguredEmail(message)).resolves.toMatchObject({
      ok: false,
      category: "invalid_configuration",
      retryable: false,
    });
  });
});
