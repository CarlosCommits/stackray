import { describe, expect, it } from "vitest"

import { buildStructuredTechnologyDetection, canonicalizeTechnologyLabel } from "@/lib/server/scans/technology-metadata-catalog"

describe("custom technology metadata", () => {
  it("enriches custom technologies that are not in the generated Wappalyzer catalog", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "tanstack start",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("TanStack Start")
    expect(detection.website).toBe("https://tanstack.com/start")
    expect(detection.categories).toEqual(["Web frameworks", "JavaScript frameworks"])
    expect(detection.bucket).toBe("framework")
    expect(detection.iconUrl).toContain("TanStack.svg")
  })

  it("canonicalizes custom technology labels before persistence", () => {
    expect(canonicalizeTechnologyLabel("tanstack router")).toEqual({
      name: "TanStack Router",
      version: null,
    })
  })

  it("enriches Helply from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "helply",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Helply")
    expect(detection.website).toBe("https://helply.com")
    expect(detection.categories).toEqual(["Live chat"])
    expect(detection.bucket).toBe("business")
  })

  it("enriches Uvicorn from Stackray custom metadata", () => {
    const detection = buildStructuredTechnologyDetection({
      name: "uvicorn",
      version: null,
      sources: ["wappalyzer"],
      inferred: false,
    })

    expect(detection.name).toBe("Uvicorn")
    expect(detection.website).toBe("https://www.uvicorn.org/")
    expect(detection.categories).toEqual(["Web servers"])
    expect(detection.bucket).toBe("infrastructure")
  })
})
