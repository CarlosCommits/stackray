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
    target: "https://payments.example.test",
    input: "https://payments.example.test",
    url: "https://payments.example.test",
    finalUrl: "https://payments.example.test",
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
      target: "https://payments.example.test",
      input: "https://js.payments.example.test",
      url: "https://js.payments.example.test",
      finalUrl: "https://js.payments.example.test",
      statusCode: 403,
    });
    const rootRow = createResult({
      resultId: "res_root",
      target: "https://payments.example.test",
      input: "https://payments.example.test",
      url: "https://payments.example.test",
      finalUrl: "https://payments.example.test",
      statusCode: 200,
    });

    expect(selectPrimaryScanResult([subdomainRow, rootRow], "https://payments.example.test")).toEqual(rootRow);
  });

  it("prefers the strongest successful target match over a blocked sibling row", () => {
    const siblingRedirectRow = createResult({
      resultId: "res_sibling_redirect",
      input: "https://www.payments.example.test",
      url: "https://www.payments.example.test",
      finalUrl: "https://payments.example.test",
      statusCode: 403,
    });
    const requestedTargetRow = createResult({
      resultId: "res_requested_target",
      input: "https://payments.example.test",
      url: "https://payments.example.test",
      finalUrl: "https://payments.example.test",
      statusCode: 200,
    });

    expect(selectAuthoritativeScanResult([siblingRedirectRow, requestedTargetRow], "https://payments.example.test")).toEqual(
      requestedTargetRow,
    );
  });

  it("falls back to the first row when nothing matches the primary target", () => {
    const firstRow = createResult({
      resultId: "res_first",
      target: "https://assets.payments.example.test",
      input: "https://assets.payments.example.test",
      url: "https://assets.payments.example.test",
      finalUrl: "https://assets.payments.example.test",
      statusCode: 404,
    });

    expect(selectPrimaryScanResult([firstRow], "https://payments.example.test")).toEqual(firstRow);
  });

  it("matches scheme-less stored primary targets against schemeful result urls", () => {
    const rootRow = createResult({
      resultId: "res_root_schemeful",
      target: "https://path-target.example.test/about",
      input: "https://path-target.example.test/about",
      url: "https://path-target.example.test/about",
      finalUrl: "https://path-target.example.test/about",
    });

    expect(selectPrimaryScanResult([rootRow], "path-target.example.test/about")).toEqual(rootRow);
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
