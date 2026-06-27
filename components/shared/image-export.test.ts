import { describe, expect, it } from "vitest"

import { resolveExportImageSrc } from "./image-export"

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
