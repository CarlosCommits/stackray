import { describe, expect, it, vi } from "vitest";

import AlertsPage from "@/app/(authenticated)/settings/alerts/page";
import {
  DEMO_MOCK_ALERT_CHANNELS,
  DEMO_MOCK_ALERT_POLICIES,
  DEMO_MOCK_ALERT_READINESS,
  DEMO_MOCK_EMAIL_PROVIDER,
} from "@/lib/demo-mode-data";

const mocks = vi.hoisted(() => ({
  getAlertSettingsSnapshot: vi.fn(),
  getPublicOrigin: vi.fn(),
  getTargetResults: vi.fn(),
  registerInstancePublicOrigin: vi.fn(),
  requireAppSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/authorization/authz", () => ({ canManageAlerts: vi.fn(() => true) }));
vi.mock("@/lib/demo-mode", () => ({
  DEMO_USER_EMAIL: "demo@stackray.local",
  isDemoModeEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/public-origin", () => ({ getPublicOrigin: mocks.getPublicOrigin }));
vi.mock("@/lib/server/alerts/service", () => ({
  getAlertSettingsSnapshot: mocks.getAlertSettingsSnapshot,
}));
vi.mock("@/lib/server/instance-runtime-settings", () => ({
  registerInstancePublicOrigin: mocks.registerInstancePublicOrigin,
}));
vi.mock("@/lib/server/targets/service", () => ({ getTargetResults: mocks.getTargetResults }));
vi.mock("@/lib/session/actor-context", () => ({ isDevelopmentActorEnabled: vi.fn(() => false) }));
vi.mock("@/lib/session/app-session", () => ({ requireAppSession: mocks.requireAppSession }));

describe("AlertsPage demo mode", () => {
  it("renders mock alert settings without reading deployment data", async () => {
    const element = await AlertsPage({ searchParams: Promise.resolve({}) });

    expect(element.props).toMatchObject({
      demoMode: true,
      adminEmail: "demo@stackray.local",
      initialReadiness: DEMO_MOCK_ALERT_READINESS,
      initialEmailProvider: DEMO_MOCK_EMAIL_PROVIDER,
      initialChannels: DEMO_MOCK_ALERT_CHANNELS,
      initialPolicies: DEMO_MOCK_ALERT_POLICIES,
      initialTargetOptions: [],
    });
    expect(mocks.requireAppSession).not.toHaveBeenCalled();
    expect(mocks.getAlertSettingsSnapshot).not.toHaveBeenCalled();
    expect(mocks.getTargetResults).not.toHaveBeenCalled();
    expect(mocks.getPublicOrigin).not.toHaveBeenCalled();
    expect(mocks.registerInstancePublicOrigin).not.toHaveBeenCalled();
  });
});
