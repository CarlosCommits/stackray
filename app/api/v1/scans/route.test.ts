import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  actorAuthErrorResponse: vi.fn(() => null),
  consumeDemoScanQuota: vi.fn(),
  createScan: vi.fn(),
  getDemoRateLimitHeaders: vi.fn(() => ({})),
  isDemoModeEnabled: vi.fn(),
  refundDemoScanQuota: vi.fn(),
  requireSessionOrBearerActor: vi.fn(),
}));

vi.mock("@/lib/session/actor-auth", () => ({
  actorAuthErrorResponse: mocks.actorAuthErrorResponse,
  requireSessionOrBearerActor: mocks.requireSessionOrBearerActor,
}));

vi.mock("@/lib/demo-mode", () => ({
  isDemoModeEnabled: mocks.isDemoModeEnabled,
}));

vi.mock("@/lib/server/demo-scan-rate-limit", () => ({
  consumeDemoScanQuota: mocks.consumeDemoScanQuota,
  getDemoRateLimitHeaders: mocks.getDemoRateLimitHeaders,
  refundDemoScanQuota: mocks.refundDemoScanQuota,
}));

vi.mock("@/lib/server/scans/create-service", () => ({
  createScan: mocks.createScan,
}));

function scanRequest() {
  return new Request("https://stackray.test/api/v1/scans", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "203.0.113.10",
    },
    body: JSON.stringify({
      target: "https://example.com",
      options: {
        followRedirects: true,
        includeRawResponse: false,
        headless: false,
      },
    }),
  });
}

describe("POST /api/v1/scans", () => {
  beforeEach(() => {
    mocks.actorAuthErrorResponse.mockReturnValue(null);
    mocks.consumeDemoScanQuota.mockReset();
    mocks.createScan.mockReset();
    mocks.getDemoRateLimitHeaders.mockReturnValue({});
    mocks.isDemoModeEnabled.mockReturnValue(false);
    mocks.refundDemoScanQuota.mockReset();
    mocks.refundDemoScanQuota.mockResolvedValue(undefined);
    mocks.requireSessionOrBearerActor.mockResolvedValue({
      user: { id: "user_01", role: "user" },
      source: "ui",
      apiKey: null,
    });
  });

  it("refunds demo quota when scan creation reuses an existing scan", async () => {
    const reservation = {
      visitorKeyHash: "visitor_hash",
      day: "2026-06-22",
    };

    mocks.isDemoModeEnabled.mockReturnValue(true);
    mocks.consumeDemoScanQuota.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: new Date("2026-06-23T00:00:00.000Z"),
      reservation,
    });
    mocks.createScan.mockResolvedValue({
      scanId: "scan_existing",
      status: "queued",
      reused: true,
    });

    const response = await POST(scanRequest());

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      scanId: "scan_existing",
      status: "queued",
      reused: true,
    });
    expect(mocks.refundDemoScanQuota).toHaveBeenCalledWith(reservation);
  });
});
