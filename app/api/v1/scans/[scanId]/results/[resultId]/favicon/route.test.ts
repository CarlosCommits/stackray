import { lookup } from "node:dns/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  actorAuthErrorResponse: vi.fn(() => null),
  fetch: vi.fn<typeof fetch>(),
  getScanRecord: vi.fn(),
  lookup: vi.fn(),
  select: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: mocks.lookup,
  },
  lookup: mocks.lookup,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("@/lib/session/actor-auth", () => ({
  actorAuthErrorResponse: mocks.actorAuthErrorResponse,
  requireSessionOrBearerActor: vi.fn(async () => ({
    type: "session",
    userId: "usr_test",
    organizationId: "org_test",
  })),
}));

vi.mock("@/lib/server/scans/read-service", () => ({
  getScanRecord: mocks.getScanRecord,
}));

const lookupMock = vi.mocked(lookup);

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);

function mockResultRow(row: {
  faviconUrl: string | null;
  faviconPath: string | null;
  finalUrl: string | null;
  url: string | null;
  rawJson?: Record<string, unknown>;
} | null) {
  mocks.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn(async () => (row ? [{ rawJson: {}, ...row }] : [])),
      }),
    }),
  });
}

function request() {
  return new Request("http://stackray.test/api/v1/scans/scan_01/results/res_01/favicon");
}

function context() {
  return {
    params: Promise.resolve({ scanId: "scan_01", resultId: "res_01" }),
  };
}

describe("scan result favicon route", () => {
  beforeEach(() => {
    mocks.actorAuthErrorResponse.mockReturnValue(null);
    mocks.fetch.mockReset();
    mocks.getScanRecord.mockReset();
    mocks.getScanRecord.mockResolvedValue({ id: "scan_01" });
    mocks.lookup.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    mocks.select.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("proxies a stored remote favicon from the Stackray origin", async () => {
    mockResultRow({
      faviconUrl: "https://www.fifa.com/apple-touch-icon.png?v=a087933e3cf148cb71a96095c8aa2dac",
      faviconPath: "/apple-touch-icon.png?v=a087933e3cf148cb71a96095c8aa2dac",
      finalUrl: "https://www.fifa.com/",
      url: "https://fifa.com",
    });
    mocks.fetch.mockResolvedValue(new Response(pngBytes, {
      headers: {
        "content-type": "image/png",
        "cross-origin-resource-policy": "same-origin",
      },
      status: 200,
    }));

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(String(mocks.fetch.mock.calls[0]?.[0])).toBe("https://www.fifa.com/apple-touch-icon.png?v=a087933e3cf148cb71a96095c8aa2dac");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes);
  });

  it("resolves stored relative favicon paths against the result final URL", async () => {
    mockResultRow({
      faviconUrl: null,
      faviconPath: "/apple-touch-icon.png?v=1",
      finalUrl: "https://www.fifa.com/",
      url: "https://fifa.com",
    });
    mocks.fetch.mockResolvedValue(new Response(pngBytes, {
      headers: { "content-type": "image/png" },
      status: 200,
    }));

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(String(mocks.fetch.mock.calls[0]?.[0])).toBe("https://www.fifa.com/apple-touch-icon.png?v=1");
  });

  it("falls back to Google favicon lookup when the stored favicon is blocked", async () => {
    mockResultRow({
      faviconUrl: "https://t3.chat/favicon.ico",
      faviconPath: "/favicon.ico",
      finalUrl: "https://t3.chat/",
      url: "https://t3.chat",
    });
    mocks.fetch
      .mockResolvedValueOnce(new Response("<html>blocked</html>", {
        headers: { "content-type": "text/html" },
        status: 429,
      }))
      .mockResolvedValueOnce(new Response(pngBytes, {
        headers: { "content-type": "image/png" },
        status: 200,
      }));

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(String(mocks.fetch.mock.calls[0]?.[0])).toBe("https://t3.chat/favicon.ico");
    expect(String(mocks.fetch.mock.calls[1]?.[0])).toBe("https://www.google.com/s2/favicons?domain=t3.chat&sz=128");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes);
  });

  it("revalidates favicon redirects before following them", async () => {
    mockResultRow({
      faviconUrl: "https://www.fifa.com/apple-touch-icon.png",
      faviconPath: null,
      finalUrl: "https://www.fifa.com/",
      url: "https://fifa.com",
    });
    mocks.fetch.mockResolvedValue(new Response(null, {
      headers: {
        location: "http://127.0.0.1/favicon.ico",
      },
      status: 302,
    }));

    const response = await GET(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns not found when a result has no favicon source", async () => {
    mockResultRow({
      faviconUrl: null,
      faviconPath: null,
      finalUrl: "https://www.fifa.com/",
      url: "https://fifa.com",
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
