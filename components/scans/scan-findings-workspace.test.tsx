import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ScanFindingsWorkspace } from "@/components/scans/scan-findings-workspace"
import type { NucleiSchema } from "@/lib/contracts/scans"

describe("ScanFindingsWorkspace", () => {
  it("renders the security findings tab with grouped nuclei findings", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: "example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        headers: [],
        templateIds: ["rdap-whois-custom", "ssl-issuer"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "status-1",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/example.com",
          host: "example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/example.com",
          path: "/com/v1/domain/example.com",
          extractedResults: ["2030-01-01T00:00:00Z", "Network Solutions, LLC"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "example.com",
          subjectType: "domain",
          raw: {},
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={["Next.js"]}
        technologyItems={[{ name: "Next.js", inferred: false }]}
      />,
    )

    expect(screen.getByText("Findings Workspace")).toBeTruthy()
    expect(screen.getByText("Security Findings")).toBeTruthy()
    expect(screen.getByText("Domain Metadata")).toBeTruthy()
    expect(screen.getByText("example.com")).toBeTruthy()
    expect(screen.getByText("RDAP Domain Metadata")).toBeTruthy()
  })

  it("renders structured RDAP metadata with registrar name", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: "example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "registrar-name",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/example.com",
          host: "example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/example.com",
          path: "/com/v1/domain/example.com",
          extractedResults: ["GoDaddy.com, LLC"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "example.com",
          subjectType: "domain",
          raw: {
            "extractor-name": "registrarName",
          },
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={[]}
      />,
    )

    expect(screen.getByText("Registrar")).toBeTruthy()
    expect(screen.getByText("GoDaddy.com, LLC")).toBeTruthy()
  })

  it("renders structured RDAP metadata with expiration date", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: "example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "expiration-date",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/example.com",
          host: "example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/example.com",
          path: "/com/v1/domain/example.com",
          extractedResults: ["2030-12-31T23:59:59Z"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "example.com",
          subjectType: "domain",
          raw: {
            "extractor-name": "expirationDate",
          },
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={[]}
      />,
    )

    expect(screen.getByText("Expires")).toBeTruthy()
    expect(screen.getByText("Dec 31, 2030")).toBeTruthy()
  })

  it("labels domain subject as (original) when it matches originalDomainTarget", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://old-example.com",
        targetHost: "old-example.com",
        originalDomainTarget: "old-example.com",
        finalDomainTarget: "new-example.com",
        domainTarget: "old-example.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "status-1",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/old-example.com",
          host: "old-example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/old-example.com",
          path: "/com/v1/domain/old-example.com",
          extractedResults: ["2030-01-01T00:00:00Z"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "old-example.com",
          subjectType: "domain",
          raw: {},
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={[]}
      />,
    )

    expect(screen.getByText("(original)")).toBeTruthy()
    expect(screen.getByText("old-example.com")).toBeTruthy()
  })

  it("labels domain subject as (final) when it matches finalDomainTarget", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://old-example.com",
        targetHost: "new-example.com",
        originalDomainTarget: "old-example.com",
        finalDomainTarget: "new-example.com",
        domainTarget: "old-example.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "status-1",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/new-example.com",
          host: "new-example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/new-example.com",
          path: "/com/v1/domain/new-example.com",
          extractedResults: ["2030-01-01T00:00:00Z"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "new-example.com",
          subjectType: "domain",
          raw: {},
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={[]}
      />,
    )

    expect(screen.getByText("(final)")).toBeTruthy()
    expect(screen.getByText("new-example.com")).toBeTruthy()
  })

  it("groups multiple RDAP findings for the same domain into one card", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: "example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "registrar",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/example.com",
          host: "example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/example.com",
          path: "/com/v1/domain/example.com",
          extractedResults: ["GoDaddy.com, LLC"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "example.com",
          subjectType: "domain",
          raw: {
            "extractor-name": "registrarName",
          },
        },
        {
          matchId: "m-2",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "expiration",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/example.com",
          host: "example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/example.com",
          path: "/com/v1/domain/example.com",
          extractedResults: ["2030-12-31T23:59:59Z"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "example.com",
          subjectType: "domain",
          raw: {
            "extractor-name": "expirationDate",
          },
        },
        {
          matchId: "m-3",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "nameserver",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/example.com",
          host: "example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/example.com",
          path: "/com/v1/domain/example.com",
          extractedResults: ["ns1.example.com"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "example.com",
          subjectType: "domain",
          raw: {
            "extractor-name": "nameServers",
          },
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={[]}
      />,
    )

    // Should show only one RDAP card with all metadata combined
    expect(screen.getByText("Domain Metadata")).toBeTruthy()
    expect(screen.getByText("Registrar")).toBeTruthy()
    expect(screen.getByText("GoDaddy.com, LLC")).toBeTruthy()
    expect(screen.getByText("Expires")).toBeTruthy()
    expect(screen.getByText("Dec 31, 2030")).toBeTruthy()
    expect(screen.getByText("Nameservers")).toBeTruthy()
    expect(screen.getByText("ns1.example.com")).toBeTruthy()
  })

  it("renders non-RDAP findings with improved domain labeling", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://old-example.com",
        targetHost: "old-example.com",
        originalDomainTarget: "old-example.com",
        finalDomainTarget: "new-example.com",
        domainTarget: "old-example.com",
        headers: [],
        templateIds: ["dns-saas-service-detection"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "dns-saas-service-detection",
          templatePath: "/opt/nuclei-templates/dns/dns-saas-service-detection.yaml",
          matcherName: "cloudflare",
          protocolType: "dns",
          severity: "info",
          matchedAt: "old-example.com",
          host: "old-example.com",
          ip: null,
          port: "53",
          scheme: null,
          url: null,
          path: null,
          extractedResults: ["Cloudflare"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "dns_service",
          subject: "old-example.com",
          subjectType: "domain",
          raw: {},
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={[]}
      />,
    )

    expect(screen.getByText("DNS Services")).toBeTruthy()
    expect(screen.getByText("dns-saas-service-detection")).toBeTruthy()
    // Should show domain (original) label - check for the suffix badge
    expect(screen.getByText("(original)")).toBeTruthy()
  })

  it("renders nameservers in RDAP metadata card", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: "example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "nameservers",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/example.com",
          host: "example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/example.com",
          path: "/com/v1/domain/example.com",
          extractedResults: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "example.com",
          subjectType: "domain",
          raw: {
            "extractor-name": "nameServers",
          },
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={[]}
      />,
    )

    expect(screen.getByText("Nameservers")).toBeTruthy()
    expect(screen.getByText("ns1.cloudflare.com")).toBeTruthy()
    expect(screen.getByText("ns2.cloudflare.com")).toBeTruthy()
  })

  it("renders all nameservers when nuclei emits one extractor-name with multiple extracted results", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://theesa.com",
        targetHost: "theesa.com",
        originalDomainTarget: "theesa.com",
        finalDomainTarget: "theesa.com",
        domainTarget: "theesa.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.7.1",
        templatesVersion: "10.4.0",
        errorMessage: null,
        startedAt: "2026-03-29T10:00:00Z",
        completedAt: "2026-03-29T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-nameservers",
          templateId: "rdap-whois-custom",
          templatePath: "/app/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: null,
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          host: "theesa.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          path: "/com/v1/domain/theesa.com",
          extractedResults: ["KAYLEIGH.NS.CLOUDFLARE.COM", "SCOTT.NS.CLOUDFLARE.COM"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "theesa.com",
          subjectType: "domain",
          raw: { "extractor-name": "nameServers" },
        },
      ],
    }

    render(<ScanFindingsWorkspace nuclei={nuclei} technologies={[]} />)

    expect(screen.getByText("KAYLEIGH.NS.CLOUDFLARE.COM")).toBeTruthy()
    expect(screen.getByText("SCOTT.NS.CLOUDFLARE.COM")).toBeTruthy()
  })

  it("renders registrar url and contact details from real nuclei extractor-name payloads", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://theesa.com",
        targetHost: "theesa.com",
        originalDomainTarget: "theesa.com",
        finalDomainTarget: "theesa.com",
        domainTarget: "theesa.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.7.1",
        templatesVersion: "10.4.0",
        errorMessage: null,
        startedAt: "2026-03-29T10:00:00Z",
        completedAt: "2026-03-29T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-name",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: null,
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          host: "theesa.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          path: "/com/v1/domain/theesa.com",
          extractedResults: ["Network Solutions, LLC"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "theesa.com",
          subjectType: "domain",
          raw: { "extractor-name": "registrarName" },
        },
        {
          matchId: "m-url",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: null,
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          host: "theesa.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          path: "/com/v1/domain/theesa.com",
          extractedResults: ["http://networksolutions.com"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "theesa.com",
          subjectType: "domain",
          raw: { "extractor-name": "registrarUrl" },
        },
        {
          matchId: "m-email",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: null,
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          host: "theesa.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          path: "/com/v1/domain/theesa.com",
          extractedResults: ["domain.operations@web.com"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "theesa.com",
          subjectType: "domain",
          raw: { "extractor-name": "registrarEmail" },
        },
        {
          matchId: "m-phone",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: null,
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          host: "theesa.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          path: "/com/v1/domain/theesa.com",
          extractedResults: ["tel:+1.8777228662"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "theesa.com",
          subjectType: "domain",
          raw: { "extractor-name": "registrarPhone" },
        },
      ],
    }

    render(<ScanFindingsWorkspace nuclei={nuclei} technologies={[]} />)

    expect(screen.getByText("Network Solutions, LLC")).toBeTruthy()
    expect(screen.getByText("http://networksolutions.com")).toBeTruthy()
    expect(screen.getByText("domain.operations@web.com")).toBeTruthy()
    expect(screen.getByText("tel:+1.8777228662")).toBeTruthy()
  })

  it("renders DNSSEC information in RDAP metadata card", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: "example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.4.0",
        templatesVersion: "9.8.0",
        errorMessage: null,
        startedAt: "2026-03-28T10:00:00Z",
        completedAt: "2026-03-28T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-1",
          templateId: "rdap-whois-custom",
          templatePath: "/opt/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: "dnssec",
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/example.com",
          host: "example.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/example.com",
          path: "/com/v1/domain/example.com",
          extractedResults: ["signedDelegation"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "example.com",
          subjectType: "domain",
          raw: {},
        },
      ],
    }

    render(
      <ScanFindingsWorkspace
        nuclei={nuclei}
        technologies={[]}
      />,
    )

    // Check for the DNSSEC value - the label is rendered as uppercase
    expect(screen.getByText("signedDelegation")).toBeTruthy()
  })

  it("does not misclassify secureDNS false as a nameserver", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://theesa.com",
        targetHost: "theesa.com",
        originalDomainTarget: "theesa.com",
        finalDomainTarget: "theesa.com",
        domainTarget: "theesa.com",
        headers: [],
        templateIds: ["rdap-whois-custom"],
        engineVersion: "3.7.1",
        templatesVersion: "10.4.0",
        errorMessage: null,
        startedAt: "2026-03-29T10:00:00Z",
        completedAt: "2026-03-29T10:00:03Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "m-ns",
          templateId: "rdap-whois-custom",
          templatePath: "/app/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: null,
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          host: "theesa.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          path: "/com/v1/domain/theesa.com",
          extractedResults: ["KAYLEIGH.NS.CLOUDFLARE.COM"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "theesa.com",
          subjectType: "domain",
          raw: { "extractor-name": "nameServers" },
        },
        {
          matchId: "m-dnssec",
          templateId: "rdap-whois-custom",
          templatePath: "/app/worker/nuclei-templates/http/miscellaneous/rdap-whois-custom.yaml",
          matcherName: null,
          protocolType: "http",
          severity: "info",
          matchedAt: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          host: "theesa.com",
          ip: null,
          port: null,
          scheme: "https",
          url: "https://rdap.verisign.com/com/v1/domain/theesa.com",
          path: "/com/v1/domain/theesa.com",
          extractedResults: ["false"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "domain_metadata",
          subject: "theesa.com",
          subjectType: "domain",
          raw: { "extractor-name": "secureDNS" },
        },
      ],
    }

    render(<ScanFindingsWorkspace nuclei={nuclei} technologies={[]} />)

    expect(screen.getByText("Nameservers")).toBeTruthy()
    expect(screen.getByText("KAYLEIGH.NS.CLOUDFLARE.COM")).toBeTruthy()
    expect(screen.getByText("DNSSEC")).toBeTruthy()
    expect(screen.getByText("Unsigned delegation")).toBeTruthy()
  })
})
