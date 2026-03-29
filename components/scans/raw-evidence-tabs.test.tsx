import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RawEvidenceTabs } from "@/components/scans/raw-evidence-tabs"
import type { NucleiSchema } from "@/lib/contracts/scans"

describe("RawEvidenceTabs", () => {
  it("renders httpx and nuclei raw evidence tabs", () => {
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

    render(
      <RawEvidenceTabs
        rawHttpx={{ status_code: 200, title: "Example" }}
        nuclei={nuclei}
        scanId="scan-123"
        target="https://example.com"
      />,
    )

    expect(screen.getByText("Debug / Raw Evidence")).toBeTruthy()
    expect(screen.getByText("HTTPX Probe")).toBeTruthy()
    expect(screen.getByText("Nuclei Security")).toBeTruthy()
    expect(screen.getByText("HTTPX Probe Payload")).toBeTruthy()
  })
})
