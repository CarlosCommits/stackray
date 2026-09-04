import { describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/v1/settings/alerts/channels/route";
import { DEMO_MOCK_ALERT_CHANNELS } from "@/lib/demo-mode-data";

const mocks = vi.hoisted(() => ({
  createAlertChannel: vi.fn(),
  listAlertChannels: vi.fn(),
  requireAppSession: vi.fn(async () => ({ user: { id: "demo-user" } })),
}));

vi.mock("@/lib/demo-mode", () => ({
  DEMO_DEPLOYMENT_REQUIRED_MESSAGE: "This feature is available in your own Stackray deployment.",
  isDemoModeEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/session/app-session", () => ({ requireAppSession: mocks.requireAppSession }));
vi.mock("@/lib/server/alerts/service", () => ({
  createAlertChannel: mocks.createAlertChannel,
  listAlertChannels: mocks.listAlertChannels,
}));

describe("alert channels in demo mode", () => {
  it("returns representative mock channels", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: DEMO_MOCK_ALERT_CHANNELS });
    expect(mocks.listAlertChannels).not.toHaveBeenCalled();
  });

  it("rejects channel creation before parsing or writing data", async () => {
    const response = await POST(new Request("http://localhost/api/v1/settings/alerts/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "demo_feature_disabled" },
    });
    expect(mocks.createAlertChannel).not.toHaveBeenCalled();
  });
});
