// @vitest-environment node

import { describe, expect, it } from "vitest";

import { NUCLEI_TEMPLATE_ALLOWLIST, buildNucleiArguments, parseNucleiJsonLine } from "@/worker/nuclei";

describe("buildNucleiArguments", () => {
  it("bundles the 7-template allowlist with txt-service tag filtering", () => {
    const args = buildNucleiArguments({
      targetUrl: "https://example.com/login",
      headers: ["User-Agent: Test Browser", "Accept: text/html"],
    });

    expect(args[args.indexOf("-u") + 1]).toBe("https://example.com/login");
    expect(args).toContain("-jsonl");
    expect(args).toContain("-silent");
    expect(args).toContain("-nc");
    expect(args).toContain("-or");
    expect(args).toContain("-ot");
    expect(args[args.indexOf("-id") + 1]).toBe(NUCLEI_TEMPLATE_ALLOWLIST.join(","));
    expect(args[args.indexOf("-itags") + 1]).toBe("txt-service");
    expect(args.filter((value) => value === "-H")).toHaveLength(2);
  });

  it("uses explicit template paths when a templates directory is configured", () => {
    const args = buildNucleiArguments({
      targetUrl: "https://example.com/login",
      headers: [],
      templatesDir: "/opt/nuclei-templates",
    });

    expect(args).not.toContain("-id");
    expect(args.filter((value) => value === "-t")).toHaveLength(7);
    expect(args).toContain("/opt/nuclei-templates/ssl/detect-ssl-issuer.yaml");
  });
});

describe("parseNucleiJsonLine", () => {
  it("maps technology templates into technology findings without inventing versions", () => {
    const match = parseNucleiJsonLine({
      "template-id": "tech-detect",
      "template-path": "http/technologies/tech-detect.yaml",
      "matcher-name": "Next.js",
      type: "http",
      severity: "info",
      "matched-at": "https://example.com/",
      host: "https://example.com",
      ip: "203.0.113.10",
      url: "https://example.com",
      scheme: "https",
      port: 443,
      path: "/",
      "extracted-results": ["nextjs"],
    });

    expect(match).toEqual({
      templateId: "tech-detect",
      templatePath: "http/technologies/tech-detect.yaml",
      matcherName: "Next.js",
      protocolType: "http",
      severity: "info",
      matchedAt: "https://example.com/",
      host: "https://example.com",
      ip: "203.0.113.10",
      port: "443",
      scheme: "https",
      url: "https://example.com",
      path: "/",
      extractedResults: ["nextjs"],
      technologyName: "Next.js",
      technologyVersion: null,
      findingKind: "technology",
      rawJson: {
        "template-id": "tech-detect",
        "template-path": "http/technologies/tech-detect.yaml",
        "matcher-name": "Next.js",
        type: "http",
        severity: "info",
        "matched-at": "https://example.com/",
        host: "https://example.com",
        ip: "203.0.113.10",
        url: "https://example.com",
        scheme: "https",
        port: 443,
        path: "/",
        "extracted-results": ["nextjs"],
      },
    });
  });

  it("keeps non-technology templates as namespaced findings", () => {
    const match = parseNucleiJsonLine({
      "template-id": "ssl-issuer",
      template: "ssl/detect-ssl-issuer.yaml",
      "matcher-name": "Let's Encrypt",
      type: "ssl",
      severity: "info",
      "matched-at": "example.com:443",
      host: "example.com",
      ip: "203.0.113.10",
      url: "https://example.com",
      scheme: "https",
      port: "443",
      path: "/",
      "extracted-results": ["C=US, O=Let's Encrypt, CN=R3"],
    });

    expect(match).toEqual({
      templateId: "ssl-issuer",
      templatePath: "ssl/detect-ssl-issuer.yaml",
      matcherName: "Let's Encrypt",
      protocolType: "ssl",
      severity: "info",
      matchedAt: "example.com:443",
      host: "example.com",
      ip: "203.0.113.10",
      port: "443",
      scheme: "https",
      url: "https://example.com",
      path: "/",
      extractedResults: ["C=US, O=Let's Encrypt, CN=R3"],
      technologyName: null,
      technologyVersion: null,
      findingKind: "ssl_issuer",
      rawJson: {
        "template-id": "ssl-issuer",
        template: "ssl/detect-ssl-issuer.yaml",
        "matcher-name": "Let's Encrypt",
        type: "ssl",
        severity: "info",
        "matched-at": "example.com:443",
        host: "example.com",
        ip: "203.0.113.10",
        url: "https://example.com",
        scheme: "https",
        port: "443",
        path: "/",
        "extracted-results": ["C=US, O=Let's Encrypt, CN=R3"],
      },
    });
  });
});
