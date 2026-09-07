import { describe, expect, it } from "vitest";

import {
  alertChannelSchema,
  createAlertChannelRequestSchema,
  createAlertPolicyRequestSchema,
  configureEmailProviderRequestSchema,
  updateAlertChannelRequestSchema,
  updateAlertPolicyRequestSchema,
} from "@/lib/contracts/alerts";

describe("alert contracts", () => {
  it("normalizes a configured Resend sending domain and requires a dotted hostname", () => {
    expect(configureEmailProviderRequestSchema.parse({
      setupSessionId: "777be4a0-573b-4da8-9f68-ce9f5a472d87",
      domainName: "Mail.Example.COM",
      senderName: "Stackray",
      senderLocalPart: "alerts",
      testRecipient: "admin@example.com",
    }).domainName).toBe("mail.example.com");

    expect(() => configureEmailProviderRequestSchema.parse({
      setupSessionId: "777be4a0-573b-4da8-9f68-ce9f5a472d87",
      domainName: "https://example.com",
      senderName: "Stackray",
      senderLocalPart: "alerts",
      testRecipient: "admin@example.com",
    })).toThrow("Enter a valid domain");

    for (const domainName of ["localhost", "budgetcube", ".example.com", "example.com/path"]) {
      expect(() => configureEmailProviderRequestSchema.parse({
        setupSessionId: "777be4a0-573b-4da8-9f68-ce9f5a472d87",
        domainName,
        senderName: "Stackray",
        senderLocalPart: "alerts",
        testRecipient: "admin@example.com",
      })).toThrow("Enter a valid domain");
    }
  });

  it("validates email, Slack, and webhook channel creation separately", () => {
    expect(createAlertChannelRequestSchema.parse({
      displayName: "Operations",
      channelType: "email",
      recipients: ["OPS@EXAMPLE.COM"],
    })).toMatchObject({ channelType: "email", enabled: true });

    expect(createAlertChannelRequestSchema.parse({
      displayName: "Security Slack",
      channelType: "slack",
      webhookUrl: "https://hooks.slack.com/services/T1/B2/secret",
      channelName: "#security-alerts",
      workspaceName: "Acme",
    })).toMatchObject({ channelType: "slack", channelName: "security-alerts", enabled: true });

    expect(createAlertChannelRequestSchema.parse({
      displayName: "Automation",
      channelType: "webhook",
      endpoint: "https://hooks.example.com/secret-token",
      authorizationHeader: "Bearer credential",
      signingSecret: "sixteen-characters",
    })).toMatchObject({ channelType: "webhook", enabled: true });

    expect(() => createAlertChannelRequestSchema.parse({
      displayName: "Broken",
      channelType: "email",
      recipients: [],
    })).toThrow();
  });

  it("never exposes webhook endpoints or credential fields in a channel response", () => {
    const output = alertChannelSchema.parse({
      id: "777be4a0-573b-4da8-9f68-ce9f5a472d87",
      displayName: "Automation",
      channelType: "webhook",
      enabled: true,
      config: {
        hostname: "hooks.example.com",
        hasAuthorizationHeader: true,
        hasSigningSecret: true,
        endpoint: "https://hooks.example.com/secret-token",
        authorizationHeader: "Bearer credential",
        signingSecret: "sixteen-characters",
      },
      lastTestStatus: "untested",
      lastTestedAt: null,
      lastTestErrorCategory: null,
      createdAt: "2026-07-17T12:00:00.000Z",
      updatedAt: "2026-07-17T12:00:00.000Z",
      secretCiphertext: "ciphertext",
    });

    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("credential");
    expect(serialized).not.toContain("ciphertext");
  });

  it("never exposes Slack webhook URLs in a channel response", () => {
    const output = alertChannelSchema.parse({
      id: "777be4a0-573b-4da8-9f68-ce9f5a472d87",
      displayName: "Security Slack",
      channelType: "slack",
      enabled: true,
      config: {
        workspaceId: "T1",
        workspaceName: "Acme",
        channelId: "C1",
        channelName: "security-alerts",
        connectionSource: "oauth",
        configurationUrl: "https://acme.slack.com/services/B1",
        webhookUrl: "https://hooks.slack.com/services/T1/B1/secret",
      },
      lastTestStatus: "untested",
      lastTestedAt: null,
      lastTestErrorCategory: null,
      createdAt: "2026-07-17T12:00:00.000Z",
      updatedAt: "2026-07-17T12:00:00.000Z",
    });
    expect(JSON.stringify(output)).not.toContain("hooks.slack.com");
    expect(JSON.stringify(output)).not.toContain("secret");
  });

  it("supports state-only and configuration channel updates", () => {
    expect(updateAlertChannelRequestSchema.parse({ enabled: false })).toEqual({ enabled: false });
    expect(updateAlertChannelRequestSchema.parse({
      displayName: "Operations email",
      channelType: "email",
      recipients: ["ops@example.com"],
      enabled: true,
    })).toMatchObject({ channelType: "email", recipients: ["ops@example.com"] });
    expect(updateAlertChannelRequestSchema.parse({
      displayName: "Security Slack",
      channelType: "slack",
      channelName: "#alerts",
      enabled: true,
    })).toMatchObject({ channelType: "slack", channelName: "alerts" });
    expect(updateAlertChannelRequestSchema.parse({
      displayName: "Operations webhook",
      channelType: "webhook",
      enabled: true,
      clearAuthorizationHeader: true,
    })).toMatchObject({
      channelType: "webhook",
      clearAuthorizationHeader: true,
      clearSigningSecret: false,
    });
  });

  it("supports an all-target policy with selected change types", () => {
    const policy = createAlertPolicyRequestSchema.parse({
      name: "Important changes",
      conditions: {
        selectionMode: "selected",
        changeTypes: ["status.changed", "tls.certificate_changed"],
      },
      cooldownSeconds: 900,
      channelIds: ["777be4a0-573b-4da8-9f68-ce9f5a472d87"],
    });

    expect(policy).toMatchObject({
      coverage: "all_targets",
      state: "enabled",
      conditions: { selectionMode: "selected" },
      targetIds: [],
    });
  });

  it("requires target ids for selected-target policies", () => {
    const targetId = "6da61847-8d5a-455d-bbb5-97ea23689312";
    const policy = createAlertPolicyRequestSchema.parse({
      name: "Production targets",
      coverage: "selected_targets",
      targetIds: [targetId],
      conditions: { selectionMode: "all", changeTypes: [] },
      channelIds: ["777be4a0-573b-4da8-9f68-ce9f5a472d87"],
    });

    expect(policy).toMatchObject({ coverage: "selected_targets", targetIds: [targetId] });
    expect(() => createAlertPolicyRequestSchema.parse({
      name: "Missing targets",
      coverage: "selected_targets",
      targetIds: [],
      conditions: { selectionMode: "all", changeTypes: [] },
      channelIds: ["777be4a0-573b-4da8-9f68-ce9f5a472d87"],
    })).toThrow("Select at least one target");
  });

  it("normalizes legacy severity policies to every change", () => {
    const policy = createAlertPolicyRequestSchema.parse({
      name: "Legacy policy",
      conditions: { minimumSeverity: "medium", changeTypes: [] },
      channelIds: ["777be4a0-573b-4da8-9f68-ce9f5a472d87"],
    });

    expect(policy.conditions).toEqual({ selectionMode: "all", changeTypes: [] });
  });

  it("rejects the removed recommended selection mode", () => {
    expect(() => createAlertPolicyRequestSchema.parse({
      name: "Removed mode",
      conditions: { selectionMode: "recommended", changeTypes: [] },
      channelIds: ["777be4a0-573b-4da8-9f68-ce9f5a472d87"],
    })).toThrow();
  });

  it("supports state-only and full policy updates", () => {
    expect(updateAlertPolicyRequestSchema.parse({ state: "paused" })).toEqual({ state: "paused" });
    expect(updateAlertPolicyRequestSchema.parse({
      name: "Updated production policy",
      state: "enabled",
      coverage: "all_targets",
      conditions: { selectionMode: "all", changeTypes: [] },
      cooldownSeconds: 300,
      channelIds: ["777be4a0-573b-4da8-9f68-ce9f5a472d87"],
      targetIds: [],
    })).toMatchObject({ name: "Updated production policy", cooldownSeconds: 300 });
  });
});
