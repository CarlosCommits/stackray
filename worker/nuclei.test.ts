// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  NUCLEI_DOMAIN_TEMPLATE_IDS,
  NUCLEI_RDAP_TEMPLATE_IDS,
  NUCLEI_TEMPLATE_ALLOWLIST,
  NUCLEI_TXT_SERVICE_TEMPLATE_IDS,
  NUCLEI_URL_TEMPLATE_IDS,
  buildNucleiArguments,
  parseNucleiJsonLine,
  withNucleiMatchExecutionContext,
} from "@/worker/nuclei";

describe("buildNucleiArguments", () => {
  it("bundles the 10-template allowlist without txt-service include tags by default", () => {
    const args = buildNucleiArguments({
      target: "https://example.com/login",
      templateIds: NUCLEI_TEMPLATE_ALLOWLIST,
      headers: ["User-Agent: Test Browser", "Accept: text/html"],
    });

    expect(args[args.indexOf("-u") + 1]).toBe("https://example.com/login");
    expect(args).toContain("-jsonl");
    expect(args).toContain("-silent");
    expect(args).toContain("-nc");
    expect(args).toContain("-or");
    expect(args).toContain("-ot");
    expect(args[args.indexOf("-id") + 1]).toBe(
      NUCLEI_TEMPLATE_ALLOWLIST.filter((templateId) => templateId !== "rdap-whois-custom").join(","),
    );
    expect(
      args.some((value) => value.endsWith("/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml")),
    ).toBe(true);
    expect(args).not.toContain("-itags");
    expect(args.filter((value) => value === "-H")).toHaveLength(2);
  });

  it("uses explicit template paths when a templates directory is configured", () => {
    const args = buildNucleiArguments({
      target: "https://example.com/login",
      templateIds: NUCLEI_TEMPLATE_ALLOWLIST,
      headers: [],
      templatesDir: "/opt/nuclei-templates",
    });

    expect(args).not.toContain("-id");
    expect(args.filter((value) => value === "-t")).toHaveLength(10);
    expect(args).toContain("/opt/nuclei-templates/ssl/detect-ssl-issuer.yaml");
    expect(args).toContain("/opt/nuclei-templates/dns/txt-fingerprint.yaml");
    expect(args).not.toContain("/opt/nuclei-templates/dns/nameserver-fingerprint.yaml");
    expect(args).toContain("/home/carlos/projects/stackray/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml");
    expect(args).toContain("/opt/nuclei-templates/http/miscellaneous/robots-txt.yaml");
  });

  it("supports running a domain-only subset against a non-url target", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: NUCLEI_DOMAIN_TEMPLATE_IDS,
      headers: [],
    });

    expect(args[args.indexOf("-u") + 1]).toBe("example.com");
    expect(args[args.indexOf("-id") + 1]).toBe(NUCLEI_DOMAIN_TEMPLATE_IDS.join(","));
    expect(
      args.some((value) => value.endsWith("/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml")),
    ).toBe(false);
    expect(args).not.toContain("-itags");
    expect(args).toContain("-dr");
  });

  it("supports running a url-only subset against the final web target", () => {
    const args = buildNucleiArguments({
      target: "https://example.com/login",
      templateIds: NUCLEI_URL_TEMPLATE_IDS,
      headers: [],
    });

    expect(args[args.indexOf("-id") + 1]).toBe(NUCLEI_URL_TEMPLATE_IDS.join(","));
    expect(args).not.toContain("-itags");
  });

  it("supports running txt-service-detect in an isolated invocation with include tags", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: NUCLEI_TXT_SERVICE_TEMPLATE_IDS,
      includeTags: ["txt-service"],
      headers: [],
    });

    expect(args[args.indexOf("-id") + 1]).toBe(NUCLEI_TXT_SERVICE_TEMPLATE_IDS.join(","));
    expect(args[args.indexOf("-itags") + 1]).toBe("txt-service");
    expect(args).toContain("-dr");
  });

  it("resolves custom template ids to repo-local paths when no templates directory is configured", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: ["rdap-whois-custom"],
      headers: [],
    });

    expect(args).not.toContain("-id");
    expect(args).toContain("-t");
    expect(
      args.some((value) => value.endsWith("/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml")),
    ).toBe(true);
    expect(args).toContain("-dr");
  });

  it("keeps custom templates on repo-local paths even when templates directory is configured", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: ["rdap-whois-custom"],
      disableRedirects: false,
      headers: [],
      templatesDir: "/opt/nuclei-templates",
    });

    expect(args).not.toContain("-id");
    expect(args).toContain("-t");
    expect(args).not.toContain("/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml");
    expect(
      args.some((value) => value.endsWith("/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml")),
    ).toBe(true);
  });

  it("allows redirect-following for the isolated RDAP phase", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: NUCLEI_RDAP_TEMPLATE_IDS,
      disableRedirects: false,
      headers: [],
    });

    expect(args).not.toContain("-dr");
    expect(args).not.toContain("-id");
    expect(
      args.some((value) => value.endsWith("/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml")),
    ).toBe(true);
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
      subject: null,
      subjectType: "url",
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
      subject: null,
      subjectType: "url",
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

  it("maps new metadata templates into stable finding kinds", () => {
    const txtMatch = parseNucleiJsonLine({
      "template-id": "txt-fingerprint",
      "template-path": "dns/txt-fingerprint.yaml",
      type: "dns",
      severity: "info",
      host: "example.com",
      "matched-at": "example.com",
      "extracted-results": ["v=spf1 include:_spf.example.com ~all"],
    });

    const rdapMatch = parseNucleiJsonLine({
      "template-id": "rdap-whois-custom",
      "template-path": "http/miscellaneous/rdap-whois-custom.yaml",
      type: "http",
      severity: "info",
      host: "example.com",
      url: "https://www.rdap.net/domain/example.com",
      "matched-at": "https://www.rdap.net/domain/example.com",
      "extracted-results": ["active", "2030-01-01T00:00:00Z"],
    });

    const robotsMatch = parseNucleiJsonLine({
      "template-id": "robots-txt",
      "template-path": "http/miscellaneous/robots-txt.yaml",
      type: "http",
      severity: "info",
      host: "example.com",
      url: "https://example.com/robots.txt",
      path: "/robots.txt",
      "matched-at": "https://example.com/robots.txt",
    });

    expect(txtMatch?.findingKind).toBe("txt_record");
    expect(rdapMatch?.findingKind).toBe("domain_metadata");
    expect(robotsMatch?.findingKind).toBe("robots_txt");
  });

  it("stamps execution subject metadata onto parsed matches", () => {
    const match = parseNucleiJsonLine({
      "template-id": "rdap-whois-custom",
      type: "http",
      severity: "info",
      "matched-at": "https://www.rdap.net/domain/example.com",
    });

    expect(match).not.toBeNull();

    const withContext = withNucleiMatchExecutionContext(match!, {
      subject: "example.com",
      subjectType: "domain",
    });

    expect(withContext.subject).toBe("example.com");
    expect(withContext.subjectType).toBe("domain");
  });
});
