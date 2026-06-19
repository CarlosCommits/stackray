import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RawEvidenceSummaryCards, RawEvidenceTabs } from "@/components/scans/raw-evidence-tabs"
import type { NucleiSchema } from "@/lib/contracts/scans"

describe("RawEvidenceTabs", () => {
  const nuclei: NucleiSchema = {
    state: "completed",
    run: null,
    technologies: [],
    findings: [
      {
        matchId: "m-1",
        templateId: "ssl-issuer",
        templatePath: null,
        matcherName: null,
        protocolType: "ssl",
        severity: "low",
        matchedAt: "example.com:443",
        host: "example.com",
        ip: null,
        port: "443",
        scheme: "https",
        url: "https://example.com",
        path: "/",
        extractedResults: ["Let's Encrypt"],
        technologyName: null,
        technologyVersion: null,
        findingKind: "ssl_issuer",
        subject: "https://example.com",
        subjectType: "url",
        raw: {},
      },
    ],
  }

  it("renders JSON-only httpx and nuclei raw evidence tabs", () => {
    render(
      <RawEvidenceTabs
        rawHttpx={{ status_code: 200, title: "Example" }}
        nuclei={nuclei}
      />,
    )

    expect(screen.getByText("Debug / Raw Evidence")).toBeTruthy()
    expect(screen.queryByText("Summary")).toBeNull()
    expect(screen.getByText("HTTPX Probe")).toBeTruthy()
    expect(screen.getByText("Nuclei Security")).toBeTruthy()
    expect(screen.getByText("HTTPX Probe Payload")).toBeTruthy()

    fireEvent.click(screen.getByRole("tab", { name: /Nuclei Security/ }))
    expect(screen.getByText("Nuclei Security Payload")).toBeTruthy()
  })

  it("renders scan info summary cards separately", () => {
    render(<RawEvidenceSummaryCards rawHttpx={{ status_code: 200, title: "Example" }} nuclei={nuclei} />)

    expect(screen.getByText("HTTPX probe")).toBeTruthy()
    expect(screen.getByText("Nuclei run")).toBeTruthy()
    expect(screen.getByText("Status")).toBeTruthy()
    expect(screen.getByText("Findings")).toBeTruthy()
  })
})
