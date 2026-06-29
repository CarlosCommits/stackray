import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { DomainInfoSection } from "@/components/scans/scan-detail/domain-info"
import { PageTitleCard, ScanDetailHeader, ScanOverviewBand, getScanPhaseConnectorClassName } from "@/components/scans/scan-detail/header"
import { RedirectChainCard } from "@/components/scans/scan-detail/scan-info-cards"
import { resolveFaviconPreviewSrc } from "@/components/scans/scan-detail/shared"
import { SubdomainsSectionCard } from "@/components/scans/scan-detail/subdomains"
import { ScanDetailSectionTabs } from "@/components/scans/scan-detail/tabs"
import { TechnologiesSection } from "@/components/scans/scan-detail/technologies"
import { TechnologyCardFrame } from "@/components/scans/scan-detail/technology-card-frame"
import type { TechnologyTableRow } from "@/components/scans/scan-detail/technologies"
import { TlsCertificateSection } from "@/components/scans/scan-detail/tls-fingerprints"
import { TooltipProvider } from "@/components/ui/tooltip"
import { buildStructuredTechnologyDetection } from "@/lib/server/scans/technology-metadata-catalog"

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

const toPngMock = vi.fn(async (node: HTMLElement, options?: unknown) => {
  void node
  void options
  return "data:image/png;base64,stackray"
})
const toBlobMock = vi.fn(async (node: HTMLElement, options?: unknown) => {
  void node
  void options
  return new Blob(["stackray"], { type: "image/png" })
})

vi.mock("html-to-image", () => ({
  toBlob: (node: HTMLElement, options?: unknown) => toBlobMock(node, options),
  toPng: (node: HTMLElement, options?: unknown) => toPngMock(node, options),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerMocks.push,
  }),
}))

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  toPngMock.mockClear()
  toBlobMock.mockClear()
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
  routerMocks.push.mockReset()
  vi.restoreAllMocks()
})

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function buildPhase(status: Parameters<typeof getScanPhaseConnectorClassName>[0]["status"]) {
  return {
    phaseId: `phase-${status}`,
    scanId: "scan-1",
    attemptId: "attempt-1",
    resultId: "result-1",
    phase: "headless",
    status,
    errorCode: null,
    errorMessage: null,
    meta: {},
    queuedAt: "2026-03-27T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-03-27T00:00:00.000Z",
  } satisfies Parameters<typeof getScanPhaseConnectorClassName>[0]
}

describe("resolveFaviconPreviewSrc", () => {
  it("returns local path from url when available", () => {
    const result = resolveFaviconPreviewSrc({
      url: "/favicons/example.com.png",
      path: null,
    })
    expect(result).toBe("/favicons/example.com.png")
  })

  it("returns absolute HTTP URL from url when available", () => {
    const result = resolveFaviconPreviewSrc({
      url: "https://example.com/favicon.ico",
      path: null,
    })
    expect(result).toBe("https://example.com/favicon.ico")
  })

  it("returns local path from path when url is not valid", () => {
    const result = resolveFaviconPreviewSrc({
      url: null,
      path: "/favicons/backup.png",
    })
    expect(result).toBe("/favicons/backup.png")
  })

  it("returns absolute HTTP URL from path when url is not valid", () => {
    const result = resolveFaviconPreviewSrc({
      url: null,
      path: "https://cdn.example.com/icon.png",
    })
    expect(result).toBe("https://cdn.example.com/icon.png")
  })

  it("prefers url over path when both are valid local paths", () => {
    const result = resolveFaviconPreviewSrc({
      url: "/favicons/primary.png",
      path: "/favicons/backup.png",
    })
    expect(result).toBe("/favicons/primary.png")
  })

  it("returns null for hash-only values (invalid src)", () => {
    const result = resolveFaviconPreviewSrc({
      url: "-1830687435",
      path: null,
    })
    expect(result).toBeNull()
  })

  it("returns null for empty strings", () => {
    const result = resolveFaviconPreviewSrc({
      url: "",
      path: "",
    })
    expect(result).toBeNull()
  })

  it("returns null for null values", () => {
    const result = resolveFaviconPreviewSrc({
      url: null,
      path: null,
    })
    expect(result).toBeNull()
  })

  it("returns null for undefined values", () => {
    const result = resolveFaviconPreviewSrc({
      url: undefined,
      path: undefined,
    })
    expect(result).toBeNull()
  })

  it("returns null for non-HTTP URLs", () => {
    const result = resolveFaviconPreviewSrc({
      url: "ftp://example.com/favicon.ico",
      path: null,
    })
    expect(result).toBeNull()
  })

  it("handles mixed case HTTP URLs", () => {
    const result = resolveFaviconPreviewSrc({
      url: "HTTPS://Example.COM/favicon.ico",
      path: null,
    })
    expect(result).toBe("HTTPS://Example.COM/favicon.ico")
  })

  it("prefers same-origin proxy URL when available", () => {
    const result = resolveFaviconPreviewSrc({
      proxyUrl: "/api/v1/scans/scan_01/results/res_01/favicon",
      url: "https://example.com/favicon.ico",
      path: null,
    })
    expect(result).toBe("/api/v1/scans/scan_01/results/res_01/favicon")
  })
})

describe("getScanPhaseConnectorClassName", () => {
  it("keeps connectors green through skipped phases", () => {
    expect(getScanPhaseConnectorClassName(buildPhase("completed"), buildPhase("skipped"))).toContain("emerald")
    expect(getScanPhaseConnectorClassName(buildPhase("skipped"), buildPhase("completed"))).toContain("emerald")
  })

  it("preserves failure colors for failed connectors", () => {
    expect(getScanPhaseConnectorClassName(buildPhase("completed"), buildPhase("failed"))).toContain("red")
  })
})

describe("PageTitleCard", () => {
  it("renders title and final URL", () => {
    render(<PageTitleCard title="Example Site" finalUrl="https://example.com" />)

    expect(screen.getByText("Page Title")).toBeTruthy()
    expect(screen.getByText("Example Site")).toBeTruthy()
    expect(screen.getByText("Final URL")).toBeTruthy()
    expect(screen.getByText("https://example.com")).toBeTruthy()

    const img = document.querySelector("img")
    expect(img).toBeNull()
  })
})

describe("ScanDetailSectionTabs", () => {
  it("renders a selected section tab panel", () => {
    render(
      <ScanDetailSectionTabs
        items={[
          {
            value: "technologies",
            label: "Technologies",
            content: <div>Technology content</div>,
          },
          {
            value: "dnsInfrastructure",
            label: "DNS & Network",
            content: <div>DNS content</div>,
          },
        ]}
      />,
    )

    expect(screen.getByRole("tab", { name: /technologies/i })).toHaveAttribute("data-state", "active")
    expect(screen.getByText("Technology content")).toBeVisible()
    expect(screen.queryByText("DNS content")).not.toBeInTheDocument()
  })
})

describe("ScanDetailHeader", () => {
  it("renders favicon image for valid remote URL", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={{ url: "https://example.com/favicon.ico", path: null }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeTruthy()
    expect(img?.getAttribute("src")).toBe("https://example.com/favicon.ico")
    expect(img?.getAttribute("width")).toBe("40")
    expect(img?.getAttribute("height")).toBe("40")
  })

  it("renders page title and final URL context in the header", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={null}
        pageTitle="Example Site"
        finalUrl="https://www.example.com/"
      />,
    )

    expect(screen.getByText("Page title")).toBeTruthy()
    expect(screen.getByText("Example Site")).toBeTruthy()
    expect(screen.getByText("Final URL")).toBeTruthy()
    expect(screen.getByRole("link", { name: "https://www.example.com/" })).toHaveAttribute("href", "https://www.example.com/")
  })

  it("renders favicon image for valid local path", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={{ url: null, path: "/favicons/example.com.png" }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeTruthy()
    const dataSrc = img?.getAttribute("data-src")
    const src = img?.getAttribute("src")
    expect(dataSrc === "/favicons/example.com.png" || src?.includes("favicons")).toBe(true)
  })

  it("does not render favicon for hash-only value (invalid src bug)", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={{ url: "-1830687435", path: null }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeNull()
    expect(document.querySelector("svg.lucide-globe")).toBeTruthy()
  })

  it("prefers url over path when both are available", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={{
          url: "https://cdn.example.com/favicon.ico",
          path: "/favicons/local.png",
        }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeTruthy()
    expect(img?.getAttribute("src")).toBe("https://cdn.example.com/favicon.ico")
  })

  it("prefers the favicon proxy over direct remote URLs", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={{
          proxyUrl: "/api/v1/scans/scan_01/results/res_01/favicon",
          url: "https://cdn.example.com/favicon.ico",
          path: "/favicons/local.png",
        }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeTruthy()
    expect(img?.getAttribute("src")).toBe("/api/v1/scans/scan_01/results/res_01/favicon")
  })

  it("falls back to a globe when the proxied favicon fails to load", async () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={{ url: "https://example.com/favicon.ico", path: null }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeTruthy()
    if (!img) {
      throw new Error("Expected favicon image to be rendered.")
    }

    fireEvent.error(img)

    await waitFor(() => {
      expect(document.querySelector("img")).toBeNull()
    })
    expect(document.querySelector("svg.lucide-globe")).toBeTruthy()
  })

  it("handles null favicon prop gracefully", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={null}
      />,
    )

    expect(screen.getByText("example.com")).toBeTruthy()

    const img = document.querySelector("img")
    expect(img).toBeNull()
  })

  it("renders overview metrics in the screenshot response rail", () => {
    renderWithTooltip(
      <ScanOverviewBand
        content={{
          bodyPreview: "",
          contentLength: 0,
          bodyDomains: [],
          bodyFqdns: [],
          screenshot: {
            available: false,
            path: null,
            contentType: null,
            byteSize: null,
            capturedAt: null,
          },
          robotsTxt: null,
        }}
        target="https://example.com"
        phases={[]}
        overview={{
          statusCode: 200,
          statusText: "OK",
          redirectCount: 1,
          server: "Pantheon",
          cdnName: "Fastly",
          hostIp: "23.185.0.253",
          asnOrg: "FASTLY - Fastly, Inc.",
          title: "Example Site",
          finalUrl: "https://example.com",
          responseTimeMs: 128,
          contentType: "text/html",
          contentLength: 4096,
        }}
      />,
    )

    expect(screen.getByText("200 OK")).toBeTruthy()
    expect(screen.getByText("Success")).toBeTruthy()
    expect(screen.getByText("Redirects")).toBeTruthy()
    expect(screen.getByText("1 hop")).toBeTruthy()
    expect(screen.getByText("Pantheon")).toBeTruthy()
    expect(screen.getByText("Fastly")).toBeTruthy()
    expect(screen.getByText("23.185.0.253")).toBeTruthy()
  })

  it("preserves the full overview screenshot instead of cropping it", async () => {
    renderWithTooltip(
      <ScanOverviewBand
        content={{
          bodyPreview: "",
          contentLength: 0,
          bodyDomains: [],
          bodyFqdns: [],
          screenshot: {
            available: true,
            path: "/api/v1/scans/test/results/test/screenshot",
            contentType: "image/webp",
            byteSize: 1024,
            capturedAt: "2026-03-27T00:00:00.000Z",
          },
          robotsTxt: null,
        }}
        target="https://example.com"
        phases={[]}
        overview={null}
      />,
    )

    const screenshot = screen.getByAltText("Homepage screenshot for https://example.com")
    const frame = screenshot.closest("div")

    expect(screenshot).toHaveClass("object-contain")
    expect(screenshot).not.toHaveClass("object-cover")
    expect(frame).toBeTruthy()

    Object.defineProperty(screenshot, "naturalWidth", { configurable: true, value: 1024 })
    Object.defineProperty(screenshot, "naturalHeight", { configurable: true, value: 511 })
    fireEvent.load(screenshot)

    await waitFor(() => {
      expect(frame).toHaveStyle({ aspectRatio: "1024 / 511" })
    })
  })

  it("renders tappable phase dots with popover details", async () => {
    renderWithTooltip(
      <ScanOverviewBand
        content={{
          bodyPreview: "",
          contentLength: 0,
          bodyDomains: [],
          bodyFqdns: [],
          screenshot: {
            available: false,
            path: null,
            contentType: null,
            byteSize: null,
            capturedAt: null,
          },
          robotsTxt: null,
        }}
        target="https://example.com"
        phases={[
          {
            phaseId: "phase-http",
            scanId: "scan-1",
            attemptId: "attempt-1",
            resultId: "result-1",
            phase: "http_probe",
            status: "completed",
            errorCode: null,
            errorMessage: null,
            meta: {},
            queuedAt: "2026-03-27T00:00:00.000Z",
            startedAt: "2026-03-27T00:00:01.000Z",
            completedAt: "2026-03-27T00:00:02.000Z",
            updatedAt: "2026-03-27T00:00:02.000Z",
          },
          {
            phaseId: "phase-headless",
            scanId: "scan-1",
            attemptId: "attempt-1",
            resultId: "result-1",
            phase: "headless",
            status: "queued",
            errorCode: null,
            errorMessage: null,
            meta: {},
            queuedAt: "2026-03-27T00:00:03.000Z",
            startedAt: null,
            completedAt: null,
            updatedAt: "2026-03-27T00:00:03.000Z",
          },
        ]}
        overview={null}
      />,
    )

    fireEvent.click(screen.getAllByRole("button", { name: "HTTP probe completed" })[0])

    await waitFor(() => {
      expect(screen.getByText("Step")).toBeTruthy()
      expect(screen.getByText("Started")).toBeTruthy()
      expect(screen.getByText("Completed")).toBeTruthy()
    })
  })

  it("renders browser recovery reason and outcome in the phase popover", async () => {
    renderWithTooltip(
      <ScanOverviewBand
        content={{
          bodyPreview: "",
          contentLength: 0,
          bodyDomains: [],
          bodyFqdns: [],
          screenshot: {
            available: true,
            path: "/api/v1/scans/scan-1/results/result-1/screenshot",
            contentType: "image/png",
            byteSize: 1234,
            capturedAt: "2026-03-27T00:00:10.000Z",
          },
          robotsTxt: null,
        }}
        target="https://app.example.test"
        phases={[
          {
            phaseId: "phase-browser-recovery",
            scanId: "scan-1",
            attemptId: "attempt-1",
            resultId: "result-1",
            phase: "browser_fallback",
            status: "completed",
            errorCode: null,
            errorMessage: null,
            meta: {
              outcome: "recovered",
              recovered: true,
              decision: {
                reason: "headless_screenshot_missing",
                confidence: "recovery",
                shouldRun: true,
                signals: ["headless_screenshot_missing"],
              },
              triggerOptions: {
                headlessFailed: false,
                headlessScreenshotMissing: true,
              },
            },
            queuedAt: "2026-03-27T00:00:03.000Z",
            startedAt: "2026-03-27T00:00:04.000Z",
            completedAt: "2026-03-27T00:00:09.000Z",
            updatedAt: "2026-03-27T00:00:09.000Z",
          },
        ]}
        overview={null}
      />,
    )

    expect(screen.queryByText("Headless screenshot missing")).toBeNull()
    expect(screen.queryByText("Recovered")).toBeNull()

    fireEvent.click(screen.getAllByRole("button", { name: "Browser recovery completed" })[0])

    await waitFor(() => {
      expect(screen.getByText("Headless screenshot missing")).toBeTruthy()
      expect(screen.getByText("Recovered")).toBeTruthy()
    })
  })

  it("truncates the linked target label", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://very-long-subdomain-name.example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={null}
      />,
    )

    const targetLink = screen.getByRole("link", { name: "very-long-subdomain-name.example.com" })
    expect(targetLink).toHaveAttribute("href", "https://very-long-subdomain-name.example.com")
    expect(targetLink.querySelector("h1")?.className).toContain("truncate")
  })

  it("abbreviates known hosted providers in the screenshot response rail", () => {
    renderWithTooltip(
      <ScanOverviewBand
        content={{
          bodyPreview: "",
          contentLength: 0,
          bodyDomains: [],
          bodyFqdns: [],
          screenshot: {
            available: false,
            path: null,
            contentType: null,
            byteSize: null,
            capturedAt: null,
          },
          robotsTxt: null,
        }}
        target="https://very-long-subdomain-name.example.com"
        phases={[]}
        overview={{
          statusCode: 200,
          statusText: "OK",
          redirectCount: 0,
          server: "Amazon Web Services",
          cdnName: "",
          hostIp: "198.51.100.1",
          asnOrg: "AMAZON-02 - Amazon.com, Inc.",
          title: "Example Site",
          finalUrl: "https://very-long-subdomain-name.example.com",
          responseTimeMs: 128,
          contentType: "text/html",
          contentLength: 4096,
        }}
      />,
    )

    expect(screen.getByText("AWS")).toBeTruthy()
    expect(screen.queryByText("Amazon Web Services")).toBeNull()
    expect(screen.getByText("AWS").getAttribute("title")).toBe("Amazon Web Services")
  })

  it("renders plain img element for remote URLs with safe attributes", () => {
    renderWithTooltip(
      <ScanDetailHeader
        target="https://example.com"
        status="completed"
        submittedAt="2026-03-27T00:00:00.000Z"
        currentAttempt={null}
        attemptHistory={[]}
        favicon={{ url: "https://example.com/favicon.ico", path: null }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeTruthy()
    expect(img?.getAttribute("loading")).toBe("lazy")
    expect(img?.getAttribute("decoding")).toBe("async")
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer")
  })
})

describe("TechnologiesSection", () => {
  it("renders non-empty technology buckets", () => {
    render(
      <TechnologiesSection
        technology={{
          buckets: [
            {
              id: "platform",
              label: "Platform",
              items: [buildStructuredTechnologyDetection({ name: "WordPress", version: null, sources: ["wappalyzer"], inferred: false })],
            },
            {
              id: "business",
              label: "Business Tools",
              items: [buildStructuredTechnologyDetection({ name: "Google Analytics", version: null, sources: ["derived"], inferred: true })],
            },
          ],
          nucleiTechnologies: [],
          cpeEntries: [],
          totalCount: 2,
        }}
      />,
    )

    expect(screen.queryByText("Technologies detected")).toBeNull()
    expect(screen.getByPlaceholderText("Search technologies...")).toBeTruthy()
    expect(screen.getByRole("searchbox", { name: "Search technologies" })).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Business Tools").length).toBeGreaterThan(0)
    expect(screen.getByText("WordPress")).toBeTruthy()
    expect(screen.getByText("Google Analytics")).toBeTruthy()
  })

  it("opens technology metadata on click", async () => {
    render(
      <TechnologiesSection
        technology={{
          buckets: [
            {
              id: "platform",
              label: "Platform",
              items: [buildStructuredTechnologyDetection({ name: "WordPress", version: null, sources: ["wappalyzer"], inferred: false })],
            },
          ],
          nucleiTechnologies: [],
          cpeEntries: [],
          totalCount: 1,
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "WordPress technology details" }))

    await waitFor(() => {
      expect(screen.getByText(/Source/)).toBeTruthy()
      expect(screen.getByText("Wappalyzer")).toBeTruthy()
    })
  })

  it("renders CPE versions in scan technology rows", () => {
    render(
      <TechnologiesSection
        technology={{
          buckets: [],
          nucleiTechnologies: [],
          cpeEntries: [
            {
              cpe: "cpe:2.3:a:nginx:nginx:1.24.0:*:*:*:*:*:*:*",
              vendor: "nginx",
              product: "nginx",
              version: "1.24.0",
            },
          ],
          totalCount: 1,
        }}
      />,
    )

    expect(screen.getByText("nginx nginx")).toBeTruthy()
    expect(screen.getByText("1.24.0")).toBeTruthy()
    expect(screen.getByText("cpe:2.3:a:nginx:nginx:1.24.0:*:*:*:*:*:*:*")).toBeTruthy()
  })

    describe("technology card PNG export", () => {
    function buildExportFixture(): Parameters<typeof TechnologiesSection>[0]["technology"] {
      return {
        buckets: [
          {
            id: "platform",
            label: "Platform",
            items: [
              buildStructuredTechnologyDetection({ name: "Next.js", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "React", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "Vercel", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "Tailwind CSS", version: null, sources: ["wappalyzer"], inferred: false }),
            ],
          },
        ],
        nucleiTechnologies: [],
        cpeEntries: [],
        totalCount: 4,
      }
    }

    function buildSingleTechnologyExportFixture(): Parameters<typeof TechnologiesSection>[0]["technology"] {
      return {
        buckets: [
          {
            id: "platform",
            label: "Platform",
            items: [
              buildStructuredTechnologyDetection({ name: "Next.js", version: null, sources: ["wappalyzer"], inferred: false }),
            ],
          },
        ],
        nucleiTechnologies: [],
        cpeEntries: [],
        totalCount: 1,
      }
    }

    function buildEmptyTechnologyExportFixture(): Parameters<typeof TechnologiesSection>[0]["technology"] {
      return {
        buckets: [],
        nucleiTechnologies: [],
        cpeEntries: [],
        totalCount: 0,
      }
    }

    it("exposes an Export entry button in the section header", () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      expect(
        screen.getByRole("button", { name: "Export" }),
      ).toBeInTheDocument()
    })

    it("does not expose the Export entry button when no technologies are available", () => {
      render(<TechnologiesSection technology={buildEmptyTechnologyExportFixture()} />)

      expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument()
    })

    it("opens the composer and shows zero technologies selected by default", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")

      await waitFor(() => {
        expect(within(composer).getByText(/0\s+of\s+\d+\s+selected/i)).toBeInTheDocument()
      })
    })

    it("updates the selected count when one technology is added to the export", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")

      const addControl = within(composer).getByRole("checkbox", { name: /next\.js/i })
      fireEvent.click(addControl)

      await waitFor(() => {
        expect(within(composer).getByText(/1\s+of\s+\d+\s+selected/i)).toBeInTheDocument()
      })
    })

    it("keeps export candidates independent from the section search filter", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.change(screen.getByRole("searchbox", { name: "Search technologies" }), {
        target: { value: "Next.js" },
      })

      expect(screen.getByText("Next.js")).toBeTruthy()
      expect(screen.queryByText("React")).toBeNull()

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")

      await waitFor(() => {
        expect(within(composer).getByText(/0\s+of\s+\d+\s+selected/i)).toBeInTheDocument()
      })
    })

    it("refreshes the default export selection when the technology rows change", async () => {
      const { rerender } = render(<TechnologiesSection technology={buildSingleTechnologyExportFixture()} />)

      rerender(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")

      await waitFor(() => {
        expect(within(composer).getByText(/0\s+of\s+\d+\s+selected/i)).toBeInTheDocument()
      })
    })

    it("updates the checked background style when a different option is selected", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      const styleGroup = within(composer).getByRole("radiogroup", { name: /style|background/i })
      const options = within(styleGroup).getAllByRole("radio")

      expect(options.length).toBeGreaterThanOrEqual(2)
      const initiallyUnchecked = options.find((option) => option.getAttribute("data-state") === "off")
      expect(initiallyUnchecked).toBeDefined()
      if (!initiallyUnchecked) {
        throw new Error("Expected at least one unchecked background style option.")
      }

      fireEvent.click(initiallyUnchecked)

      await waitFor(() => {
        expect(initiallyUnchecked).toHaveAttribute("data-state", "on")
      })
    })

    it("calls toPng with the portrait-capture frame and includeQueryParams when exporting PNG", async () => {
      const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

      try {
        render(<TechnologiesSection technology={buildExportFixture()} />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Export PNG" }))

        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalled()
        })

        const firstCall = toPngMock.mock.calls[0]
        expect(firstCall).toBeDefined()
        if (!firstCall) {
          throw new Error("Expected PNG export to be called.")
        }

        const frameElement = firstCall[0]
        expect(frameElement.dataset.scanTechnologyExportFrame).toBe("portrait-capture")
        expect(frameElement.dataset.exportRasterSafe).toBeUndefined()
        expect(toPngMock).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({ includeQueryParams: true }),
        )
      } finally {
        clickMock.mockRestore()
      }
    })

    it("includes the Stackray mark in technology card exports by default", async () => {
      const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

      try {
        render(<TechnologiesSection technology={buildExportFixture()} />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Export PNG" }))
        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalled()
        })

        const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
        const brand = frameElement.querySelector("[data-stackray-export-brand]")
        expect(brand).toHaveTextContent("Detected by stackray.app")
      } finally {
        clickMock.mockRestore()
      }
    })

    it("removes the Stackray mark from technology card exports when toggled off outside demo mode", async () => {
      const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

      try {
        render(<TechnologiesSection technology={buildExportFixture()} />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        fireEvent.click(within(composer).getByRole("switch", { name: "Toggle Stackray mark" }))
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Export PNG" }))
        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalled()
        })

        const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
        expect(frameElement.querySelector("[data-stackray-export-brand]")).toBeNull()
      } finally {
        clickMock.mockRestore()
      }
    })

    it("requires the Stackray mark in technology card exports in demo mode", async () => {
      const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

      try {
        render(<TechnologiesSection technology={buildExportFixture()} demoMode />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        const brandSwitch = within(composer).getByRole("switch", { name: "Toggle Stackray mark" })
        expect(brandSwitch).toBeChecked()
        expect(brandSwitch).toBeDisabled()
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Export PNG" }))
        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalled()
        })

        const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement
        const brand = frameElement.querySelector("[data-stackray-export-brand]")
        expect(brand).toHaveTextContent("Detected by stackray.app")
      } finally {
        clickMock.mockRestore()
      }
    })

    it("uses raster-safe capture styling for mobile technology card exports", async () => {
      mockMobileExportViewport(true)
      const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

      try {
        render(<TechnologiesSection technology={buildExportFixture()} />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Export PNG" }))
        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalled()
        })

        const frameElement = toPngMock.mock.calls[0]?.[0] as HTMLElement | undefined
        expect(frameElement?.dataset.scanTechnologyExportFrame).toBe("portrait-capture")
        expect(frameElement?.dataset.exportRasterSafe).toBe("true")
      } finally {
        clickMock.mockRestore()
      }
    })

    it("proxies remote icon src through the image proxy inside the export frame", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await screen.findByRole("button", { name: "Export PNG" })

      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      const imageSrcs = Array.from(frame.querySelectorAll("img")).map(
        (image) => image.getAttribute("src") ?? "",
      )

      expect(imageSrcs.length).toBeGreaterThan(0)
      expect(imageSrcs.some((src) => src.startsWith("/api/v1/image-proxy?url="))).toBe(true)
    })

    it("embeds the scan screenshot in the technology card export frame", async () => {
      render(
        <TechnologiesSection
          technology={buildExportFixture()}
          target="https://example.com"
          screenshotUrl="/api/v1/scans/scan-1/results/result-1/screenshot"
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await screen.findByRole("button", { name: "Export PNG" })

      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      const browser = frame.querySelector<HTMLElement>("[data-technology-card-screenshot-browser]")
      expect(browser).toBeTruthy()
      expect(browser?.textContent).toBe("")
      expect(within(frame).getByAltText("Homepage screenshot for example.com")).toHaveAttribute(
        "src",
        "/api/v1/scans/scan-1/results/result-1/screenshot?inline=1",
      )
    })

    it("toggles the scan screenshot inside the technology card export frame", async () => {
      render(
        <TechnologiesSection
          technology={buildExportFixture()}
          target="https://example.com"
          screenshotUrl="/api/v1/scans/scan-1/results/result-1/screenshot"
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      const screenshotSwitch = within(composer).getByRole("switch", { name: "Toggle website screenshot" })
      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      expect(screenshotSwitch).toBeChecked()
      expect(frame.querySelector("[data-technology-card-screenshot-browser]")).toBeTruthy()

      fireEvent.click(screenshotSwitch)

      await waitFor(() => {
        expect(screenshotSwitch).not.toBeChecked()
        expect(frame.querySelector("[data-technology-card-screenshot-browser]")).toBeNull()
      })
    })

    it("expands the portrait capture canvas height to fit the screenshot", async () => {
      render(
        <TechnologiesSection
          technology={buildExportFixture()}
          target="https://example.com"
          screenshotUrl="/api/v1/scans/scan-1/results/result-1/screenshot"
        />,
      )

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await screen.findByRole("button", { name: "Export PNG" })

      const captureFrame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(captureFrame).toBeTruthy()
      if (!captureFrame) {
        throw new Error("Expected export frame to be rendered.")
      }

      // Portrait frames with a screenshot stay content-height (no pinned
      // canvas height) so technology item cards keep their compact natural size
      // for every count instead of being stretched by a tall fixed canvas. The
      // screenshot browser preview still gets its calculated pixel height
      // inline (454px = 720px content width at 16:10 plus the chrome bar) so the
      // screenshot is never cropped.
      const browser = captureFrame.querySelector<HTMLElement>("[data-technology-card-screenshot-browser]")
      expect(browser?.style.height).toBe("454px")
      expect(captureFrame.style.height).toBe("")
      expect(captureFrame.className).not.toContain("aspect-[4/5]")
    })

    it("keeps portrait screenshot technology item cards at content height for 2, 3, 4, and 5 technologies", () => {
      function renderFrame(count: number): HTMLElement {
        const techRows: TechnologyTableRow[] = Array.from({ length: count }, (_, index) => ({
          id: `platform-tech-${index}`,
          category: "Platform",
          categoryId: "platform",
          name: `Tech ${index + 1}`,
          version: null,
          type: "Framework",
          sources: ["wappalyzer"],
          iconUrl: null,
          inferred: false,
          categories: ["JavaScript Frameworks"],
          description: null,
          website: null,
        }))

        const { container } = render(
          <TechnologyCardFrame
            rows={techRows}
            style="stackray"
            target="https://example.com"
            fixedDesktop
            exportSafe
            screenshotUrl="/api/v1/scans/scan-1/results/result-1/screenshot"
          />,
        )

        const frame = container.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
        if (!frame) {
          throw new Error(`Expected export frame for count=${count}`)
        }
        return frame
      }

      // Portrait frames with a screenshot must NOT pin the canvas height for any
      // count. A pinned height would stretch the grid's `1fr` rows and make the
      // technology item cards taller than their natural content height, which is
      // the compact look we want to preserve for every count (the bug was that
      // count=4 was the only one whose pinned height class actually generated a
      // CSS rule, so only it stretched).
      for (const count of [2, 3, 4, 5]) {
        const frame = renderFrame(count)
        expect(frame.style.height).toBe("")
        expect(frame.className).not.toContain("aspect-[4/5]")
      }
    })

    function buildExtendedTechnologyExportFixture(): Parameters<typeof TechnologiesSection>[0]["technology"] {
      return {
        buckets: [
          {
            id: "platform",
            label: "Platform",
            items: [
              buildStructuredTechnologyDetection({ name: "Next.js", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "React", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "Vercel", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "Tailwind CSS", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "Node.js", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "TypeScript", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "PostgreSQL", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "GraphQL", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "Prisma", version: null, sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "Redis", version: null, sources: ["wappalyzer"], inferred: false }),
            ],
          },
        ],
        nucleiTechnologies: [],
        cpeEntries: [],
        totalCount: 10,
      }
    }

    function buildVersionedExportFixture(): Parameters<typeof TechnologiesSection>[0]["technology"] {
      return {
        buckets: [
          {
            id: "platform",
            label: "Platform",
            items: [
              buildStructuredTechnologyDetection({ name: "Next.js", version: "14.2", sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "React", version: "18.3", sources: ["wappalyzer"], inferred: false }),
              buildStructuredTechnologyDetection({ name: "Vercel", version: null, sources: ["wappalyzer"], inferred: false }),
            ],
          },
        ],
        nucleiTechnologies: [],
        cpeEntries: [],
        totalCount: 3,
      }
    }

    it("renders every selected technology inside the capture frame when more than 8 are chosen", async () => {
      render(<TechnologiesSection technology={buildExtendedTechnologyExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await screen.findByRole("button", { name: "Export PNG" })

      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      const frameScope = within(frame)
      const technologyNames = [
        "Next.js",
        "React",
        "Vercel",
        "Tailwind CSS",
        "Node.js",
        "TypeScript",
        "PostgreSQL",
        "GraphQL",
        "Prisma",
        "Redis",
      ]

      for (const name of technologyNames) {
        expect(frameScope.getByText(name)).toBeInTheDocument()
      }
    })

    it("uses a portrait capture frame without rendering canvas options", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      expect(within(composer).queryByRole("radiogroup", { name: "Export canvas" })).toBeNull()
      expect(within(composer).queryByRole("radio", { name: "Landscape" })).toBeNull()
      expect(within(composer).queryByRole("radio", { name: "Portrait" })).toBeNull()
      expect(frame.dataset.scanTechnologyExportFrame).toBe("portrait-capture")
      // The fixed portrait capture frame applies its calculated pixel height
      // inline (900px for four technologies plus 48px for the Stackray footer)
      // instead of an aspect-ratio class so Tailwind never has to generate
      // arbitrary heights.
      expect(frame.style.height).toBe("948px")
      expect(frame.getAttribute("class") ?? "").not.toContain("aspect-[4/5]")
    })

    it("exports the portrait frame with shared image export options", async () => {
      const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

      try {
        render(<TechnologiesSection technology={buildExportFixture()} />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Export PNG" }))

        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalled()
        })

        const firstCall = toPngMock.mock.calls[0]
        expect(firstCall).toBeDefined()
        if (!firstCall) {
          throw new Error("Expected PNG export to be called.")
        }

        const frameElement = firstCall[0]
        expect(frameElement.dataset.scanTechnologyExportFrame).toBe("portrait-capture")
        expect(toPngMock).toHaveBeenCalledWith(
          expect.any(HTMLElement),
          expect.objectContaining({ includeQueryParams: true, pixelRatio: 2 }),
        )
      } finally {
        clickMock.mockRestore()
      }
    })

    it("renders the target favicon inside the export frame using the image proxy", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} target="https://example.com" />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await screen.findByRole("button", { name: "Export PNG" })

      const frame = document.querySelector("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      const imageSrcs = Array.from(frame.querySelectorAll("img")).map(
        (image) => image.getAttribute("src") ?? "",
      )

      expect(
        imageSrcs.some((src) => src.startsWith("/api/v1/image-proxy?") && src.includes("example.com")),
      ).toBe(true)
    })

    it("copies the export via toBlob and navigator.clipboard.write with a PNG ClipboardItem", async () => {
      const clipboardWriteMock = vi.fn(async (items: ClipboardItem[]) => {
        void items
      })
      const clipboardItemInstances: Array<Record<string, Blob | Promise<Blob>>> = []
      const ClipboardItemStub = class {
        public readonly items: Record<string, Blob | Promise<Blob>>
        public constructor(items: Record<string, Blob | Promise<Blob>>) {
          this.items = items
          clipboardItemInstances.push(items)
        }
      }
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: { write: clipboardWriteMock },
      })
      vi.stubGlobal("ClipboardItem", ClipboardItemStub)

      try {
        render(<TechnologiesSection technology={buildExportFixture()} />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Copy" }))

        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toBlobMock).toHaveBeenCalled()
          expect(clipboardWriteMock).toHaveBeenCalled()
        })

        const writeCall = clipboardWriteMock.mock.calls[0]
        expect(writeCall).toBeDefined()
        if (!writeCall) {
          throw new Error("Expected navigator.clipboard.write to be called.")
        }

        const clipboardItems = writeCall[0]
        expect(Array.isArray(clipboardItems)).toBe(true)
        if (!Array.isArray(clipboardItems)) {
          throw new Error("Expected navigator.clipboard.write to receive ClipboardItem array.")
        }

        const clipboardItem = clipboardItems[0]
        expect(clipboardItem).toBeInstanceOf(ClipboardItemStub)

        const recordedItems = clipboardItemInstances[0]
        expect(recordedItems).toBeDefined()
        if (!recordedItems) {
          throw new Error("Expected ClipboardItem to be constructed with items.")
        }

        const pngBlob = recordedItems["image/png"]
        expect(pngBlob).toBeDefined()
        expect(pngBlob).toBeInstanceOf(Promise)
        await expect(pngBlob).resolves.toBeInstanceOf(Blob)
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it("filters the technology picker with a local drawer search", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      const drawerSearch = within(composer).getByRole("searchbox", { name: "Search technologies in export drawer" })

      fireEvent.change(drawerSearch, { target: { value: "Next.js" } })

      await waitFor(() => {
        expect(within(composer).getByRole("checkbox", { name: /next\.js/i })).toBeInTheDocument()
      })
      expect(within(composer).queryByRole("checkbox", { name: /react/i })).not.toBeInTheDocument()
    })

    it("selects all visible technologies with the Select all button", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      const firstCheckbox = within(composer).getByRole("checkbox", { name: /next\.js/i })

      fireEvent.click(firstCheckbox)

      await waitFor(() => {
        expect(within(composer).getByText(/1\s+of\s+4\s+selected/i)).toBeInTheDocument()
      })

      const selectAllButton = within(composer).getByRole("button", { name: "Select all" })

      fireEvent.click(selectAllButton)

      await waitFor(() => {
        expect(within(composer).getByText(/4\s+of\s+4\s+selected/i)).toBeInTheDocument()
      })
    })

    it("deselects all visible technologies after searching", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await waitFor(() => {
        expect(within(composer).getByText(/4\s+of\s+4\s+selected/i)).toBeInTheDocument()
      })

      const drawerSearch = within(composer).getByRole("searchbox", { name: "Search technologies in export drawer" })

      fireEvent.change(drawerSearch, { target: { value: "Next.js" } })

      await waitFor(() => {
        expect(within(composer).queryByRole("checkbox", { name: /react/i })).not.toBeInTheDocument()
      })

      const deselectAllButton = within(composer).getByRole("button", { name: "Deselect all" })
      fireEvent.click(deselectAllButton)

      await waitFor(() => {
        expect(within(composer).getByText(/3\s+of\s+4\s+selected/i)).toBeInTheDocument()
      })
    })

    it("toggles the technology count badge on the exported card", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      const badgeSwitch = within(composer).getByRole("switch", { name: "Toggle technology count badge" })

      await waitFor(() => {
        expect(document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")?.textContent).toContain(
          "4 technologies",
        )
      })

      fireEvent.click(badgeSwitch)

      await waitFor(() => {
        expect(
          document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")?.textContent,
        ).not.toContain("4 technologies")
      })
    })

    it("toggles white backgrounds behind the exported favicon tiles", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} target="https://example.com" />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      const whiteIconSwitch = within(composer).getByRole("switch", { name: "Toggle white icon background" })
      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      const targetFavicon = frame.querySelector<HTMLElement>("[data-target-export-favicon]")
      const technologyIcon = frame.querySelector<HTMLElement>("[data-technology-export-icon]")
      expect(targetFavicon).toBeTruthy()
      expect(technologyIcon).toBeTruthy()
      expect(targetFavicon).not.toHaveStyle({ background: "#ffffff" })
      expect(technologyIcon).not.toHaveStyle({ background: "#ffffff" })

      fireEvent.click(whiteIconSwitch)

      await waitFor(() => {
        expect(targetFavicon).toHaveStyle({ background: "#ffffff" })
        expect(technologyIcon).toHaveStyle({ background: "#ffffff" })
      })
    })

    it("renders the visible preview with the same fixed frame classes as the capture target", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await waitFor(() => {
        expect(within(composer).getByText(/4\s+of\s+4\s+selected/i)).toBeInTheDocument()
      })

      const previewFrame = document.querySelector<HTMLElement>("[data-scan-technology-preview-frame]")
      const captureFrame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")

      expect(previewFrame).toBeTruthy()
      expect(captureFrame).toBeTruthy()
      expect(document.querySelectorAll("[data-scan-technology-export-frame]").length).toBe(1)
      expect(previewFrame?.dataset.scanTechnologyPreviewFrame).toBe("portrait-preview")
      expect(previewFrame?.className).toBe(captureFrame?.className)

      const scaleFrame = previewFrame?.parentElement?.parentElement
      expect(scaleFrame?.dataset.scanTechnologyPreviewScale).toBe("0.78")
      expect(scaleFrame?.style.width).toBe("561.6px")
      expect(scaleFrame?.style.height).toBe("739.44px")
    })

    it("does not render version text inside the export frame", async () => {
      render(<TechnologiesSection technology={buildVersionedExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await screen.findByRole("button", { name: "Export PNG" })

      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      expect(frame.textContent).toContain("Next.js")
      expect(frame.textContent).toContain("React")
      expect(frame.textContent).not.toContain("v14.2")
      expect(frame.textContent).not.toContain("v18.3")
    })

    it("disables technology, search, options, and style controls while a PNG export is in progress", async () => {
      const resolveExport = vi.fn<(value: string) => void>()
      const exportPromise = new Promise<string>((resolve) => {
        resolveExport.mockImplementation(resolve)
      })
      toPngMock.mockImplementation(async () => exportPromise)

      const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

      try {
        render(<TechnologiesSection technology={buildExportFixture()} />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        const selectAllButton = within(composer).getByRole("button", { name: "Select all" })
        fireEvent.click(selectAllButton)

        const exportButton = within(composer).getByRole("button", { name: "Export PNG" })
        const checkbox = within(composer).getByRole("checkbox", { name: /next\.js/i })
        const searchBox = within(composer).getByRole("searchbox", { name: "Search technologies in export drawer" })
        const badgeSwitch = within(composer).getByRole("switch", { name: "Toggle technology count badge" })
        const whiteIconSwitch = within(composer).getByRole("switch", { name: "Toggle white icon background" })
        const deselectAllButton = within(composer).getByRole("button", { name: "Deselect all" })
        const styleRadios = within(composer).getAllByRole("radio", { name: /background style/i })

        await waitFor(() => {
          expect(exportButton).not.toBeDisabled()
        })
        styleRadios.forEach((radio) => { expect(radio).not.toBeDisabled() })
        expect(checkbox).not.toBeDisabled()
        expect(searchBox).not.toBeDisabled()
        expect(badgeSwitch).not.toBeDisabled()
        expect(whiteIconSwitch).not.toBeDisabled()
        expect(selectAllButton).not.toBeDisabled()
        expect(deselectAllButton).not.toBeDisabled()

        fireEvent.click(exportButton)
        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(exportButton).toBeDisabled()
        })

        expect(checkbox).toBeDisabled()
        expect(searchBox).toBeDisabled()
        expect(badgeSwitch).toBeDisabled()
        expect(whiteIconSwitch).toBeDisabled()
        expect(selectAllButton).toBeDisabled()
        expect(deselectAllButton).toBeDisabled()
        styleRadios.forEach((radio) => { expect(radio).toBeDisabled() })

        fireEvent.click(checkbox)
        fireEvent.click(styleRadios[1])

        expect(checkbox).toBeChecked()
        expect(exportButton).toBeDisabled()

        const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
        expect(frame).toBeTruthy()
        expect(frame?.dataset.scanTechnologyExportFrame).toBe("portrait-capture")

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalled()
        })
        resolveExport("data:image/png;base64,stackray")

        await waitFor(() => {
          expect(exportButton).not.toBeDisabled()
        })
      } finally {
        clickMock.mockRestore()
      }
    })

    it("retries copy in image-safe mode when the first rasterization fails", async () => {
      const clipboardWriteMock = vi.fn(async () => undefined)
      const ClipboardItemStub = class {
        public readonly items: Record<string, Blob | Promise<Blob>>
        public constructor(items: Record<string, Blob | Promise<Blob>>) {
          this.items = items
        }
      }
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: { write: clipboardWriteMock },
      })
      vi.stubGlobal("ClipboardItem", ClipboardItemStub)

      let rejectFirst: (error: Error) => void = () => undefined
      let resolveSecond: (blob: Blob) => void = () => undefined

      try {
        toBlobMock.mockImplementation(async () => {
          if (toBlobMock.mock.calls.length === 1) {
            return new Promise<Blob>((_, reject) => {
              rejectFirst = reject
            })
          }

          return new Promise<Blob>((resolve) => {
            resolveSecond = resolve
          })
        })

        render(<TechnologiesSection technology={buildExportFixture()} target="https://example.com" />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Copy" }))

        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toBlobMock).toHaveBeenCalledTimes(1)
        })

        rejectFirst(new Error("Rasterization failed."))

        await waitFor(() => {
          expect(toBlobMock).toHaveBeenCalledTimes(2)
        })

        const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
        expect(frame).toBeTruthy()
        expect(frame?.querySelectorAll("img").length).toBe(0)

        resolveSecond(new Blob(["stackray-safe"], { type: "image/png" }))

        await waitFor(() => {
          expect(clipboardWriteMock).toHaveBeenCalled()
        })

        expect(within(composer).getByText("PNG copied to clipboard.")).toBeInTheDocument()
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it("retries download in image-safe mode when the first rasterization fails", async () => {
      const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
      let rejectFirst: (error: Error) => void = () => undefined
      let resolveSecond: (dataUrl: string) => void = () => undefined

      try {
        toPngMock.mockImplementation(async () => {
          if (toPngMock.mock.calls.length === 1) {
            return new Promise<string>((_, reject) => {
              rejectFirst = reject
            })
          }

          return new Promise<string>((resolve) => {
            resolveSecond = resolve
          })
        })

        render(<TechnologiesSection technology={buildExportFixture()} target="https://example.com" />)

        fireEvent.click(screen.getByRole("button", { name: "Export" }))

        const composer = await screen.findByRole("dialog")
        fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

        fireEvent.click(within(composer).getByRole("button", { name: "Export PNG" }))

        document.querySelectorAll("img").forEach((image) => { fireEvent.load(image) })

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalledTimes(1)
        })

        rejectFirst(new Error("Rasterization failed."))

        await waitFor(() => {
          expect(toPngMock).toHaveBeenCalledTimes(2)
        })

        const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
        expect(frame).toBeTruthy()
        expect(frame?.querySelectorAll("img").length).toBe(0)

        resolveSecond("data:image/png;base64,stackray-safe")

        await waitFor(() => {
          expect(clickMock).toHaveBeenCalled()
        })

        expect(within(composer).getByText("PNG export started.")).toBeInTheDocument()
      } finally {
        clickMock.mockRestore()
      }
    })

    it("renders image-safe fallback glyphs without img elements when imageSafeMode is active", () => {
      const rows: TechnologyTableRow[] = [
        {
          id: "platform-Next.js-none",
          category: "Platform",
          categoryId: "platform",
          name: "Next.js",
          version: null,
          type: "Framework",
          sources: ["wappalyzer"],
          iconUrl: "https://cdn.example.com/icon.png",
          inferred: false,
          categories: ["JavaScript Frameworks"],
          description: null,
          website: null,
        },
      ]

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
          imageSafeMode
        />,
      )

      const frame = container.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      expect(frame?.querySelectorAll("img").length).toBe(0)
    })

    it("uses sparse natural layout for a few technologies on portrait canvases", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await waitFor(() => {
        expect(within(composer).getByText(/4\s+of\s+4\s+selected/i)).toBeInTheDocument()
      })

      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      expect(frame.dataset.technologyCardDensity).toBe("sparse")
      const grid = frame.querySelector<HTMLElement>(".grid")
      expect(grid).toBeTruthy()
      expect(grid?.className).toContain("grid-cols-1")
      expect(grid?.className).toContain("[grid-auto-rows:1fr]")
    })

    it("uses compact dense layout for many technologies on portrait canvases", async () => {
      render(<TechnologiesSection technology={buildExtendedTechnologyExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      fireEvent.click(within(composer).getByRole("button", { name: "Select all" }))

      await waitFor(() => {
        expect(within(composer).getByText(/10\s+of\s+10\s+selected/i)).toBeInTheDocument()
      })

      const frame = document.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      if (!frame) {
        throw new Error("Expected export frame to be rendered.")
      }

      expect(frame.dataset.technologyCardDensity).toBe("dense")
      const grid = frame.querySelector<HTMLElement>(".grid")
      expect(grid).toBeTruthy()
      expect(grid?.className).toContain("grid-cols-2")
    })

    it("renders all four background style options including Sunset and Mono", async () => {
      render(<TechnologiesSection technology={buildExportFixture()} />)

      fireEvent.click(screen.getByRole("button", { name: "Export" }))

      const composer = await screen.findByRole("dialog")
      const styleGroup = within(composer).getByRole("radiogroup", { name: /style|background/i })

      expect(within(styleGroup).getByRole("radio", { name: "Stackray background style" })).toBeInTheDocument()
      expect(within(styleGroup).getByRole("radio", { name: "Sunset background style" })).toBeInTheDocument()
      expect(within(styleGroup).getByRole("radio", { name: "Aurora background style" })).toBeInTheDocument()
      expect(within(styleGroup).getByRole("radio", { name: "Mono background style" })).toBeInTheDocument()
    })

    it("does not render a colored accent bar inside technology item cards", () => {
      const rows: TechnologyTableRow[] = [
        {
          id: "platform-Next.js-none",
          category: "Platform",
          categoryId: "platform",
          name: "Next.js",
          version: null,
          type: "Framework",
          sources: ["wappalyzer"],
          iconUrl: null,
          inferred: false,
          categories: ["JavaScript Frameworks"],
          description: null,
          website: null,
        },
      ]

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const accentBars = container.querySelectorAll("[class*='bg-gradient-to-r']")
      expect(accentBars.length).toBe(0)
    })

    it.each([
      { count: 1, expectedCols: "grid-cols-1", expectedDensity: "sparse" },
      { count: 2, expectedCols: "grid-cols-1", expectedDensity: "sparse" },
      { count: 3, expectedCols: "grid-cols-1", expectedDensity: "sparse" },
      { count: 4, expectedCols: "grid-cols-1", expectedDensity: "sparse" },
      { count: 5, expectedCols: "grid-cols-1", expectedDensity: "roomy" },
      { count: 6, expectedCols: "grid-cols-2", expectedDensity: "roomy" },
      { count: 7, expectedCols: "grid-cols-2", expectedDensity: "roomy" },
      { count: 8, expectedCols: "grid-cols-2", expectedDensity: "roomy" },
      { count: 15, expectedCols: "grid-cols-2", expectedDensity: "dense" },
      { count: 25, expectedCols: "grid-cols-3", expectedDensity: "packed" },
    ])("uses $expectedCols $expectedDensity layout for $count portrait technologies", ({ count, expectedCols, expectedDensity }) => {
      const rows: TechnologyTableRow[] = Array.from({ length: count }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const frame = container.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      expect(frame?.dataset.technologyCardDensity).toBe(expectedDensity)

      const grid = frame?.querySelector<HTMLElement>(".grid")
      expect(grid?.className).toContain(expectedCols)
    })

    it("renders the expanded dot motif only before the six-technology layout", () => {
      const buildRows = (count: number): TechnologyTableRow[] => Array.from({ length: count }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container, rerender } = render(
        <TechnologyCardFrame
          rows={buildRows(5)}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const dotGrid = container.querySelector<HTMLElement>("[data-technology-card-dot-grid]")
      expect(dotGrid).toBeTruthy()
      expect(dotGrid?.className).toContain("h-20")
      expect(dotGrid?.className).toContain("w-28")
      expect(dotGrid?.style.maskImage).toContain("linear-gradient")

      rerender(
        <TechnologyCardFrame
          rows={buildRows(6)}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      expect(container.querySelector("[data-technology-card-dot-grid]")).toBeNull()
    })

    it("uses the shorter portrait frame height for six selected technologies", () => {
      const rows: TechnologyTableRow[] = Array.from({ length: 6 }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const frame = container.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      expect(frame?.style.height).toBe("748px")
      expect(frame?.className).not.toContain("aspect-[4/5]")
    })

    it.each([
      { count: 1, expectedShellClass: "size-14" },
      { count: 2, expectedShellClass: "size-14" },
      { count: 3, expectedShellClass: "size-14" },
      { count: 4, expectedShellClass: "size-14" },
      { count: 5, expectedShellClass: "size-14" },
      { count: 6, expectedShellClass: "size-14" },
      { count: 7, expectedShellClass: "size-14" },
      { count: 8, expectedShellClass: "size-14" },
      { count: 15, expectedShellClass: "size-8" },
      { count: 25, expectedShellClass: "size-8" },
    ])("uses $expectedShellClass icon shell for $count portrait technologies", ({ count, expectedShellClass }) => {
      const rows: TechnologyTableRow[] = Array.from({ length: count }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const frame = container.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()
      const iconShell = frame?.querySelector<HTMLElement>("[data-technology-export-icon]")
      expect(iconShell).toBeTruthy()
      expect(iconShell?.className).toContain(expectedShellClass)
    })

    it.each([
      { count: 4 },
      { count: 5 },
      { count: 6 },
      { count: 7 },
      { count: 8 },
      { count: 9 },
      { count: 30 },
    ])("stretches cards to fill the grid via auto-rows for $count portrait technologies", ({ count }) => {
      const rows: TechnologyTableRow[] = Array.from({ length: count }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const grid = container.querySelector<HTMLElement>("[data-scan-technology-export-frame] .grid")
      expect(grid).toBeTruthy()
      expect(grid?.className).toContain("[grid-auto-rows:1fr]")
      expect(grid?.className).toContain("h-full")

      const cards = container.querySelectorAll("[data-scan-technology-export-frame] .grid > div")
      expect(cards.length).toBe(count)

      cards.forEach((card) => {
        expect(card.className).not.toMatch(/min-h-\[/)
      })
    })

    it.each([
      { count: 1, shouldCenter: false },
      { count: 4, shouldCenter: false },
      { count: 5, shouldCenter: false },
      { count: 6, shouldCenter: false },
      { count: 7, shouldCenter: false },
      { count: 8, shouldCenter: false },
      { count: 10, shouldCenter: false },
    ])("does not center card content for $count portrait technologies", ({ count, shouldCenter }) => {
      const rows: TechnologyTableRow[] = Array.from({ length: count }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const card = container.querySelector("[data-scan-technology-export-frame] .grid > div")
      expect(card).toBeTruthy()
      const content = card?.querySelector<HTMLElement>(".flex.flex-1")
      expect(content).toBeTruthy()

      if (shouldCenter) {
        expect(content?.className).toContain("justify-center")
      } else {
        expect(content?.className).not.toContain("justify-center")
      }
    })

    it.each([
      { count: 3, expectedTitleClass: "text-3xl" },
      { count: 4, expectedTitleClass: "text-3xl" },
      { count: 5, expectedTitleClass: "text-3xl" },
      { count: 6, expectedTitleClass: "text-[26px]" },
      { count: 7, expectedTitleClass: "text-[26px]" },
      { count: 8, expectedTitleClass: "text-[26px]" },
    ])("uses $expectedTitleClass title for $count portrait technologies", ({ count, expectedTitleClass }) => {
      const rows: TechnologyTableRow[] = Array.from({ length: count }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const frame = container.querySelector<HTMLElement>("[data-scan-technology-export-frame]")
      expect(frame).toBeTruthy()

      const titles = frame?.querySelectorAll(".grid > div .font-semibold.text-white")
      expect(titles?.length).toBeGreaterThan(0)
      titles?.forEach((title) => {
        expect(title.className).toContain(expectedTitleClass)
      })
    })

    it.each([6, 7, 8])("allows long technology names to wrap for %s portrait technologies", (count) => {
      const rows: TechnologyTableRow[] = Array.from({ length: count }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: index === 0 ? "Google Workspace Enterprise" : `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const title = container.querySelector<HTMLElement>("[data-scan-technology-export-frame] .grid > div .font-semibold.text-white")
      expect(title).toBeTruthy()
      expect(title?.className).toContain("break-words")
      expect(title?.className).toContain("[overflow-wrap:anywhere]")
    })

    it.each([
      { count: 4, expectedCols: "grid-cols-1" },
      { count: 5, expectedCols: "grid-cols-1" },
      { count: 6, expectedCols: "grid-cols-2" },
      { count: 7, expectedCols: "grid-cols-2" },
      { count: 8, expectedCols: "grid-cols-2" },
      { count: 9, expectedCols: "grid-cols-2" },
    ])("uses $expectedCols grid for $count portrait technologies with stretch-to-fill", ({ count, expectedCols }) => {
      const rows: TechnologyTableRow[] = Array.from({ length: count }, (_, index) => ({
        id: `platform-tech-${index}`,
        category: "Platform",
        categoryId: "platform",
        name: `Tech ${index + 1}`,
        version: null,
        type: "Framework",
        sources: ["wappalyzer"],
        iconUrl: null,
        inferred: false,
        categories: ["JavaScript Frameworks"],
        description: null,
        website: null,
      }))

      const { container } = render(
        <TechnologyCardFrame
          rows={rows}
          style="stackray"
          target="https://example.com"
          fixedDesktop
          exportSafe
        />,
      )

      const grid = container.querySelector<HTMLElement>("[data-scan-technology-export-frame] .grid")
      expect(grid).toBeTruthy()
      expect(grid?.className).toContain(expectedCols)
      expect(grid?.className).toContain("[grid-auto-rows:1fr]")

      const cards = container.querySelectorAll("[data-scan-technology-export-frame] .grid > div")
      expect(cards.length).toBe(count)
      cards.forEach((card) => {
        expect(card.className).not.toMatch(/min-h-\[/)
      })
    })
  })
})

describe("SubdomainsSectionCard", () => {
  it("shows validated hosts without requiring expansion", () => {
    render(
      <SubdomainsSectionCard
        scanId="scan_01"
        subdomains={{
          summary: {
            state: "completed",
            runId: "sdr_01",
            targetDomain: "example.com",
            resultCount: 1,
            engineVersion: null,
            errorMessage: null,
            startedAt: "2026-03-27T00:00:00.000Z",
            completedAt: "2026-03-27T00:00:05.000Z",
          },
          items: [
            {
              subdomainId: "sub_01",
              scanId: "scan_01",
              host: "app.example.com",
              rootDomain: "example.com",
              ip: "203.0.113.10",
              source: "crtsh",
              wildcardCertificate: false,
              observedAt: "2026-03-27T00:00:01.000Z",
              rawSubfinder: {},
            },
          ],
          total: 1,
        }}
      />,
    )

    expect(screen.getByText("Subdomains")).toBeTruthy()
    expect(screen.getByText("app.example.com")).toBeTruthy()
    expect(screen.getByText("203.0.113.10")).toBeTruthy()
    expect(screen.getByText("crtsh")).toBeTruthy()
  })

  it("loads more subdomains from the paginated API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        items: [
          {
            subdomainId: "sub_02",
            scanId: "scan_01",
            host: "api.example.com",
            rootDomain: "example.com",
            ip: "203.0.113.11",
            source: "crtsh",
            wildcardCertificate: false,
            observedAt: "2026-03-27T00:00:02.000Z",
            rawSubfinder: {},
          },
        ],
        total: 2,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    render(
      <SubdomainsSectionCard
        scanId="scan_01"
        subdomains={{
          summary: {
            state: "completed",
            runId: "sdr_01",
            targetDomain: "example.com",
            resultCount: 2,
            engineVersion: null,
            errorMessage: null,
            startedAt: "2026-03-27T00:00:00.000Z",
            completedAt: "2026-03-27T00:00:05.000Z",
          },
          items: [
            {
              subdomainId: "sub_01",
              scanId: "scan_01",
              host: "app.example.com",
              rootDomain: "example.com",
              ip: "203.0.113.10",
              source: "crtsh",
              wildcardCertificate: false,
              observedAt: "2026-03-27T00:00:01.000Z",
              rawSubfinder: {},
            },
          ],
          total: 2,
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /load more/i }))

    await waitFor(() => {
      expect(screen.getByText("api.example.com")).toBeTruthy()
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/scans/scan_01/subdomains?page=2&pageSize=250")
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull()
  })

  it("queues a scan for a discovered subdomain without leaving the current detail view", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        scanId: "scan_queued",
        status: "queued",
        reused: false,
      }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    )

    render(
      <SubdomainsSectionCard
        scanId="scan_01"
        subdomains={{
          summary: {
            state: "completed",
            runId: "sdr_01",
            targetDomain: "example.com",
            resultCount: 1,
            engineVersion: null,
            errorMessage: null,
            startedAt: "2026-03-27T00:00:00.000Z",
            completedAt: "2026-03-27T00:00:05.000Z",
          },
          items: [
            {
              subdomainId: "sub_01",
              scanId: "scan_01",
              host: "app.example.com",
              rootDomain: "example.com",
              ip: "203.0.113.10",
              source: "crtsh",
              wildcardCertificate: false,
              observedAt: "2026-03-27T00:00:01.000Z",
              rawSubfinder: {},
            },
          ],
          total: 1,
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Queue scan for app.example.com" }))

    await waitFor(() => {
      expect(screen.getByText("Queued!")).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "Open queued scan for app.example.com" }))

    expect(routerMocks.push).toHaveBeenCalledWith("/scans/scan_queued")

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: "app.example.com",
        options: {
          followRedirects: true,
          includeRawResponse: false,
          headless: false,
        },
        client: {
          source: "ui",
        },
      }),
    })
  })
})

describe("scan detail section panels", () => {
  it("shows zero redirect hops when the redirect chain is empty", () => {
    render(
      <RedirectChainCard
        delivery={{
          input: "example.com",
          url: "https://example.com",
          finalUrl: "https://example.com",
          path: "/",
          method: "GET",
          statusCode: 200,
          location: null,
          responseTimeMs: 128,
          contentType: "text/html",
          contentLength: 4096,
          redirectChain: {
            statusCodes: [],
            items: [],
          },
        }}
      />,
    )

    expect(screen.getByText("0 hops")).toBeTruthy()
    expect(screen.getByText("No redirects, direct response")).toBeTruthy()
    expect(screen.queryByText("-1 hops")).toBeNull()
  })

  it("shows the TLS certificate details without requiring expansion", () => {
    render(
      <TlsCertificateSection
        tls={{
          sni: "example.com",
          jarmHash: "jarm-hash",
          certificate: {
            subject: "CN=example.com",
            issuer: "Let's Encrypt",
            not_before: "2026-05-23T00:00:00.000Z",
            not_after: "2026-08-21T00:00:00.000Z",
          },
          favicon: {
            mmh3: null,
            md5: null,
            url: null,
            path: null,
          },
          hashes: {},
          sslDnsNames: [],
          sslIssuers: [],
        }}
      />,
    )

    expect(screen.getByText("TLS Certificate")).toBeTruthy()
    expect(screen.getByText("Let's Encrypt")).toBeTruthy()
    expect(screen.getByText("May 23, 2026")).toBeTruthy()
    expect(screen.getByText("Aug 21, 2026")).toBeTruthy()
  })

  it("shows domain info details without requiring expansion", () => {
    render(
      <DomainInfoSection
        domain={{
          hasOriginalDomain: true,
          hasFinalDomain: false,
          metadata: [
            {
              subject: "example.com",
              registrarName: "DigiCert",
              registrarIanaId: null,
              registrarUrl: null,
              registrarEmail: null,
              registrarPhone: null,
              registrationDate: "2024-01-02T00:00:00.000Z",
              expirationDate: "2026-08-21T00:00:00.000Z",
              lastChangedDate: "2025-03-04T00:00:00.000Z",
              nameservers: [],
              dnssec: null,
              status: [],
              provenance: "original",
            },
          ],
        }}
      />,
    )

    expect(screen.getByText("Domain Info")).toBeTruthy()
    expect(screen.getByText("DigiCert")).toBeTruthy()
    expect(screen.getByText("Jan 2, 2024")).toBeTruthy()
    expect(screen.getByText("Aug 21, 2026")).toBeTruthy()
    expect(screen.getByText("Mar 4, 2025")).toBeTruthy()
  })
})
