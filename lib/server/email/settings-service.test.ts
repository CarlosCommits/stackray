import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "@/lib/session/actor-context";

const getStoredEmailProviderSettingsMock = vi.fn();
const revokeResendOauthGrantMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/authorization/authz", () => ({
  canManageAlerts: () => true,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: transactionMock,
  },
}));

vi.mock("@/lib/server/alerts/secret-encryption", () => ({
  getOptionalConfiguredAlertEncryptionKey: () => null,
  protectAlertSecret: vi.fn(),
  readStoredAlertSecret: () => "stored-token-bundle",
}));

vi.mock("@/lib/server/email/provider", () => ({
  EMAIL_PROVIDER_SETTINGS_ID: "default",
  deliverConfiguredEmail: vi.fn(),
  formatConfiguredFromAddress: vi.fn(),
  getStoredEmailProviderSettings: getStoredEmailProviderSettingsMock,
}));

vi.mock("@/lib/server/email/oauth-grant", () => ({
  assertUsableResendOauthScope: vi.fn(),
  getConfiguredResendOauthGrant: vi.fn(),
  parseResendOauthTokenBundle: () => ({
    accessToken: "access-token",
    refreshToken: "refresh-token",
  }),
  serializeResendOauthTokenBundle: vi.fn(),
}));

vi.mock("@/lib/server/email/resend-oauth", () => ({
  refreshResendOauthToken: vi.fn(),
  revokeResendOauthGrant: revokeResendOauthGrantMock,
}));

const actor = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@stackray.test",
    displayName: "Admin",
    image: null,
    role: "admin",
  },
  apiKeyAccessEnabled: false,
  requiresPasswordChange: false,
  source: "ui",
  apiKey: null,
} satisfies ActorContext;

describe("email provider settings", () => {
  beforeEach(() => {
    getStoredEmailProviderSettingsMock.mockReset();
    revokeResendOauthGrantMock.mockReset();
    transactionMock.mockReset();
  });

  it("disables email channels when Resend is disconnected", async () => {
    getStoredEmailProviderSettingsMock.mockResolvedValue({
      oauthClientId: "resend-client-id",
    });
    revokeResendOauthGrantMock.mockResolvedValue(undefined);

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const update = vi.fn(() => ({ set: updateSet }));
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteRow = vi.fn(() => ({ where: deleteWhere }));
    transactionMock.mockImplementation(async (callback) => callback({
      update,
      delete: deleteRow,
    }));

    const { disconnectEmailProvider } = await import("./settings-service");
    await disconnectEmailProvider(actor);

    expect(revokeResendOauthGrantMock).toHaveBeenCalledWith(
      "resend-client-id",
      "refresh-token",
    );
    expect(updateSet).toHaveBeenCalledWith({
      enabled: false,
      updatedAt: expect.any(Date),
      updatedByUserId: actor.user.id,
    });
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });
});
