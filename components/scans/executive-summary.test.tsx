import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ExecutiveSummary } from "@/components/scans/executive-summary"

describe("ExecutiveSummary", () => {
  it("shows inferred badges for inferred technologies", () => {
    render(
      <ExecutiveSummary
        technologyItems={[
          { name: "WordPress", inferred: false },
          { name: "CookieYes", inferred: true },
        ]}
        technologies={["WordPress", "CookieYes"]}
        finalUrl="https://example.com"
        redirectCount={0}
        statusCode={200}
        statusText="OK"
        server="nginx"
        cdnName="none"
        hostIp="127.0.0.1"
        title="Example"
      />,
    )

    expect(screen.getByText("WordPress")).toBeTruthy()
    expect(screen.getByText("CookieYes")).toBeTruthy()
  })
})
