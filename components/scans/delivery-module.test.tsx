import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DeliveryModule } from "@/components/scans/delivery-module"

describe("DeliveryModule", () => {
  it("renders redirect hops with their normalized source urls", () => {
    render(
      <DeliveryModule
        finalUrl="https://vercel.com/"
        path="/"
        method="GET"
        location={null}
        contentType="text/html"
        responseTimeMs={733}
        redirectChain={{
          statusCodes: [308, 200],
          items: [
            {
              url: "https://www.vercel.com",
              statusCode: 308,
              location: "https://vercel.com/",
              responseTimeMs: 6,
            },
            {
              url: "https://vercel.com/",
              statusCode: 200,
              location: null,
              responseTimeMs: 563,
            },
          ],
        }}
      />,
    )

    expect(screen.getByText("www.vercel.com/")).toBeTruthy()
    expect(screen.getAllByText("vercel.com/").length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText("N/A")).toHaveLength(0)
  })
})
