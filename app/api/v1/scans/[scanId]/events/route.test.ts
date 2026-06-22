import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  actorAuthErrorResponse: vi.fn(() => null),
  getLatestScanEventId: vi.fn(),
  listScanEvents: vi.fn(),
  requireSessionOrBearerActor: vi.fn(),
}));

vi.mock("@/lib/session/actor-auth", () => ({
  actorAuthErrorResponse: mocks.actorAuthErrorResponse,
  requireSessionOrBearerActor: mocks.requireSessionOrBearerActor,
}));

vi.mock("@/lib/server/scans/events-service", () => ({
  getLatestScanEventId: mocks.getLatestScanEventId,
  listScanEvents: mocks.listScanEvents,
}));

function request(url: string, headers?: HeadersInit) {
  return new Request(url, { headers });
}

async function readStream(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let output = "";

  if (!reader) {
    return output;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    output += decoder.decode(value, { stream: true });
  }

  return output;
}

describe("GET /api/v1/scans/[scanId]/events", () => {
  beforeEach(() => {
    mocks.actorAuthErrorResponse.mockReturnValue(null);
    mocks.getLatestScanEventId.mockResolvedValue(7);
    mocks.listScanEvents.mockReset();
    mocks.requireSessionOrBearerActor.mockResolvedValue({ user: { id: "user_01", role: "user" } });
  });

  it("streams after the requested event cursor", async () => {
    mocks.listScanEvents.mockResolvedValueOnce([
      {
        id: 11,
        envelope: { event: "scan.complete", data: { scanId: "scan_01", status: "completed", resultCount: 1, at: "2026-06-22T18:00:00.000Z" } },
        terminal: true,
      },
    ]);

    const response = await GET(
      request("https://stackray.test/api/v1/scans/scan_01/events?after=10"),
      { params: Promise.resolve({ scanId: "scan_01" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.listScanEvents).toHaveBeenCalledWith(expect.anything(), "scan_01", 10);
    expect(await readStream(response)).toContain("event: scan.complete");
  });

  it("prefers Last-Event-ID over the query cursor", async () => {
    mocks.listScanEvents.mockResolvedValueOnce([
      {
        id: 12,
        envelope: { event: "scan.cancelled", data: { scanId: "scan_01", status: "cancelled", at: "2026-06-22T18:00:00.000Z" } },
        terminal: true,
      },
    ]);

    const response = await GET(
      request("https://stackray.test/api/v1/scans/scan_01/events?after=10", { "last-event-id": "11" }),
      { params: Promise.resolve({ scanId: "scan_01" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.listScanEvents).toHaveBeenCalledWith(expect.anything(), "scan_01", 11);
  });

  it("returns not found for inaccessible scans", async () => {
    mocks.getLatestScanEventId.mockResolvedValueOnce(null);

    const response = await GET(
      request("https://stackray.test/api/v1/scans/missing/events"),
      { params: Promise.resolve({ scanId: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.listScanEvents).not.toHaveBeenCalled();
  });
});
