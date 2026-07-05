import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { ApiKeysPageClient } from "@/components/settings/api-keys/api-keys-page-client"
import { STACKRAY_RAILWAY_TEMPLATE_URL } from "@/components/demo/demo-deployment-cta"
import { DEMO_MOCK_API_KEYS } from "@/lib/demo-mode-data"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

describe("ApiKeysPageClient", () => {
  it("shows mock API keys and Railway CTA in demo mode", () => {
    render(<ApiKeysPageClient initialApiKeys={DEMO_MOCK_API_KEYS} demoMode />)

    expect(screen.getAllByText("OpenClaw key")[0]!).toBeInTheDocument()
    expect(screen.getAllByText("Hermes key")[0]!).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Revoke OpenClaw key" })[0]!).toBeDisabled()
    expect(screen.getAllByRole("button", { name: "Revoke Hermes key" })[0]!).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Create API key" }))

    expect(screen.getByRole("heading", { name: "API keys need your own deployment" })).toBeInTheDocument()
    expect(screen.getByText(/create bearer keys for agents, scripts, and private automation/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Launch on Railway" })).toHaveAttribute(
      "href",
      STACKRAY_RAILWAY_TEMPLATE_URL,
    )
  })
})
