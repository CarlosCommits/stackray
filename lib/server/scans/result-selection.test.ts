import { describe, expect, it } from "vitest";

import type { ScanResultItem } from "@/lib/contracts/scans";
import { selectPrimaryScanResult } from "@/lib/server/scans/result-selection";

function createResult(overrides: Partial<ScanResultItem>): ScanResultItem {
  return {
    resultId: "res_default",
    target: "https://stripe.com",
    input: "https://stripe.com",
    url: "https://stripe.com",
    finalUrl: "https://stripe.com",
    path: "/",
    method: "GET",
    title: "Stripe",
    statusCode: 200,
    server: "nginx",
    location: null,
    contentType: "text/html",
    contentLength: 1,
    responseTimeMs: 1,
    cdn: { enabled: false, name: null, type: null },
    dns: { hostIp: null, a: [], aaaa: [], cname: [], resolvers: [] },
    asn: { asNumber: null, org: null, country: null },
    tls: { sni: null, jarmHash: null, certificate: {} },
    technologies: [],
    technologyDetections: [],
    wordpress: { plugins: [], themes: [] },
    cpe: [],
    favicon: { mmh3: null, md5: null, url: null, path: null },
    screenshot: { available: false, path: null, contentType: null, byteSize: null, capturedAt: null },
    hashes: {},
    capabilities: { http2: false, pipeline: false, websocket: false, vhost: false },
    redirectChain: { statusCodes: [], items: [] },
    bodyPreview: "",
    bodyDomains: [],
    bodyFqdns: [],
    rawHttpx: {},
    nuclei: { state: "not_run", run: null, technologies: [], findings: [] },
    ...overrides,
  };
}

describe("selectPrimaryScanResult", () => {
  it("prefers the row whose normalized urls match the primary target", () => {
    const subdomainRow = createResult({
      resultId: "res_subdomain",
      target: "https://stripe.com",
      input: "https://js.stripe.com",
      url: "https://js.stripe.com",
      finalUrl: "https://js.stripe.com",
      statusCode: 403,
    });
    const rootRow = createResult({
      resultId: "res_root",
      target: "https://stripe.com",
      input: "https://stripe.com",
      url: "https://stripe.com",
      finalUrl: "https://stripe.com",
      statusCode: 200,
    });

    expect(selectPrimaryScanResult([subdomainRow, rootRow], "https://stripe.com")).toEqual(rootRow);
  });

  it("falls back to the first row when nothing matches the primary target", () => {
    const firstRow = createResult({
      resultId: "res_first",
      target: "https://assets.stripe.com",
      input: "https://assets.stripe.com",
      url: "https://assets.stripe.com",
      finalUrl: "https://assets.stripe.com",
      statusCode: 404,
    });

    expect(selectPrimaryScanResult([firstRow], "https://stripe.com")).toEqual(firstRow);
  });
});
