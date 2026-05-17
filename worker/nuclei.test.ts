// @vitest-environment node

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

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

function normalizeArgumentPaths(args: readonly string[]) {
  return args.map((value) => value.replace(/\\/g, "/"));
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value));
  }

  throw new Error(`${label} must be an object`);
}

function asArray(value: unknown, label: string): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  throw new Error(`${label} must be an array`);
}

const repoLocalTemplateCases = [
  {
    id: "replit-dns-verification",
    pathSuffix: "/worker/nuclei-templates/dns/replit-dns-verification.yaml",
  },
  {
    id: "stackray-dns-service-detection",
    pathSuffix: "/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml",
  },
] as const;

describe("repo-local nuclei templates", () => {
  it("keeps the Stackray DNS service template registration aligned with the actual YAML", async () => {
    const templateContents = await readFile(
      new URL("./nuclei-templates/dns/stackray-dns-service-detection.yaml", import.meta.url),
      "utf8",
    );
    const template = asRecord(parseYaml(templateContents), "stackray DNS service template");
    const dnsEntries = asArray(template.dns, "template dns entries").map((entry, index) => asRecord(entry, `dns entry ${index}`));
    const txtEntry = dnsEntries.find((entry) => entry.type === "TXT");
    const nsEntry = dnsEntries.find((entry) => entry.type === "NS");

    if (!txtEntry || !nsEntry) {
      throw new Error("stackray DNS service template must include TXT and NS entries");
    }

    const txtMatchers = asArray(txtEntry.matchers, "TXT matchers")
      .map((matcher, index) => asRecord(matcher, `TXT matcher ${index}`));
    const txtMatcherNames = txtMatchers.map((matcher) => matcher.name);
    const cursorMatcher = txtMatchers.find((matcher) => matcher.name === "Cursor");
    const nsMatcherNames = asArray(nsEntry.matchers, "NS matchers")
      .map((matcher, index) => asRecord(matcher, `NS matcher ${index}`).name);

    if (!cursorMatcher) {
      throw new Error("stackray DNS service template must include the Cursor matcher");
    }

    expect(template.id).toBe("stackray-dns-service-detection");
    expect(NUCLEI_TEMPLATE_ALLOWLIST).toContain(template.id);
    expect(NUCLEI_DOMAIN_TEMPLATE_IDS).toContain(template.id);
    expect(txtMatcherNames).toEqual(["Amazon SES", "Zoom", "Cursor"]);
    expect(cursorMatcher).toEqual(expect.objectContaining({
      type: "regex",
      part: "answer",
    }));
    expect(cursorMatcher).not.toHaveProperty("words");
    expect(asArray(cursorMatcher.regex, "Cursor matcher regex")).toEqual([
      "cursor-domain-verification-[a-z0-9_-]+=[A-Za-z0-9_-]+",
    ]);
    const [cursorPattern] = asArray(cursorMatcher.regex, "Cursor matcher regex");

    if (typeof cursorPattern !== "string") {
      throw new Error("Cursor matcher regex must contain a string pattern");
    }

    const cursorRegex = new RegExp(cursorPattern, "u");

    expect(cursorRegex.test("cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx")).toBe(true);
    expect(cursorRegex.test("cursor-domain-verification-")).toBe(false);
    expect(cursorRegex.test("cursor-domain-verification-example")).toBe(false);
    expect(cursorRegex.test("cursor-domain-verification-=missingSuffix")).toBe(false);
    expect(cursorRegex.test("cursor-domain-verification-example=")).toBe(false);
    expect(nsMatcherNames).toEqual(["Amazon Route 53", "Microsoft Azure DNS"]);
  });
});

describe("buildNucleiArguments", () => {
  it("bundles the template allowlist without txt-service include tags by default", () => {
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
      NUCLEI_TEMPLATE_ALLOWLIST.filter(
        (templateId) => !["replit-dns-verification", "stackray-dns-service-detection"].includes(templateId),
      ).join(","),
    );
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/replit-dns-verification.yaml")),
    ).toBe(true);
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml")),
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
    expect(args.filter((value) => value === "-t")).toHaveLength(NUCLEI_TEMPLATE_ALLOWLIST.length);
    expect(args).toContain("/opt/nuclei-templates/ssl/detect-ssl-issuer.yaml");
    expect(args).toContain("/opt/nuclei-templates/dns/txt-fingerprint.yaml");
    expect(args).not.toContain("/opt/nuclei-templates/dns/nameserver-fingerprint.yaml");
    expect(args).toContain("/opt/nuclei-templates/http/miscellaneous/rdap-whois.yaml");
    expect(args).not.toContain("/opt/nuclei-templates/dns/replit-dns-verification.yaml");
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/replit-dns-verification.yaml")),
    ).toBe(true);
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml")),
    ).toBe(true);
    expect(args).toContain("/opt/nuclei-templates/http/miscellaneous/robots-txt.yaml");
  });

  it("supports running a domain-only subset against a non-url target", () => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: NUCLEI_DOMAIN_TEMPLATE_IDS,
      headers: [],
    });

    expect(args[args.indexOf("-u") + 1]).toBe("example.com");
    expect(args[args.indexOf("-id") + 1]).toBe(
      NUCLEI_DOMAIN_TEMPLATE_IDS.filter(
        (templateId) => !["replit-dns-verification", "stackray-dns-service-detection"].includes(templateId),
      ).join(","),
    );
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/replit-dns-verification.yaml")),
    ).toBe(true);
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith("/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml")),
    ).toBe(true);
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

  it.each(repoLocalTemplateCases)("resolves repo-local template $id to a repo-local path when no templates directory is configured", ({ id, pathSuffix }) => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: [id],
      headers: [],
    });

    expect(args).not.toContain("-id");
    expect(args).toContain("-t");
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith(pathSuffix)),
    ).toBe(true);
    expect(args).toContain("-dr");
  });

  it.each(repoLocalTemplateCases)("keeps repo-local template $id on its repo-local path even when templates directory is configured", ({ id, pathSuffix }) => {
    const args = buildNucleiArguments({
      target: "example.com",
      templateIds: [id],
      disableRedirects: false,
      headers: [],
      templatesDir: "/opt/nuclei-templates",
    });

    expect(args).not.toContain("-id");
    expect(args).toContain("-t");
    expect(args).not.toContain(`/opt/nuclei-templates/${pathSuffix.split("/worker/nuclei-templates/")[1]}`);
    expect(
      normalizeArgumentPaths(args).some((value) => value.endsWith(pathSuffix)),
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
    expect(args[args.indexOf("-id") + 1]).toBe("rdap-whois");
    expect(args).not.toContain("-t");
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
      "template-id": "rdap-whois",
      "template-path": "http/miscellaneous/rdap-whois.yaml",
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

    const replitMatch = parseNucleiJsonLine({
      "template-id": "replit-dns-verification",
      "template-path": "dns/replit-dns-verification.yaml",
      "matcher-name": "Replit",
      type: "dns",
      severity: "info",
      host: "example.com",
      "matched-at": "example.com",
      "extracted-results": ["replit-verify=00000000-0000-4000-8000-000000000000"],
    });

    const stackrayDnsServiceMatch = parseNucleiJsonLine({
      "template-id": "stackray-dns-service-detection",
      "template-path": "dns/stackray-dns-service-detection.yaml",
      "matcher-name": "Amazon Route 53",
      type: "dns",
      severity: "info",
      host: "example.com",
      "matched-at": "example.com",
      "extracted-results": ["ns-219.awsdns-27.com."],
    });

    expect(txtMatch?.findingKind).toBe("txt_record");
    expect(rdapMatch?.findingKind).toBe("domain_metadata");
    expect(robotsMatch?.findingKind).toBe("robots_txt");
    expect(replitMatch?.findingKind).toBe("technology");
    expect(replitMatch?.technologyName).toBe("Replit");
    expect(stackrayDnsServiceMatch?.findingKind).toBe("dns_service");
    expect(stackrayDnsServiceMatch?.technologyName).toBeNull();
    expect(stackrayDnsServiceMatch?.subjectType).toBe("domain");
  });

  it("stamps execution subject metadata onto parsed matches", () => {
    const match = parseNucleiJsonLine({
      "template-id": "rdap-whois",
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
