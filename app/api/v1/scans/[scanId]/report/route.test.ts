import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  actorAuthErrorResponse: vi.fn(() => null),
  getScanReport: vi.fn(),
  requireSessionOrBearerActor: vi.fn(),
}));

vi.mock("@/lib/session/actor-auth", () => ({
  actorAuthErrorResponse: mocks.actorAuthErrorResponse,
  requireSessionOrBearerActor: mocks.requireSessionOrBearerActor,
}));

vi.mock("@/lib/server/scans/read-service", () => ({
  getScanReport: mocks.getScanReport,
}));

function request() {
  return new Request("https://stackray.test/api/v1/scans/scan_01/report", {
    headers: {
      authorization: "Bearer sr_live_valid",
    },
  });
}

describe("GET /api/v1/scans/[scanId]/report", () => {
  beforeEach(() => {
    mocks.actorAuthErrorResponse.mockReturnValue(null);
    mocks.getScanReport.mockReset();
    mocks.requireSessionOrBearerActor.mockResolvedValue({
      user: { id: "user_01", role: "user" },
      source: "api",
      apiKey: { id: "key_01", name: "Agent" },
    });
  });

  it("returns the bounded scan report for visible scans", async () => {
    mocks.getScanReport.mockResolvedValue({
      scan: {
        scanId: "scan_01",
        status: "completed",
        source: "api",
        target: {
          inputTarget: "example.com",
          normalizedTarget: "example.com",
          canonicalTargetId: "target_01",
        },
        currentAttempt: {},
        attemptHistory: [],
        phases: [],
        progress: { resultCount: 1, subdomainCount: 500 },
        subdomains: { state: "completed", resultCount: 500 },
        submittedAt: "2026-06-27T12:00:00.000Z",
        completedAt: "2026-06-27T12:01:00.000Z",
      },
      authoritativeResult: null,
      technologies: { scope: "authoritative", items: [], total: 0 },
      infrastructure: {
        dns: null,
        asn: null,
        tls: null,
        capabilities: null,
        ipIntelligence: null,
      },
      subdomains: {
        summary: { state: "completed", resultCount: 500 },
        sample: [],
        total: 500,
        truncated: true,
        next: "/api/v1/scans/scan_01/subdomains?page=2&pageSize=50",
      },
      links: {
        scan: "/api/v1/scans/scan_01",
        results: "/api/v1/scans/scan_01/results",
        technologies: "/api/v1/scans/scan_01/technologies?scope=authoritative",
        subdomains: "/api/v1/scans/scan_01/subdomains",
        events: "/api/v1/scans/scan_01/events",
      },
    });

    const response = await GET(request(), { params: Promise.resolve({ scanId: "scan_01" }) });

    expect(response.status).toBe(200);
    expect(mocks.requireSessionOrBearerActor).toHaveBeenCalledWith(expect.any(Request));
    expect(mocks.getScanReport).toHaveBeenCalledWith(expect.anything(), "scan_01");
    await expect(response.json()).resolves.toMatchObject({
      scan: { scanId: "scan_01" },
      technologies: { scope: "authoritative" },
      subdomains: { truncated: true },
    });
  });

  it("returns not found when the scan is not visible", async () => {
    mocks.getScanReport.mockResolvedValue(null);

    const response = await GET(request(), { params: Promise.resolve({ scanId: "missing" }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "scan_not_found",
      },
    });
  });
});
