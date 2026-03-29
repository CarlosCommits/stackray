import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ScanOverviewStrip } from "@/components/scans/scan-overview-strip"

describe("ScanOverviewStrip", () => {
  it("renders primary scan summary metrics and supporting context", () => {
    render(
      <ScanOverviewStrip
        technologyItems={[
          { name: "Next.js", inferred: false },
          { name: "Cloudflare", inferred: false },
        ]}
        technologies={["Next.js", "Cloudflare"]}
        finalUrl="https://example.com/login"
        redirectCount={2}
        statusCode={200}
        statusText="OK"
        server="nginx"
        cdnName="cloudflare"
        hostIp="203.0.113.10"
        title="Example Login"
        asnOrg="Example Networks"
      />,
    )

    expect(screen.getByText("Status")).toBeTruthy()
    expect(screen.getByText("200")).toBeTruthy()
    expect(screen.getByText("2 hops")).toBeTruthy()
    expect(screen.getByText("nginx")).toBeTruthy()
    expect(screen.getByText("203.0.113.10")).toBeTruthy()
    expect(screen.getByText("Next.js")).toBeTruthy()
    expect(screen.getByText("Example Login")).toBeTruthy()
  })
})
