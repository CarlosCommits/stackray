import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import {
  PageTitleCard,
  QuickActionsCard,
  SubdomainsSectionCard,
  TechnologiesSection,
  resolveFaviconPreviewSrc,
} from "@/components/scans/scan-detail-sections"
import { buildStructuredTechnologyDetection } from "@/lib/server/scans/technology-metadata-catalog"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

afterEach(() => {
  vi.restoreAllMocks()
})

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
})

describe("PageTitleCard", () => {
  it("renders title and final URL without favicon when no valid favicon provided", () => {
    render(<PageTitleCard title="Example Site" finalUrl="https://example.com" />)

    expect(screen.getByText("Page Title")).toBeTruthy()
    expect(screen.getByText("Example Site")).toBeTruthy()
    expect(screen.getByText("Final URL")).toBeTruthy()
    expect(screen.getByText("https://example.com")).toBeTruthy()

    const img = document.querySelector("img")
    expect(img).toBeNull()
  })

  it("renders favicon image for valid remote URL", () => {
    render(
      <PageTitleCard
        title="Example Site"
        finalUrl="https://example.com"
        favicon={{ url: "https://example.com/favicon.ico", path: null }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeTruthy()
    expect(img?.getAttribute("src")).toBe("https://example.com/favicon.ico")
    expect(img?.getAttribute("width")).toBe("32")
    expect(img?.getAttribute("height")).toBe("32")
  })

  it("renders favicon image for valid local path", () => {
    render(
      <PageTitleCard
        title="Example Site"
        finalUrl="https://example.com"
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
    render(
      <PageTitleCard
        title="Example Site"
        finalUrl="https://example.com"
        favicon={{ url: "-1830687435", path: null }}
      />,
    )

    const img = document.querySelector("img")
    expect(img).toBeNull()
  })

  it("prefers url over path when both are available", () => {
    render(
      <PageTitleCard
        title="Example Site"
        finalUrl="https://example.com"
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

  it("handles null favicon prop gracefully", () => {
    render(
      <PageTitleCard
        title="Example Site"
        finalUrl="https://example.com"
        favicon={null}
      />,
    )

    expect(screen.getByText("Example Site")).toBeTruthy()
    expect(screen.getByText("https://example.com")).toBeTruthy()

    const img = document.querySelector("img")
    expect(img).toBeNull()
  })

  it("renders plain img element for remote URLs with safe attributes", () => {
    render(
      <PageTitleCard
        title="Example Site"
        finalUrl="https://example.com"
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

    expect(screen.getByText("Technologies")).toBeTruthy()
    expect(screen.getByText("Platform")).toBeTruthy()
    expect(screen.getByText("Business Tools")).toBeTruthy()
    expect(screen.getByText("WordPress")).toBeTruthy()
    expect(screen.getByText("Google Analytics")).toBeTruthy()
  })
})

describe("SubdomainsSectionCard", () => {
  it("renders validated Subfinder hosts", () => {
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

describe("QuickActionsCard", () => {
  it("opens the schedule dialog with seeded targets", () => {
    render(
      <QuickActionsCard
        target="https://example.org"
        scheduleSeed={{
          targets: ["https://example.org"],
          options: {
            followRedirects: true,
          },
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /schedule/i }))

    expect(screen.getByRole("heading", { name: "Create Schedule" })).toBeTruthy()
    expect(screen.getByLabelText("Targets")).toHaveValue("https://example.org")
  })
})
