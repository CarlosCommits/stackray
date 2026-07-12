import { describe, expect, it } from "vitest"

import { imageExportOptions, resolveExportImageSrc, shouldUseNativePngShare } from "./image-export"

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
