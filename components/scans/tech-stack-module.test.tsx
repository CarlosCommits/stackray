import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TechStackModule } from "@/components/scans/tech-stack-module"

describe("TechStackModule", () => {
  it("renders primary technologies separately from additional findings and wordpress plugins", () => {
    render(
      <TechStackModule
        primaryTechnologyItems={[{ name: "WordPress", inferred: false }]}
        primaryTechnologies={["WordPress"]}
        additionalFindingItems={[
          { name: "Fastly", inferred: false },
          { name: "PHP", inferred: false },
        ]}
        additionalFindings={["Fastly", "PHP"]}
        wordpress={{
          pluginItems: [
            { name: "CookieYes", inferred: true },
            { name: "Yoast SEO", inferred: false },
          ],
          plugins: ["CookieYes", "Yoast SEO"],
          themeItems: [{ name: "pro", inferred: false }],
          themes: ["pro"],
        }}
        cpe={[]}
      />,
    )

    expect(screen.getByText("Primary Technologies")).toBeTruthy()
    expect(screen.getByText("WordPress Plugins")).toBeTruthy()
    expect(screen.getByText("WordPress")).toBeTruthy()
    expect(screen.getByText("CookieYes")).toBeTruthy()
    expect(screen.getByText("Yoast SEO")).toBeTruthy()
    expect(screen.getByText("Fastly")).toBeTruthy()
  })
})
