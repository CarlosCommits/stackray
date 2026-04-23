import { describe, expect, it } from "vitest";

import type { ScanResultItem } from "@/lib/contracts/scans";
import {
  rankAuthoritativeScanResults,
  selectAuthoritativeScanResult,
  selectPrimaryScanResult,
} from "@/lib/server/scans/result-selection";

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

  it("prefers the strongest successful target match over a blocked sibling row", () => {
    const siblingRedirectRow = createResult({
      resultId: "res_sibling_redirect",
      input: "https://www.stripe.com",
      url: "https://www.stripe.com",
      finalUrl: "https://stripe.com",
      statusCode: 403,
    });
    const requestedTargetRow = createResult({
      resultId: "res_requested_target",
      input: "https://stripe.com",
      url: "https://stripe.com",
      finalUrl: "https://stripe.com",
      statusCode: 200,
    });

    expect(selectAuthoritativeScanResult([siblingRedirectRow, requestedTargetRow], "https://stripe.com")).toEqual(
      requestedTargetRow,
    );
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

  it("matches scheme-less stored primary targets against schemeful result urls", () => {
    const rootRow = createResult({
      resultId: "res_root_schemeful",
      target: "https://theesa.com/about",
      input: "https://theesa.com/about",
      url: "https://theesa.com/about",
      finalUrl: "https://theesa.com/about",
    });

    expect(selectPrimaryScanResult([rootRow], "theesa.com/about")).toEqual(rootRow);
  });

  it("prefers a successful row over a newer blocked row for the same target", () => {
    const older = {
      id: "res_older",
      input: "https://example.com",
      url: "https://example.com",
      finalUrl: "https://example.com",
      target: "https://example.com",
      statusCode: 200,
      observedAt: new Date("2026-03-27T00:00:00.000Z"),
    };
    const newer = {
      id: "res_newer",
      input: "https://example.com",
      url: "https://example.com",
      finalUrl: "https://example.com",
      target: "https://example.com",
      statusCode: 403,
      observedAt: new Date("2026-03-27T00:00:01.000Z"),
    };

    const ranked = rankAuthoritativeScanResults([older, newer], "example.com");

    expect(ranked.map((candidate) => candidate.resultId)).toEqual(["res_older", "res_newer"]);
    expect(selectAuthoritativeScanResult([older, newer], "example.com")).toEqual(older);
    expect(selectAuthoritativeScanResult([newer, older], "example.com")).toEqual(older);
  });

  it("breaks ties by recency after target-match and status quality are equal", () => {
    const older = {
      id: "res_older",
      input: "https://example.com",
      url: "https://example.com",
      finalUrl: "https://example.com",
      target: "https://example.com",
      statusCode: 200,
      observedAt: new Date("2026-03-27T00:00:00.000Z"),
    };
    const newer = {
      id: "res_newer",
      input: "https://example.com",
      url: "https://example.com",
      finalUrl: "https://example.com",
      target: "https://example.com",
      statusCode: 200,
      observedAt: new Date("2026-03-27T00:00:01.000Z"),
    };

    const ranked = rankAuthoritativeScanResults([older, newer], "example.com");

    expect(ranked.map((candidate) => candidate.resultId)).toEqual(["res_newer", "res_older"]);
    expect(selectAuthoritativeScanResult([older, newer], "example.com")).toEqual(newer);
    expect(selectAuthoritativeScanResult([newer, older], "example.com")).toEqual(newer);
  });
});
