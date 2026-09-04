import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { BaselineSettings } from "@/components/targets/profile/baseline-settings"

const routerMocks = vi.hoisted(() => ({ refresh: vi.fn() }))
const toastMocks = vi.hoisted(() => ({ success: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}))

vi.mock("sonner", () => ({
  toast: toastMocks,
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

beforeEach(() => {
  routerMocks.refresh.mockReset()
  toastMocks.success.mockReset()
  vi.unstubAllGlobals()
})

const options = [
  { id: "scan-current", completedAt: "2026-07-18T21:33:00.000Z" },
  { id: "scan-previous", completedAt: "2026-07-18T18:16:00.000Z" },
]

describe("BaselineSettings", () => {
  it("keeps pinned controls hidden while automatic mode is selected", () => {
    render(
      <BaselineSettings
        targetId="target-id"
        mode="previous"
        pinnedScanId={null}
        options={options}
        canManage
      />,
    )

    expect(screen.getByRole("radio", { name: "Automatic" })).toBeChecked()
    expect(screen.queryByRole("combobox", { name: "Pinned baseline scan" })).toBeNull()
    expect(screen.getByText("Uses the previous completed scan.")).toBeVisible()
    expect(screen.getByText("Only future comparisons and alerts are affected. Historical comparisons remain unchanged.")).toBeVisible()
  })

  it("reveals the scan selector only after pinned mode is selected", () => {
    render(
      <BaselineSettings
        targetId="target-id"
        mode="previous"
        pinnedScanId={null}
        options={options}
        canManage
      />,
    )

    fireEvent.click(screen.getByRole("radio", { name: "Pinned scan" }))

    expect(screen.getByRole("radio", { name: "Pinned scan" })).toBeChecked()
    expect(screen.getByRole("combobox", { name: "Pinned baseline scan" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Save pinned scan" })).toBeEnabled()

    fireEvent.click(screen.getByRole("radio", { name: "Automatic" }))

    expect(screen.queryByRole("combobox", { name: "Pinned baseline scan" })).toBeNull()
  })

  it("saves automatic mode after switching away from a pinned baseline", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <BaselineSettings
        targetId="target-id"
        mode="pinned"
        pinnedScanId="scan-current"
        options={options}
        canManage
      />,
    )

    fireEvent.click(screen.getByRole("radio", { name: "Automatic" }))
    fireEvent.click(screen.getByRole("button", { name: "Save automatic baseline" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/targets/target-id/monitoring-baseline",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ mode: "previous" }),
        }),
      )
      expect(routerMocks.refresh).toHaveBeenCalledOnce()
      expect(toastMocks.success).toHaveBeenCalledWith("Automatic baseline saved", {
        description: "Future scans will compare with the previous completed scan.",
      })
    })
  })

  it("confirms when a pinned baseline is saved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    render(
      <BaselineSettings
        targetId="target-id"
        mode="previous"
        pinnedScanId={null}
        options={options}
        canManage
      />,
    )

    fireEvent.click(screen.getByRole("radio", { name: "Pinned scan" }))
    fireEvent.click(screen.getByRole("button", { name: "Save pinned scan" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/targets/target-id/monitoring-baseline",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ mode: "pinned", scanId: "scan-current" }),
        }),
      )
      expect(routerMocks.refresh).toHaveBeenCalledOnce()
      expect(toastMocks.success).toHaveBeenCalledWith("Pinned baseline saved", {
        description: "Future scans will compare with the selected scan.",
      })
    })
  })
})
