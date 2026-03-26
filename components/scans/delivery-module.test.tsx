import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DeliveryModule } from "@/components/scans/delivery-module"

describe("DeliveryModule", () => {
  it("renders redirect hops with their normalized source urls", () => {
    render(
      <DeliveryModule
        finalUrl="https://app.example.test/"
        path="/"
        method="GET"
        location={null}
        contentType="text/html"
        responseTimeMs={733}
        redirectChain={{
          statusCodes: [308, 200],
          items: [
            {
              url: "https://www.app.example.test",
              statusCode: 308,
              location: "https://app.example.test/",
              responseTimeMs: 6,
            },
            {
              url: "https://app.example.test/",
              statusCode: 200,
              location: null,
              responseTimeMs: 563,
            },
          ],
        }}
      />,
    )

    expect(screen.getByText("www.app.example.test/")).toBeTruthy()
    expect(screen.getAllByText("app.example.test/").length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText("N/A")).toHaveLength(0)
  })
})
