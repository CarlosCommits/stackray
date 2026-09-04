import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  TargetProfileShell,
  type TargetProfileIdentity,
} from "@/components/targets/profile/target-profile-shell"

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  selectedSegment: "changes" as string | null,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigationMocks.push }),
  useSelectedLayoutSegment: () => navigationMocks.selectedSegment,
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

afterEach(() => {
  navigationMocks.push.mockReset()
  vi.unstubAllGlobals()
})

const identity: TargetProfileIdentity = {
  canonicalTargetId: "target-id",
  target: "https://vercel.com",
  inputTarget: "https://vercel.com",
  title: "Vercel",
  faviconUrl: null,
  latestScanId: "scan-id",
  latestScanStatus: "completed",
  lastScannedAt: "2026-07-18T21:33:00.000Z",
  finalUrl: "https://vercel.com",
  statusCode: 200,
  hostIp: "64.29.17.1",
  server: null,
  technologies: [],
  tlsObserved: true,
  canRunScans: true,
  canManageBaseline: true,
}

describe("TargetProfileShell", () => {
  it("selects the Changes tab from the active child route segment", () => {
    const { container } = render(
      <TargetProfileShell identity={identity}>
        <p>Change history content</p>
      </TargetProfileShell>,
    )

    const tabList = screen.getByRole("tablist")

    expect(tabList.parentElement).toHaveClass("sticky", "top-0")
    expect(screen.getByRole("tab", { name: "Changes" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("tab", { name: "Changes" })).toHaveAttribute(
      "href",
      "/targets/target-id/changes",
    )
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("data-state", "inactive")
    expect(screen.getAllByRole("tab")).toHaveLength(4)
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.querySelector('[data-pending="false"]')).toBeInTheDocument()
      expect(document.getElementById(tab.getAttribute("aria-controls") ?? "missing")).toBeInTheDocument()
    }
    expect(screen.getByRole("tab", { name: "Changes" })).toHaveClass(
      "has-data-[pending=true]:text-[var(--accent)]",
    )
    expect(screen.getByText("Change history content")).toBeVisible()
    expect(screen.getByRole("button", { name: "Run scan" })).toBeVisible()
    expect(container.querySelector(".gradient-border-component")).toBeTruthy()
    expect(container.querySelector(".gradient-border-component")).toHaveClass("shrink-0")
    expect(container.querySelector(".gradient-border-component")).not.toHaveClass("ml-16", "self-start")
  })

  it("queues a scan in place and turns the action into a link to the queued scan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ scanId: "queued-scan-id", status: "queued", reused: false }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    ))
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(
      <TargetProfileShell identity={identity}>
        <p>Profile content</p>
      </TargetProfileShell>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Run scan" }))

    const queuedButton = await screen.findByRole("button", { name: "Open queued scan for vercel.com" })
    expect(queuedButton).toHaveTextContent("Queued")
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/scans", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        target: "https://vercel.com",
        options: {
          followRedirects: true,
          includeRawResponse: false,
        },
        client: { source: "ui" },
      }),
    }))
    expect(container.querySelector(".gradient-border-component")?.getAttribute("style")).toContain("--gradient-secondary: #22c55e")

    fireEvent.click(queuedButton)
    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledWith("/scans/queued-scan-id"))
  })
})
