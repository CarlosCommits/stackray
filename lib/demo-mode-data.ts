import type { ApiKey } from "@/lib/contracts/api-keys";
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
