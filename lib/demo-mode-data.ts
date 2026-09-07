import type { ApiKey } from "@/lib/contracts/api-keys";
import type {
  AlertChannel,
  AlertPolicy,
  AlertSetupReadiness,
  EmailProviderSettings,
} from "@/lib/contracts/alerts";
import type { AppUser } from "@/lib/contracts/users";

export const DEMO_MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";

export const DEMO_MOCK_USERS: AppUser[] = [
  {
    userId: DEMO_MOCK_USER_ID,
    email: "demo@stackray.local",
    displayName: "Demo Admin",
    role: "admin",
    isActive: true,
    requiresPasswordChange: false,
    hasPassword: true,
    lastLoginAt: "2026-07-05T14:12:00.000Z",
    apiKeyAccessEnabled: true,
  },
  {
    userId: "00000000-0000-4000-8000-000000000002",
    email: "analyst@stackray.local",
    displayName: "Security Analyst",
    role: "user",
    isActive: true,
    requiresPasswordChange: false,
    hasPassword: true,
    lastLoginAt: "2026-07-03T18:45:00.000Z",
    apiKeyAccessEnabled: true,
  },
];

export const DEMO_MOCK_API_KEYS: ApiKey[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    name: "OpenClaw key",
    keyHint: "sr_live_openclaw",
    createdAt: "2026-06-22T13:10:00.000Z",
    lastUsedAt: "2026-07-05T12:34:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    name: "Hermes key",
    keyHint: "sr_live_hermes",
    createdAt: "2026-06-14T09:20:00.000Z",
    lastUsedAt: "2026-07-04T21:08:00.000Z",
  },
];

export const DEMO_MOCK_ALERT_READINESS: AlertSetupReadiness = {
  inAppChanges: {
    status: "ready",
    detail: "Change history is available in this demo.",
    missingEnvironmentVariables: [],
  },
  email: {
    status: "ready",
    detail: "This demo shows an example Resend connection.",
    missingEnvironmentVariables: [],
  },
  webhooks: {
    status: "ready",
    detail: "Webhook delivery is available in your own deployment.",
    missingEnvironmentVariables: [],
  },
  deliveryWorker: {
    status: "ready",
    detail: "The alert delivery worker is ready.",
    missingEnvironmentVariables: [],
  },
};

export const DEMO_MOCK_EMAIL_PROVIDER: EmailProviderSettings = {
  provider: "resend",
  domainName: "example.com",
  senderName: "Stackray",
  senderLocalPart: "alerts",
  fromAddress: "alerts@example.com",
  testRecipient: "security@example.com",
  encrypted: true,
  oauthScope: "emails:send",
  lastTestStatus: "succeeded",
  lastTestedAt: "2026-08-24T14:12:00.000Z",
  lastTestErrorCategory: null,
  updatedAt: "2026-08-24T14:12:00.000Z",
};

export const DEMO_MOCK_ALERT_CHANNELS: AlertChannel[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    displayName: "Security team",
    channelType: "email",
    enabled: true,
    config: { recipients: ["security@example.com"] },
    lastTestStatus: "succeeded",
    lastTestedAt: "2026-08-24T14:12:00.000Z",
    lastTestErrorCategory: null,
    createdAt: "2026-08-12T09:30:00.000Z",
    updatedAt: "2026-08-24T14:12:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    displayName: "Website alerts",
    channelType: "slack",
    enabled: true,
    config: {
      workspaceId: "T-DEMO",
      workspaceName: "Stackray Demo",
      channelId: "C-DEMO",
      channelName: "website-alerts",
      connectionSource: "oauth",
      configurationUrl: "https://example.slack.com/services/B-DEMO",
    },
    lastTestStatus: "succeeded",
    lastTestedAt: "2026-08-23T18:40:00.000Z",
    lastTestErrorCategory: null,
    createdAt: "2026-08-14T11:05:00.000Z",
    updatedAt: "2026-08-23T18:40:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    displayName: "Incident automation",
    channelType: "webhook",
    enabled: false,
    config: {
      hostname: "hooks.example.com",
      hasAuthorizationHeader: true,
      hasSigningSecret: true,
    },
    lastTestStatus: "untested",
    lastTestedAt: null,
    lastTestErrorCategory: null,
    createdAt: "2026-08-18T16:20:00.000Z",
    updatedAt: "2026-08-18T16:20:00.000Z",
  },
];

export const DEMO_MOCK_ALERT_POLICIES: AlertPolicy[] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    name: "Availability and TLS",
    state: "enabled",
    coverage: "all_targets",
    conditions: {
      selectionMode: "selected",
      changeTypes: ["status.changed", "redirect.changed", "tls.certificate_changed"],
    },
    cooldownSeconds: 1_800,
    channelIds: [
      "00000000-0000-4000-8000-000000000201",
      "00000000-0000-4000-8000-000000000202",
    ],
    targetIds: [],
    createdAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-08-24T13:45:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    name: "Production site changes",
    state: "paused",
    coverage: "selected_targets",
    conditions: { selectionMode: "all", changeTypes: [] },
    cooldownSeconds: 3_600,
    channelIds: ["00000000-0000-4000-8000-000000000202"],
    targetIds: [
      "00000000-0000-4000-8000-000000000401",
      "00000000-0000-4000-8000-000000000402",
    ],
    createdAt: "2026-08-17T15:30:00.000Z",
    updatedAt: "2026-08-22T19:15:00.000Z",
  },
];
