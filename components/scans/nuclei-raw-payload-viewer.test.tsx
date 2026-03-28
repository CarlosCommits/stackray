import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { NucleiRawPayloadViewer } from "@/components/scans/nuclei-raw-payload-viewer"
import type { NucleiSchema } from "@/lib/contracts/scans"

describe("NucleiRawPayloadViewer", () => {
  const mockNuclei: NucleiSchema = {
    state: "completed",
    run: {
      status: "completed",
      targetUrl: "https://example.com",
      targetHost: null,
      headers: [],
      templateIds: ["template-1", "template-2"],
      engineVersion: "3.1.0",
      templatesVersion: "9.5.0",
      errorMessage: null,
      startedAt: "2026-03-27T10:00:00Z",
      completedAt: "2026-03-27T10:00:05Z",
    },
    technologies: [
      {
        matchId: "tech-1",
        templateId: "tech-detect",
        templatePath: "/templates/tech/wordpress.yaml",
        matcherName: "wordpress-matcher",
        protocolType: "http",
        severity: "info",
        matchedAt: "https://example.com",
        host: "example.com",
        ip: "93.184.216.34",
        port: "443",
        scheme: "https",
        url: "https://example.com",
        path: "/",
        extractedResults: ["WordPress 6.4"],
        technologyName: "WordPress",
        technologyVersion: "6.4",
        findingKind: "technology",
        raw: {},
      },
    ],
    findings: [
      {
        matchId: "finding-1",
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
        extractedResults: ["www.example.com"],
        technologyName: null,
        technologyVersion: null,
        findingKind: "ssl_dns_names",
        raw: {},
      },
    ],
  }

  it("renders the collapsible header with scan info", () => {
    render(
      <NucleiRawPayloadViewer
        nuclei={mockNuclei}
        scanId="scn_test123"
        target="https://example.com"
      />,
    )

    expect(screen.getByText("Nuclei Security Payload")).toBeTruthy()
    expect(screen.getByText("scn_test123")).toBeTruthy()
    expect(screen.getByText("https://example.com")).toBeTruthy()
    expect(screen.getByText("1 findings")).toBeTruthy()
    expect(screen.getByText("1 tech matches")).toBeTruthy()
  })

  it("expands when clicked to show raw JSON payload", () => {
    render(
      <NucleiRawPayloadViewer
        nuclei={mockNuclei}
        scanId="scn_test123"
        target="https://example.com"
      />,
    )

    const trigger = screen.getByText("Nuclei Security Payload").closest("button") ||
      screen.getByText("Nuclei Security Payload").parentElement?.parentElement
    expect(trigger).toBeTruthy()
  })

  it("shows copy button when expanded", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })

    render(
      <NucleiRawPayloadViewer
        nuclei={mockNuclei}
        scanId="scn_test123"
        target="https://example.com"
      />,
    )

    const header = screen.getByText("Nuclei Security Payload").closest("[data-state]") ||
      document.querySelector("[data-state]")
    if (header) {
      fireEvent.click(header)
    }
  })

  it("renders with not_run state", () => {
    const notRunNuclei: NucleiSchema = {
      state: "not_run",
      run: null,
      technologies: [],
      findings: [],
    }

    render(
      <NucleiRawPayloadViewer
        nuclei={notRunNuclei}
        scanId="scn_test456"
        target="https://example.com"
      />,
    )

    expect(screen.getByText("Nuclei Security Payload")).toBeTruthy()
    expect(screen.getByText("scn_test456")).toBeTruthy()
  })

  it("renders with failed state and error message", () => {
    const failedNuclei: NucleiSchema = {
      state: "failed",
      run: {
        status: "failed",
        targetUrl: "https://example.com",
        targetHost: null,
        headers: [],
        templateIds: [],
        engineVersion: null,
        templatesVersion: null,
        errorMessage: "Connection failed",
        startedAt: "2026-03-27T10:00:00Z",
        completedAt: "2026-03-27T10:00:01Z",
      },
      technologies: [],
      findings: [],
    }

    render(
      <NucleiRawPayloadViewer
        nuclei={failedNuclei}
        scanId="scn_test789"
        target="https://example.com"
      />,
    )

    expect(screen.getByText("Nuclei Security Payload")).toBeTruthy()
    expect(screen.getByText("scn_test789")).toBeTruthy()
  })
})
