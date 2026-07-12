import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { TechnologyCompareClient } from "./technology-compare-client"
import type { TechnologyComparisonItem } from "@/lib/contracts/targets"

const toPngMock = vi.fn(async (...args: unknown[]) => {
  void args
  return "data:image/png;base64,stackray"
})
const toBlobMock = vi.fn(async (...args: unknown[]) => {
  void args
  return new Blob(["stackray"], { type: "image/png" })
})

vi.mock("html-to-image", () => ({
  toBlob: (...args: unknown[]) => toBlobMock(...args),
  toPng: (...args: unknown[]) => toPngMock(...args),
  toSvg: async () => "data:image/svg+xml;charset=utf-8,<svg/>",
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

const comparisonItem: TechnologyComparisonItem = {
  canonicalTargetId: "ctg_vercel",
  normalizedTarget: "https://app.example.test",
  latestScanId: "scn_vercel",
  title: "Vercel: Build and deploy web experiences",
  technologies: ["Next.js", "React", "Vercel"],
  matchedTechnology: "Next.js",
  matchedTechnologyIconUrl: "https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/images/icons/Next.js.svg",
  matchedTechnologies: [{
    name: "Next.js",
    iconUrl: "https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/images/icons/Next.js.svg",
  }],
  lastScannedAt: "2026-03-22T08:30:00.000Z",
  faviconUrl: "/api/v1/scans/scn_vercel/results/res_vercel/favicon",
  screenshotUrl: "/api/v1/scans/scn_vercel/results/res_vercel/screenshot?inline=1",
}

const technologyOptions = [
  {
    name: "Next.js",
    iconUrl: "https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/images/icons/Next.js.svg",
    matchCount: 1,
  },
  {
    name: "React",
    iconUrl: "https://raw.githubusercontent.com/enthec/webappanalyzer/main/src/images/icons/React.svg",
    matchCount: 1,
  },
]

const stripeComparisonItem: TechnologyComparisonItem = {
  ...comparisonItem,
  canonicalTargetId: "ctg_stripe",
  normalizedTarget: "https://payments.example.test",
  latestScanId: "scn_stripe",
  title: "Stripe financial infrastructure",
  faviconUrl: "https://payments.example.test/favicon.ico",
  screenshotUrl: "/api/v1/scans/scn_stripe/results/res_stripe/screenshot?inline=1",
}

beforeEach(() => {
  toPngMock.mockClear()
  toBlobMock.mockClear()
  window.sessionStorage.clear()
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.startsWith("/api/v1/targets/technology-options")) {
      return {
        ok: true,
        json: async () => ({ items: technologyOptions }),
      } satisfies Partial<Response>
    }

    return {
      ok: true,
      json: async () => ({
        technology: "Next.js",
        technologies: ["Next.js"],
        items: [comparisonItem],
      }),
    } satisfies Partial<Response>
  }))

  vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined)
})

function mockMobileExportViewport(isMobile: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
    matches: query === "(max-width: 767px)" ? isMobile : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("TechnologyCompareClient", () => {
  it("searches for a technology and renders matching site cards", async () => {
    render(<TechnologyCompareClient />)

    fireEvent.change(screen.getByLabelText("Technology"), { target: { value: "Next" } })
    fireEvent.click(await screen.findByRole("option", { name: /Next\.js/ }))

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    expect(screen.getAllByText("app.example.test").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Next.js").length).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/targets/technology-comparison?technology=Next.js",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it("supports selecting multiple technologies with repeated query params", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith("/api/v1/targets/technology-options")) {
        return {
          ok: true,
          json: async () => ({ items: technologyOptions }),
        } as Response
      }

      const searchParams = new URL(url, "http://localhost").searchParams
      const technologies = searchParams.getAll("technology")

      return {
        ok: true,
        json: async () => ({
          technology: technologies[0] ?? "",
          technologies,
          items: [{
            ...comparisonItem,
            matchedTechnology: technologies[0] ?? comparisonItem.matchedTechnology,
            matchedTechnologyIconUrl: technologyOptions.find((option) => option.name === technologies[0])?.iconUrl ?? null,
            matchedTechnologies: technologies.map((technology) => ({
              name: technology,
              iconUrl: technologyOptions.find((option) => option.name === technology)?.iconUrl ?? null,
            })),
          }],
        }),
      } as Response
    })

    render(<TechnologyCompareClient />)

    fireEvent.change(screen.getByLabelText("Technology"), { target: { value: "Next" } })
    fireEvent.click(await screen.findByRole("option", { name: /Next\.js/ }))
    fireEvent.change(screen.getByLabelText("Technology"), { target: { value: "React" } })
    fireEvent.click(await screen.findByRole("option", { name: /React/ }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/targets/technology-comparison?technology=Next.js&technology=React",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/technology-compare?technology=Next.js&technology=React",
    )
    expect(screen.getAllByText("Next.js").length).toBeGreaterThan(0)
    expect(screen.getAllByText("React").length).toBeGreaterThan(0)
  })

  it("clears all selected technologies from the selector", async () => {
    render(<TechnologyCompareClient initialTechnologies={["Next.js", "React"]} />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Select technologies to compare" })).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Included sites" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Export PNG" })).not.toBeInTheDocument()
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/technology-compare")
  })

  it("starts a comparison from a quick-start chip on the empty state", async () => {
    render(<TechnologyCompareClient />)

    const quickStartChip = await screen.findByRole("button", { name: /^Next\.js$/ })
    fireEvent.click(quickStartChip)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/targets/technology-comparison?technology=Next.js",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(window.history.replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/technology-compare?technology=Next.js",
    )
  })

  it("restores the last comparison when returning without query params", async () => {
    window.sessionStorage.setItem("stackray:technology-compare:v1", JSON.stringify({
      technologies: ["Next.js"],
      selectedExportIds: ["ctg_vercel"],
      exportStyle: "aurora",
      siteFilter: "ver",
    }))

    render(<TechnologyCompareClient />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/targets/technology-comparison?technology=Next.js",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
    expect(window.history.replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/technology-compare?technology=Next.js",
    )
    expect(await screen.findByText("1 included")).toBeInTheDocument()
    expect(screen.getByLabelText("Filter included sites")).toHaveValue("ver")
  })

  it("does not restore an empty export selection caused by a failed comparison request", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith("/api/v1/targets/technology-options")) {
        return {
          ok: true,
          json: async () => ({ items: technologyOptions }),
        } as Response
      }

      return {
        ok: false,
      } as Response
    })

    const { unmount } = render(<TechnologyCompareClient initialTechnology="Next.js" />)

    expect(await screen.findByText("Comparison failed")).toBeInTheDocument()
    await waitFor(() => {
      expect(JSON.parse(window.sessionStorage.getItem("stackray:technology-compare:v1") ?? "{}"))
        .toMatchObject({
          technologies: ["Next.js"],
          selectedExportIds: [],
          restoreExportSelection: false,
        })
    })

    unmount()

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith("/api/v1/targets/technology-options")) {
        return {
          ok: true,
          json: async () => ({ items: technologyOptions }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          technology: "Next.js",
          technologies: ["Next.js"],
          items: [comparisonItem],
        }),
      } as Response
    })

    render(<TechnologyCompareClient />)

    expect(await screen.findByText("1 included")).toBeInTheDocument()
    expect(screen.getByAltText("app.example.test screenshot")).toBeInTheDocument()
  })

  it("uses one inclusion control for the board and export", async () => {
    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("checkbox", { name: "Include app.example.test" }))

    expect(screen.getByText("0 included")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByAltText("app.example.test screenshot")).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("checkbox", { name: "Include app.example.test" }))

    expect(screen.getByText("1 included")).toBeInTheDocument()
    expect(screen.getByAltText("app.example.test screenshot")).toBeInTheDocument()
  })

  it("links site cards to the target's latest scan", async () => {
    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    expect(await screen.findByRole("link", { name: "Open latest scan for app.example.test" }))
      .toHaveAttribute("href", "/scans/scn_vercel")
  })

  it("filters the included sites list without changing export selection", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith("/api/v1/targets/technology-options")) {
        return {
          ok: true,
          json: async () => ({ items: technologyOptions }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          technology: "Next.js",
          technologies: ["Next.js"],
          items: [comparisonItem, stripeComparisonItem],
        }),
      } as Response
    })

    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("2 included")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText("Filter included sites"), { target: { value: "stripe" } })

    expect(screen.getByLabelText("Include payments.example.test")).toBeInTheDocument()
    expect(screen.queryByLabelText("Include app.example.test")).not.toBeInTheDocument()
    expect(screen.getByText("2 included")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clear site filter" }))

    expect(screen.getByLabelText("Include app.example.test")).toBeInTheDocument()
    expect(screen.getByLabelText("Include payments.example.test")).toBeInTheDocument()
  })

  it("shows a no-results state for an empty comparison response", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith("/api/v1/targets/technology-options")) {
        return {
          ok: true,
          json: async () => ({ items: technologyOptions }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          technology: "Angular",
          technologies: ["Angular"],
          items: [],
        }),
      } as Response
    })

    render(<TechnologyCompareClient initialTechnology="Angular" />)

    expect(await screen.findByText("No matching sites")).toBeInTheDocument()
  })

  it("exports the visible board as a PNG", async () => {
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }))
    document.querySelectorAll("img").forEach((image) => fireEvent.load(image))

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalled()
      expect(clickMock).toHaveBeenCalled()
    })
    const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
    expect(frameElement.dataset.technologyExportFrame).toBe("desktop-capture")
    expect(frameElement.dataset.exportRasterSafe).toBeUndefined()
    expect(frameElement.className).toContain("shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]")
    expect(frameElement.className).not.toMatch(/shadow-\[0_\d+px_\d+px/)
    expect(toPngMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ includeQueryParams: true }),
    )

    clickMock.mockRestore()
  })

  it("includes the Stackray mark in comparison exports by default", async () => {
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }))
    document.querySelectorAll("img").forEach((image) => fireEvent.load(image))

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalled()
    })

    const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
    const brand = frameElement.querySelector("[data-stackray-export-brand]")
    expect(brand).toHaveTextContent("Detected by stackray.app")

    clickMock.mockRestore()
  })

  it("removes the Stackray mark from comparison exports when toggled off outside demo mode", async () => {
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Options" })[0])
    fireEvent.click(screen.getByRole("switch", { name: "Toggle Stackray mark" }))

    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }))
    document.querySelectorAll("img").forEach((image) => fireEvent.load(image))

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalled()
    })

    const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
    expect(frameElement.querySelector("[data-stackray-export-brand]")).toBeNull()

    clickMock.mockRestore()
  })

  it("requires the Stackray mark in comparison exports in demo mode", async () => {
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    render(<TechnologyCompareClient initialTechnology="Next.js" demoMode />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Options" })[0])
    const brandSwitch = screen.getByRole("switch", { name: "Toggle Stackray mark" })
    expect(brandSwitch).toBeChecked()
    expect(brandSwitch).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }))
    document.querySelectorAll("img").forEach((image) => fireEvent.load(image))

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalled()
    })

    const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
    const brand = frameElement.querySelector("[data-stackray-export-brand]")
    expect(brand).toHaveTextContent("Detected by stackray.app")

    clickMock.mockRestore()
  })

  it("forces the Stackray mark in demo mode even when the persisted preference is off", async () => {
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    window.sessionStorage.setItem("stackray:technology-compare:v1", JSON.stringify({
      technologies: ["Next.js"],
      selectedExportIds: [comparisonItem.canonicalTargetId],
      restoreExportSelection: true,
      exportStyle: "stackray",
      exportBrandVisible: false,
      siteFilter: "",
    }))

    render(<TechnologyCompareClient initialTechnology="Next.js" demoMode />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }))
    document.querySelectorAll("img").forEach((image) => fireEvent.load(image))

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalled()
    })

    const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
    const brand = frameElement.querySelector("[data-stackray-export-brand]")
    expect(brand).toHaveTextContent("Detected by stackray.app")

    clickMock.mockRestore()
  })

  it("shows style and brand controls in the export options popover", async () => {
    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Options" })[0])

    expect(screen.queryByText("Canvas")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Wide" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Square" })).not.toBeInTheDocument()
    expect(screen.getByRole("radiogroup", { name: "Export style" })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Toggle Stackray mark" })).toBeInTheDocument()
  })

  it("uses raster-safe capture styling for mobile comparison exports", async () => {
    mockMobileExportViewport(true)
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }))
    document.querySelectorAll("img").forEach((image) => fireEvent.load(image))

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalled()
      expect(clickMock).toHaveBeenCalled()
    })

    const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
    expect(frameElement.dataset.technologyExportFrame).toBe("desktop-capture")
    expect(frameElement.dataset.exportRasterSafe).toBe("true")
    expect(frameElement.querySelector("[data-technology-compare-export-card]")).toBeInTheDocument()
    expect(frameElement.querySelector("[data-technology-compare-export-card-inner]")).toBeInTheDocument()

    clickMock.mockRestore()
  })

  it("shrinks export frames to two columns when two sites are included", async () => {
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith("/api/v1/targets/technology-options")) {
        return {
          ok: true,
          json: async () => ({ items: technologyOptions }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          technology: "Next.js",
          technologies: ["Next.js"],
          items: [comparisonItem, stripeComparisonItem],
        }),
      } as Response
    })

    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("2 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }))
    document.querySelectorAll("img").forEach((image) => fireEvent.load(image))

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalled()
      expect(clickMock).toHaveBeenCalled()
    })

    const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
    expect(frameElement.dataset.technologyExportColumns).toBe("2")
    expect(frameElement.className).toContain("w-[704px]")
    expect(frameElement.className).not.toContain("w-[1040px]")

    clickMock.mockRestore()
  })

  it("shows progress and success states while copying the export", async () => {
    let resolveBlob: (blob: Blob) => void = () => undefined
    const clipboardWriteMock = vi.fn(async () => undefined)
    toBlobMock.mockImplementationOnce(() => new Promise<Blob>((resolve) => {
      resolveBlob = resolve
    }))
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { write: clipboardWriteMock },
    })
    vi.stubGlobal("ClipboardItem", class ClipboardItem {
      constructor(items: Record<string, Blob | Promise<Blob>>) {
        void items
      }
    })

    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    document.querySelectorAll("img").forEach((image) => fireEvent.load(image))

    expect(await screen.findByRole("button", { name: "Copying" })).toBeDisabled()

    await act(async () => {
      resolveBlob(new Blob(["stackray"], { type: "image/png" }))
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument()
      expect(clipboardWriteMock).toHaveBeenCalled()
    })
    expect((toBlobMock.mock.calls[0]?.[0] as HTMLElement).dataset.technologyExportFrame).toBe("desktop-capture")
  })

  it("uses same-origin image URLs inside the export frame", async () => {
    render(<TechnologyCompareClient initialTechnology="Next.js" />)

    await waitFor(() => {
      expect(screen.getByText("1 included")).toBeInTheDocument()
    })

    const imageSrcs = Array.from(document.querySelectorAll("img")).map((image) => image.getAttribute("src") ?? "")

    expect(imageSrcs).toContain("/api/v1/scans/scn_vercel/results/res_vercel/screenshot?inline=1")
    expect(imageSrcs).toContain(
      "/api/v1/scans/scn_vercel/results/res_vercel/favicon",
    )
    expect(imageSrcs).toContain(
      "/api/v1/image-proxy?url=https%3A%2F%2Fraw.githubusercontent.com%2Fenthec%2Fwebappanalyzer%2Fmain%2Fsrc%2Fimages%2Ficons%2FNext.js.svg",
    )
  })
})
