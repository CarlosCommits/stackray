import { afterEach, describe, expect, it, vi } from "vitest"

import {
  captureExportPngBlob,
  captureExportPngDataUrl,
  imageExportOptions,
  iosExportCanvasDrawPasses,
  resolveExportImageSrc,
  resolveScannedExportFaviconSrc,
  shouldUseNativePngShare,
  withIosPngExportImages,
} from "./image-export"

const htmlToImageMocks = vi.hoisted(() => ({
  toBlob: vi.fn(async () => new Blob(["desktop"], { type: "image/png" })),
  toPng: vi.fn(async () => "data:image/png;base64,desktop"),
  toSvg: vi.fn(async () => "data:image/svg+xml;charset=utf-8,<svg/>"),
}))

vi.mock("html-to-image", () => htmlToImageMocks)

describe("imageExportOptions", () => {
  it("reuses images already loaded by the export frame", () => {
    expect(imageExportOptions.cacheBust).toBe(false)
  })
})

describe("resolveExportImageSrc", () => {
  it("returns null for empty or null input", () => {
    expect(resolveExportImageSrc(null)).toBeNull()
    expect(resolveExportImageSrc("")).toBeNull()
  })

  it("returns local paths unchanged", () => {
    expect(resolveExportImageSrc("/favicons/example.com.png")).toBe("/favicons/example.com.png")
  })

  it("returns data URIs unchanged", () => {
    expect(resolveExportImageSrc("data:image/png;base64,abc")).toBe("data:image/png;base64,abc")
  })

  it("proxies absolute HTTP and HTTPS URLs", () => {
    expect(resolveExportImageSrc("https://cdn.example.com/icon.png")).toBe(
      "/api/v1/image-proxy?url=https%3A%2F%2Fcdn.example.com%2Ficon.png",
    )
    expect(resolveExportImageSrc("http://cdn.example.com/icon.png")).toBe(
      "/api/v1/image-proxy?url=http%3A%2F%2Fcdn.example.com%2Ficon.png",
    )
  })

  it("proxies protocol-relative URLs instead of treating them as local", () => {
    const result = resolveExportImageSrc("//cdn.example.com/icon.png")

    expect(result).toBe("/api/v1/image-proxy?url=https%3A%2F%2Fcdn.example.com%2Ficon.png")
  })

  it("returns null for non-HTTP, non-local, non-data sources", () => {
    expect(resolveExportImageSrc("ftp://cdn.example.com/icon.png")).toBeNull()
    expect(resolveExportImageSrc("javascript:alert(1)")).toBeNull()
  })
})

describe("shouldUseNativePngShare", () => {
  const canShare = () => true
  const share = async () => undefined

  it("uses the native file share sheet in Chrome on iOS", () => {
    expect(shouldUseNativePngShare({
      canShare, maxTouchPoints: 5, platform: "iPhone", share,
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/126.0 Mobile/15E148 Safari/604.1",
    })).toBe(true)
  })

  it("preserves Safari direct PNG download behavior", () => {
    expect(shouldUseNativePngShare({
      canShare, maxTouchPoints: 5, platform: "iPhone", share,
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
    })).toBe(false)
  })

  it("does not replace desktop downloads with sharing", () => {
    expect(shouldUseNativePngShare({
      canShare, maxTouchPoints: 0, platform: "MacIntel", share,
      userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15",
    })).toBe(false)
  })
})


describe("resolveScannedExportFaviconSrc", () => {
  it("prefers the recorded same-origin scan favicon", () => {
    expect(resolveScannedExportFaviconSrc("/api/v1/scans/scan-1/results/result-1/favicon", "example.com")).toBe(
      "/api/v1/scans/scan-1/results/result-1/favicon",
    )
  })
})

describe("withIosPngExportImages", () => {
  it("converts marked raster images to PNG data URLs during iOS capture", async () => {
    const context = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context)
    const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,capture")
    const root = document.createElement("div")
    const image = document.createElement("img")
    image.src = "/api/v1/scans/scan-1/results/result-1/screenshot?inline=1"
    image.setAttribute("data-export-raster-image", "")
    Object.defineProperties(image, {
      complete: { configurable: true, value: true },
      naturalHeight: { configurable: true, value: 640 },
      naturalWidth: { configurable: true, value: 1024 },
    })
    Object.defineProperty(image, "decode", { configurable: true, value: vi.fn(async () => undefined) })
    root.appendChild(image)

    try {
      const result = await withIosPngExportImages(
        root,
        async () => {
          expect(image.getAttribute("src")).toBe("data:image/png;base64,capture")
          return "captured"
        },
        { maxTouchPoints: 5, platform: "iPhone", userAgent: "Mozilla/5.0 (iPhone)" },
      )

      expect(result).toBe("captured")
      expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0)
      expect(image.getAttribute("src")).toBe("/api/v1/scans/scan-1/results/result-1/screenshot?inline=1")
    } finally {
      getContextSpy.mockRestore()
      toDataUrlSpy.mockRestore()
    }
  })
})

describe("captureExportPngBlob and captureExportPngDataUrl", () => {
  const desktopNavigator = {
    maxTouchPoints: 0,
    platform: "Win32",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
  }
  const iosNavigator = { maxTouchPoints: 5, platform: "iPhone", userAgent: "Mozilla/5.0 (iPhone)" }

  afterEach(() => {
    vi.unstubAllGlobals()
    htmlToImageMocks.toBlob.mockClear()
    htmlToImageMocks.toPng.mockClear()
    htmlToImageMocks.toSvg.mockClear()
  })

  it("captures through html-to-image directly outside iOS", async () => {
    const root = document.createElement("div")

    await expect(captureExportPngBlob(root, desktopNavigator)).resolves.toBeInstanceOf(Blob)
    expect(htmlToImageMocks.toBlob).toHaveBeenCalledWith(root, imageExportOptions)

    await expect(captureExportPngDataUrl(root, desktopNavigator)).resolves.toBe("data:image/png;base64,desktop")
    expect(htmlToImageMocks.toPng).toHaveBeenCalledWith(root, imageExportOptions)
    expect(htmlToImageMocks.toSvg).not.toHaveBeenCalled()
  })

  it("rasterizes the exported SVG with repeated canvas draws on iOS", async () => {
    class FakeSvgImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      decode = vi.fn(async () => undefined)
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal("Image", FakeSvgImage)
    const context = { clearRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context)
    const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,ios")
    const root = document.createElement("div")

    try {
      await expect(captureExportPngDataUrl(root, iosNavigator)).resolves.toBe("data:image/png;base64,ios")

      expect(htmlToImageMocks.toSvg).toHaveBeenCalledWith(root, imageExportOptions)
      expect(htmlToImageMocks.toPng).not.toHaveBeenCalled()
      expect(context.drawImage).toHaveBeenCalledTimes(iosExportCanvasDrawPasses)
    } finally {
      getContextSpy.mockRestore()
      toDataUrlSpy.mockRestore()
    }
  })
})
