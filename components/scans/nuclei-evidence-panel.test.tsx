import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { NucleiEvidencePanel } from "@/components/scans/nuclei-evidence-panel"
import type { NucleiSchema } from "@/lib/contracts/scans"

describe("NucleiEvidencePanel", () => {
  it("renders null when state is not_run and no findings", () => {
    const { container } = render(
      <NucleiEvidencePanel
        nuclei={{
          state: "not_run",
          run: null,
          technologies: [],
          findings: [],
        }}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders completed state with findings grouped by kind", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: null,
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        headers: [],
        templateIds: ["dns-service", "ssl-dns-names"],
        engineVersion: "3.1.0",
        templatesVersion: "9.5.0",
        errorMessage: null,
        startedAt: "2026-03-27T10:00:00Z",
        completedAt: "2026-03-27T10:00:05Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "match-1",
          templateId: "dns-service",
          templatePath: "/templates/dns/dns-service.yaml",
          matcherName: "dns-matcher",
          protocolType: "dns",
          severity: "info",
          matchedAt: "example.com",
          host: "example.com",
          ip: "93.184.216.34",
          port: "53",
          scheme: null,
          url: null,
          path: null,
          extractedResults: ["A: 93.184.216.34"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "dns_service",
          subject: "example.com",
          subjectType: "domain",
          raw: {},
        },
        {
          matchId: "match-2",
          templateId: "ssl-dns-names",
          templatePath: "/templates/ssl/ssl-dns-names.yaml",
          matcherName: "ssl-matcher",
          protocolType: "ssl",
          severity: "low",
          matchedAt: "example.com:443",
          host: "example.com",
          ip: "93.184.216.34",
          port: "443",
          scheme: "https",
          url: "https://example.com",
          path: "/",
          extractedResults: ["www.example.com", "api.example.com"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "ssl_dns_names",
          subject: "example.com",
          subjectType: "hostname",
          raw: {},
        },
      ],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("Nuclei Evidence")).toBeTruthy()
    expect(screen.getByText("Completed")).toBeTruthy()
    expect(screen.getByText("DNS Services")).toBeTruthy()
    expect(screen.getByText("SSL DNS Names")).toBeTruthy()
    expect(screen.getByText("Templates:")).toBeTruthy()
    expect(screen.getByText("Findings")).toBeTruthy()
  })

  it("renders run metadata when run is present", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: null,
        originalDomainTarget: null,
        finalDomainTarget: null,
        domainTarget: null,
        headers: [],
        templateIds: ["template-1", "template-2", "template-3"],
        engineVersion: "3.1.0",
        templatesVersion: "9.5.0",
        errorMessage: null,
        startedAt: "2026-03-27T10:00:00Z",
        completedAt: "2026-03-27T10:00:05Z",
      },
      technologies: [],
      findings: [],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("https://example.com")).toBeTruthy()
    expect(screen.getByText("3")).toBeTruthy()
    expect(screen.getByText("No findings detected")).toBeTruthy()
  })

  it("renders error message when run has error", () => {
    const nuclei: NucleiSchema = {
      state: "failed",
      run: {
        status: "failed",
        targetUrl: "https://example.com",
        targetHost: null,
        originalDomainTarget: null,
        finalDomainTarget: null,
        domainTarget: null,
        headers: [],
        templateIds: [],
        engineVersion: null,
        templatesVersion: null,
        errorMessage: "Connection timeout after 30s",
        startedAt: "2026-03-27T10:00:00Z",
        completedAt: "2026-03-27T10:00:30Z",
      },
      technologies: [],
      findings: [],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("Failed")).toBeTruthy()
    expect(screen.getByText("Connection timeout after 30s")).toBeTruthy()
  })

  it("renders severity badges with appropriate styling", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: null,
      technologies: [],
      findings: [
        {
          matchId: "match-1",
          templateId: "critical-vuln",
          templatePath: null,
          matcherName: null,
          protocolType: null,
          severity: "critical",
          matchedAt: "example.com",
          host: null,
          ip: null,
          port: null,
          scheme: null,
          url: null,
          path: null,
          extractedResults: [],
          technologyName: null,
          technologyVersion: null,
          findingKind: "vulnerability",
          subject: null,
          subjectType: null,
          raw: {},
        },
      ],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("critical")).toBeTruthy()
    expect(screen.getByText("Vulnerability")).toBeTruthy()
  })

  it("renders extracted results as badges", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: null,
      technologies: [],
      findings: [
        {
          matchId: "match-1",
          templateId: "dns-service",
          templatePath: null,
          matcherName: "dns-matcher",
          protocolType: "dns",
          severity: "info",
          matchedAt: "example.com",
          host: "example.com",
          ip: "93.184.216.34",
          port: "53",
          scheme: null,
          url: null,
          path: null,
          extractedResults: ["192.168.1.1", "192.168.1.2"],
          technologyName: null,
          technologyVersion: null,
          findingKind: "dns_service",
          subject: "example.com",
          subjectType: "domain",
          raw: {},
        },
      ],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("192.168.1.1")).toBeTruthy()
    expect(screen.getByText("192.168.1.2")).toBeTruthy()
    expect(screen.getByText("Extracted:")).toBeTruthy()
  })

  it("renders domain target when present in run", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://example.com",
        targetHost: null,
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        headers: [],
        templateIds: ["template-1"],
        engineVersion: "3.1.0",
        templatesVersion: "9.5.0",
        errorMessage: null,
        startedAt: "2026-03-27T10:00:00Z",
        completedAt: "2026-03-27T10:00:05Z",
      },
      technologies: [],
      findings: [],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("Domain Target:")).toBeTruthy()
    expect(screen.getByText("example.com")).toBeTruthy()
  })

  it("renders subject and subjectType on finding cards when present", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: null,
      technologies: [],
      findings: [
        {
          matchId: "match-1",
          templateId: "ssl-dns-names",
          templatePath: null,
          matcherName: "ssl-matcher",
          protocolType: "ssl",
          severity: "low",
          matchedAt: "example.com:443",
          host: "example.com",
          ip: "93.184.216.34",
          port: "443",
          scheme: "https",
          url: "https://example.com",
          path: "/",
          extractedResults: [],
          technologyName: null,
          technologyVersion: null,
          findingKind: "ssl_dns_names",
          subject: "www.example.com",
          subjectType: "hostname",
          raw: {},
        },
      ],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("hostname:")).toBeTruthy()
    expect(screen.getByText("www.example.com")).toBeTruthy()
  })

  it("renders subject only when subjectType is null", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: null,
      technologies: [],
      findings: [
        {
          matchId: "match-1",
          templateId: "dns-service",
          templatePath: null,
          matcherName: "dns-matcher",
          protocolType: "dns",
          severity: "info",
          matchedAt: "example.com",
          host: "example.com",
          ip: "93.184.216.34",
          port: "53",
          scheme: null,
          url: null,
          path: null,
          extractedResults: [],
          technologyName: null,
          technologyVersion: null,
          findingKind: "dns_service",
          subject: "192.168.1.1",
          subjectType: null,
          raw: {},
        },
      ],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("192.168.1.1")).toBeTruthy()
  })

  it("renders both original and final domain targets when they differ", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://old-example.com",
        targetHost: null,
        originalDomainTarget: "old-example.com",
        finalDomainTarget: "new-example.com",
        domainTarget: "old-example.com",
        headers: [],
        templateIds: ["template-1"],
        engineVersion: "3.1.0",
        templatesVersion: "9.5.0",
        errorMessage: null,
        startedAt: "2026-03-27T10:00:00Z",
        completedAt: "2026-03-27T10:00:05Z",
      },
      technologies: [],
      findings: [],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("Original Domain Target:")).toBeTruthy()
    expect(screen.getByText("Final Domain Target:")).toBeTruthy()
    expect(screen.getByText("old-example.com")).toBeTruthy()
    expect(screen.getByText("new-example.com")).toBeTruthy()
  })

  it("labels domain subject as (original) when it matches originalDomainTarget", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://old-example.com",
        targetHost: null,
        originalDomainTarget: "old-example.com",
        finalDomainTarget: "new-example.com",
        domainTarget: "old-example.com",
        headers: [],
        templateIds: ["template-1"],
        engineVersion: "3.1.0",
        templatesVersion: "9.5.0",
        errorMessage: null,
        startedAt: "2026-03-27T10:00:00Z",
        completedAt: "2026-03-27T10:00:05Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "match-1",
          templateId: "dns-service",
          templatePath: null,
          matcherName: "dns-matcher",
          protocolType: "dns",
          severity: "info",
          matchedAt: "old-example.com",
          host: "old-example.com",
          ip: "93.184.216.34",
          port: "53",
          scheme: null,
          url: null,
          path: null,
          extractedResults: [],
          technologyName: null,
          technologyVersion: null,
          findingKind: "dns_service",
          subject: "old-example.com",
          subjectType: "domain",
          raw: {},
        },
      ],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("domain (original):")).toBeTruthy()
    // The domain appears in run details and finding card, so we check the label is present
    expect(screen.getAllByText("old-example.com").length).toBeGreaterThanOrEqual(1)
  })

  it("labels domain subject as (final) when it matches finalDomainTarget", () => {
    const nuclei: NucleiSchema = {
      state: "completed",
      run: {
        status: "completed",
        targetUrl: "https://old-example.com",
        targetHost: null,
        originalDomainTarget: "old-example.com",
        finalDomainTarget: "new-example.com",
        domainTarget: "old-example.com",
        headers: [],
        templateIds: ["template-1"],
        engineVersion: "3.1.0",
        templatesVersion: "9.5.0",
        errorMessage: null,
        startedAt: "2026-03-27T10:00:00Z",
        completedAt: "2026-03-27T10:00:05Z",
      },
      technologies: [],
      findings: [
        {
          matchId: "match-1",
          templateId: "dns-service",
          templatePath: null,
          matcherName: "dns-matcher",
          protocolType: "dns",
          severity: "info",
          matchedAt: "new-example.com",
          host: "new-example.com",
          ip: "93.184.216.35",
          port: "53",
          scheme: null,
          url: null,
          path: null,
          extractedResults: [],
          technologyName: null,
          technologyVersion: null,
          findingKind: "dns_service",
          subject: "new-example.com",
          subjectType: "domain",
          raw: {},
        },
      ],
    }

    render(<NucleiEvidencePanel nuclei={nuclei} />)

    expect(screen.getByText("domain (final):")).toBeTruthy()
    expect(screen.getAllByText("new-example.com").length).toBeGreaterThanOrEqual(1)
  })
})
