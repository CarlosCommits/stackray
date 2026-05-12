import { describe, expect, it } from "vitest";

import {
  buildEnrichedTechnologies,
  deriveTechnologiesFromEvidence,
  getNucleiDnsServiceTechnologyName,
  promoteTechnologiesFromCpe,
} from "@/lib/server/scans/technology-enrichment";

describe("promoteTechnologiesFromCpe", () => {
  it("promotes high-confidence application CPEs", () => {
    expect(
      promoteTechnologiesFromCpe([
        {
          cpe: "cpe:2.3:a:vercel:next.js:*:*:*:*:*:*:*:*",
          vendor: "vercel",
          product: "next.js",
        },
        {
          cpe: "cpe:2.3:a:zeit:next.js:*:*:*:*:*:*:*:*",
          vendor: "zeit",
          product: "next.js",
        },
        {
          cpe: "cpe:2.3:a:woocommerce:woocommerce:*:*:*:*:*:*:*:*",
          vendor: "woocommerce",
          product: "woocommerce",
        },
      ]),
    ).toEqual(["Next.js", "WooCommerce"]);
  });

  it("ignores generic or noisy infrastructure CPEs", () => {
    expect(
      promoteTechnologiesFromCpe([
        {
          cpe: "cpe:2.3:a:nginx:nginx:*:*:*:*:*:*:*:*",
          vendor: "nginx",
          product: "nginx",
        },
        {
          cpe: "cpe:2.3:a:webp:webp_server_go:*:*:*:*:*:*:*:*",
          vendor: "webp",
          product: "webp_server_go",
        },
      ]),
    ).toEqual([]);
  });
});

describe("deriveTechnologiesFromEvidence", () => {
  it("derives vendor technologies from high-signal domains and CSP hosts", () => {
    expect(
      deriveTechnologiesFromEvidence({
        cspJson: {
          domains: ["contentful.com", "segment.com"],
          fqdn: ["munchkin.marketo.net", "js.intercomcdn.com"],
        },
        bodyDomains: ["plausible.io", "google-analytics.com", "openai.com"],
        bodyFqdns: ["newassets.hcaptcha.com", "api.segment.com"],
      }),
    ).toEqual(["Contentful", "Google Analytics", "Segment", "Marketo", "Intercom", "Plausible Analytics", "hCaptcha"]);
  });

  it("ignores domains outside the curated allowlist", () => {
    expect(
      deriveTechnologiesFromEvidence({
        cspJson: {
          domains: ["facebook.com", "linkedin.com", "stripe.com"],
          fqdn: ["images.example.com"],
        },
        bodyDomains: ["cloudfront.net", "amazonaws.com"],
        bodyFqdns: ["cdn.jsdelivr.net"],
      }),
    ).toEqual([]);
  });
});

describe("getNucleiDnsServiceTechnologyName", () => {
  it("promotes clean DNS service matcher names into canonical technology names", () => {
    expect(getNucleiDnsServiceTechnologyName({
      findingKind: "dns_service",
      matcherName: "brevo",
    })).toBe("Brevo");

    expect(getNucleiDnsServiceTechnologyName({
      findingKind: "dns_service",
      matcherName: "google-workspace",
    })).toBe("Google Workspace");
  });

  it("ignores non DNS-service findings and matches without a service matcher", () => {
    expect(getNucleiDnsServiceTechnologyName({
      findingKind: "txt_record",
      matcherName: "brevo",
    })).toBeNull();

    expect(getNucleiDnsServiceTechnologyName({
      findingKind: "dns_service",
      matcherName: null,
    })).toBeNull();
  });
});

describe("buildEnrichedTechnologies", () => {
  it("merges persisted, CPE-promoted, and derived technologies without duplicates", () => {
    expect(
      buildEnrichedTechnologies({
        persistedTechnologies: ["Amazon Web Services", "Nginx", "Contentful"],
        additionalTechnologies: ["Drupal", "Contentful", "Next.js"],
        cpeEntries: [
          {
            cpe: "cpe:2.3:a:vercel:next.js:*:*:*:*:*:*:*:*",
            vendor: "vercel",
            product: "next.js",
          },
          {
            cpe: "cpe:2.3:a:wordpress:wordpress:*:*:*:*:*:*:*:*",
            vendor: "wordpress",
            product: "wordpress",
          },
        ],
        cspJson: {
          domains: ["contentful.com", "salesforce.com"],
          fqdn: ["cdn.segment.com"],
        },
        bodyDomains: ["google-analytics.com"],
        bodyFqdns: ["js.intercomcdn.com"],
      }),
    ).toEqual([
      "Amazon Web Services",
      "Nginx",
      "Contentful",
      "Drupal",
      "Next.js",
      "WordPress",
      "Google Analytics",
      "Salesforce",
      "Segment",
      "Intercom",
    ]);
  });
});
