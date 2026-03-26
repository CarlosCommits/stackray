import { describe, expect, it } from "vitest";

import { normalizeRedirectChainItems } from "@/lib/server/scans/redirect-chain";

describe("normalizeRedirectChainItems", () => {
  it("normalizes raw httpx redirect hops into the UI shape", () => {
    expect(
      normalizeRedirectChainItems(
        [
          {
            "request-url": "https://www.vercel.com",
            status_code: 308,
            location: "https://vercel.com/",
            content_length: 0,
            response_time: "6ms",
          },
          {
            "request-url": "https://vercel.com/",
            status_code: 200,
            response_time: "563ms",
          },
        ],
        [308, 200],
      ),
    ).toEqual([
      {
        url: "https://www.vercel.com",
        statusCode: 308,
        location: "https://vercel.com/",
        contentLength: 0,
        responseTimeMs: 6,
      },
      {
        url: "https://vercel.com/",
        statusCode: 200,
        location: null,
        contentLength: undefined,
        responseTimeMs: 563,
      },
    ]);
  });

  it("preserves already-normalized redirect hops", () => {
    expect(
      normalizeRedirectChainItems(
        [
          {
            url: "https://tpss.coop",
            statusCode: 301,
            location: "https://www.tpss.coop/",
            contentLength: 0,
            responseTimeMs: 45,
          },
        ],
        [301],
      ),
    ).toEqual([
      {
        url: "https://tpss.coop",
        statusCode: 301,
        location: "https://www.tpss.coop/",
        contentLength: 0,
        responseTimeMs: 45,
      },
    ]);
  });
});
