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
          extractedResults: ["2030-01-01T00:00:00Z", "Example Registrar, LLC"],
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
    expect(screen.getByText("rdap-whois-custom")).toBeTruthy()
    expect(screen.getByText("Example Registrar, LLC")).toBeTruthy()
  })
})
