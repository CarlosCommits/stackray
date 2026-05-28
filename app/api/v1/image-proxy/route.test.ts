import { lookup } from "node:dns/promises";

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const dnsMocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: dnsMocks.lookup,
  },
  lookup: dnsMocks.lookup,
}));

vi.mock("@/lib/session/actor-auth", () => ({
  actorAuthErrorResponse: vi.fn(() => null),
  requireSessionOrBearerActor: vi.fn(async () => ({
    type: "session",
    userId: "usr_test",
    organizationId: "org_test",
  })),
}));

const lookupMock = vi.mocked(lookup);
const fetchMock = vi.fn<typeof fetch>();

function requestForUrl(url: string) {
  return new NextRequest(`http://stackray.test/api/v1/image-proxy?${new URLSearchParams({ url }).toString()}`);
}

describe("image proxy route", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("rejects arbitrary proxy hosts before fetching them", async () => {
    const response = await GET(requestForUrl("https://attacker.example/image.png"));

    expect(response.status).toBe(403);
    expect(lookupMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps proxied SVG responses sandboxed under the app origin", async () => {
    fetchMock.mockResolvedValue(new Response("<svg><script>alert(1)</script></svg>", {
      headers: {
        "content-type": "image/svg+xml",
      },
      status: 200,
    }));

    const response = await GET(requestForUrl(
      "https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/images/icons/React.svg",
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("revalidates redirected image locations against the proxy allowlist", async () => {
    fetchMock.mockResolvedValue(new Response(null, {
      headers: {
        location: "http://127.0.0.1/private.png",
      },
      status: 302,
    }));

    const response = await GET(requestForUrl("https://www.google.com/s2/favicons?domain=example.com&sz=128"));

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows Google favicon redirects to gstatic favicon assets", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, {
        headers: {
          location: "https://t1.gstatic.com/faviconV2?url=https://example.com&size=128",
        },
        status: 302,
      }))
      .mockResolvedValueOnce(new Response("icon", {
        headers: {
          "content-type": "image/png",
        },
        status: 200,
      }));

    const response = await GET(requestForUrl("https://www.google.com/s2/favicons?domain=example.com&sz=128"));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
