import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import { TargetsSurface } from "./targets-surface"
import type { TargetsRow } from "./types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

function buildRow(overrides: Partial<TargetsRow> = {}): TargetsRow {
  return {
    canonicalTargetId: "ctg_01J_target_demo",
    target: "https://example.com",
    title: "Example target",
    technologies: ["Next.js"],
    lastScannedAt: {
      iso: "2026-03-23T16:00:12.000Z",
      label: "Mar 23, 2026, 4:00 PM UTC",
    },
    latestScan: {
      scanId: "scn_01J_target_demo",
      href: "/scans/scn_01J_target_demo",
      label: "Open latest scan",
      ariaLabel: "Open latest scan for https://example.com",
    },
    faviconUrl: null,
    ...overrides,
  }
}

describe("TargetsSurface", () => {
  it("renders favicon previews for rows with a valid favicon url", () => {
    const { container } = render(<TargetsSurface rows={[buildRow({ faviconUrl: "https://example.com/favicon.ico" })]} />)

    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute("src", "https://example.com/favicon.ico")
    expect(images[1]).toHaveAttribute("src", "https://example.com/favicon.ico")
  })

  it("falls back to the globe icon when favicon url is missing or invalid", () => {
    const { rerender, container } = render(<TargetsSurface rows={[buildRow({ faviconUrl: null })]} />)

    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelectorAll("svg")).not.toHaveLength(0)

    rerender(<TargetsSurface rows={[buildRow({ faviconUrl: "-1830687435" })]} />)

    expect(container.querySelector("img")).toBeNull()
  })

  describe("history toggle", () => {
    const historyResponse = {
      items: [
        {
          scanId: "scn_history_1",
          status: "completed",
          title: "Previous scan",
          technologies: ["React"],
          submittedAt: "2026-03-20T10:00:00.000Z",
          completedAt: "2026-03-20T10:05:00.000Z",
        },
        {
          scanId: "scn_history_2",
          status: "failed",
          title: "Earlier scan",
          technologies: [],
          submittedAt: "2026-03-19T10:00:00.000Z",
          completedAt: "2026-03-19T10:02:00.000Z",
        },
      ],
    }

    it("shows history button with correct aria-expanded state on desktop", async () => {
      render(<TargetsSurface rows={[buildRow()]} />)

      const buttons = screen.getAllByRole("button", { name: /expand history for https:\/\/example\.com/i })
      const chevronButton = buttons.find((btn) => btn.tagName === "BUTTON" && btn.classList.contains("size-8"))
      expect(chevronButton).toBeInTheDocument()
      expect(chevronButton).toHaveAttribute("aria-expanded", "false")
    })

    it("shows history button with correct aria-expanded state on mobile", async () => {
      render(<TargetsSurface rows={[buildRow()]} />)

      const historyButton = screen.getByRole("button", { name: /show history for https:\/\/example\.com/i })
      expect(historyButton).toBeInTheDocument()
      expect(historyButton).toHaveAttribute("aria-expanded", "false")
    })

    it("loads history when history button is clicked", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => historyResponse,
      })
      vi.stubGlobal("fetch", fetchMock)

      render(<TargetsSurface rows={[buildRow()]} />)

      const historyButtons = screen.getAllByRole("button", { name: /expand history for https:\/\/example\.com/i })
      const chevronButton = historyButtons.find((btn) => btn.classList.contains("size-8")) || historyButtons[0]
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/v1/targets/ctg_01J_target_demo/history?limit=5"
        )
      })

      vi.restoreAllMocks()
    })

    it("displays loaded history items after fetch completes", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => historyResponse,
      })
      vi.stubGlobal("fetch", fetchMock)

      render(<TargetsSurface rows={[buildRow()]} />)

      const historyButtons = screen.getAllByRole("button", { name: /expand history for https:\/\/example\.com/i })
      const chevronButton = historyButtons.find((btn) => btn.classList.contains("size-8")) || historyButtons[0]
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(screen.getByText("Previous scan")).toBeInTheDocument()
        expect(screen.getByText("Earlier scan")).toBeInTheDocument()
      })

      expect(chevronButton).toHaveAttribute("aria-controls")
      expect(document.getElementById(chevronButton.getAttribute("aria-controls") ?? "")).not.toBeNull()

      vi.restoreAllMocks()
    })

    it("collapses history when button is clicked again", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => historyResponse,
      })
      vi.stubGlobal("fetch", fetchMock)

      render(<TargetsSurface rows={[buildRow()]} />)

      const historyButtons = screen.getAllByRole("button", { name: /expand history for https:\/\/example\.com/i })
      const chevronButton = historyButtons.find((btn) => btn.classList.contains("size-8")) || historyButtons[0]

      fireEvent.click(chevronButton)
      await waitFor(() => {
        expect(screen.getByText("Previous scan")).toBeInTheDocument()
      })

      fireEvent.click(chevronButton)
      await waitFor(() => {
        expect(chevronButton).toHaveAttribute("aria-expanded", "false")
      })

      vi.restoreAllMocks()
    })

    it("shows no previous runs message when history is empty", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      })
      vi.stubGlobal("fetch", fetchMock)

      render(<TargetsSurface rows={[buildRow()]} />)

      const historyButtons = screen.getAllByRole("button", { name: /expand history for https:\/\/example\.com/i })
      const chevronButton = historyButtons.find((btn) => btn.classList.contains("size-8")) || historyButtons[0]
      fireEvent.click(chevronButton)

      await waitFor(() => {
        expect(screen.getByText(/no previous scans for this target/i)).toBeInTheDocument()
      })

      vi.restoreAllMocks()
    })

    it("prevents duplicate mobile history fetches while loading", async () => {
      let resolveFetch: ((value: { ok: boolean; json: () => Promise<typeof historyResponse> }) => void) | undefined
      const fetchMock = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
      )
      vi.stubGlobal("fetch", fetchMock)

      render(<TargetsSurface rows={[buildRow()]} />)

      const historyButton = screen.getByRole("button", { name: /show history for https:\/\/example\.com/i })

      fireEvent.click(historyButton)

      await waitFor(() => {
        expect(historyButton).toBeDisabled()
      })

      fireEvent.click(historyButton)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      resolveFetch?.({
        ok: true,
        json: async () => historyResponse,
      })

      await waitFor(() => {
        expect(historyButton).not.toBeDisabled()
      })

      vi.restoreAllMocks()
    })

    it("toggles history when clicking the table row on desktop", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => historyResponse,
      })
      vi.stubGlobal("fetch", fetchMock)

      render(<TargetsSurface rows={[buildRow()]} />)

      const row = screen.getByRole("button", { name: /toggle history for https:\/\/example\.com/i })
      expect(row).toBeInTheDocument()
      expect(row.tagName).toBe("TR")

      fireEvent.click(row)
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/v1/targets/ctg_01J_target_demo/history?limit=5"
        )
      })

      await waitFor(() => {
        expect(screen.getByText("Previous scan")).toBeInTheDocument()
      })

      fireEvent.click(row)
      await waitFor(() => {
        expect(screen.queryByText("Previous scan")).not.toBeInTheDocument()
      })

      vi.restoreAllMocks()
    })

    it("does not toggle history when clicking nested links on the row", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => historyResponse,
      })
      vi.stubGlobal("fetch", fetchMock)

      render(<TargetsSurface rows={[buildRow({ faviconUrl: "https://example.com/favicon.ico" })]} />)

      const links = screen.getAllByRole("link", { name: /open latest scan for https:\/\/example\.com/i })
      const desktopLink = links.find((link) => link.closest(".hidden"))
      if (desktopLink) {
        desktopLink.addEventListener("click", (event) => event.preventDefault())
        fireEvent.click(desktopLink)
      }

      expect(fetchMock).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })
})
