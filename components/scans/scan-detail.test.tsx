import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { DomainInfoSection } from "@/components/scans/scan-detail/domain-info"
import { PageTitleCard, ScanDetailHeader, ScanOverviewBand, getScanPhaseConnectorClassName } from "@/components/scans/scan-detail/header"
import { resolveFaviconPreviewSrc } from "@/components/scans/scan-detail/shared"
import { SubdomainsSectionCard } from "@/components/scans/scan-detail/subdomains"
import { ScanDetailSectionTabs } from "@/components/scans/scan-detail/tabs"
import { TechnologiesSection } from "@/components/scans/scan-detail/technologies"
import { TlsCertificateSection } from "@/components/scans/scan-detail/tls-fingerprints"
import { TooltipProvider } from "@/components/ui/tooltip"
import { buildStructuredTechnologyDetection } from "@/lib/server/scans/technology-metadata-catalog"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

afterEach(() => {
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
      url: undefined as unknown as null,
      path: undefined as unknown as null,
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

    fireEvent.error(img!)

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
        target="https://vercel.com"
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
})

describe("scan detail section panels", () => {
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
