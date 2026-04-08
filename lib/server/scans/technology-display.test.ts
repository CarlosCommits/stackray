import { describe, expect, it } from "vitest"

import { buildStructuredTechnologyDetection } from "@/lib/server/scans/technology-catalog"
import { buildTechnologyDisplayModel } from "@/lib/server/scans/technology-display"

describe("buildTechnologyDisplayModel", () => {
  it("groups technologies into the configured non-empty buckets", () => {
    const model = buildTechnologyDisplayModel({
      detections: [
        buildStructuredTechnologyDetection({ name: "WordPress", version: null, sources: ["wappalyzer"], inferred: false }),
        buildStructuredTechnologyDetection({ name: "Next.js", version: null, sources: ["nuclei"], inferred: true }),
        buildStructuredTechnologyDetection({ name: "Google Analytics", version: null, sources: ["derived"], inferred: true }),
        buildStructuredTechnologyDetection({ name: "Nginx", version: null, sources: ["wappalyzer"], inferred: false }),
      ],
      wordpress: null,
      cpe: [],
    })

    expect(model.buckets.map((bucket) => bucket.id)).toEqual([
      "platform",
      "framework",
      "infrastructure",
      "business",
    ])
  })

  it("moves explicit and inferred wordpress plugins into ecosystem add-ons", () => {
    const model = buildTechnologyDisplayModel({
      detections: [
        buildStructuredTechnologyDetection({ name: "WordPress", version: null, sources: ["wappalyzer"], inferred: false }),
        buildStructuredTechnologyDetection({ name: "Jetpack", version: null, sources: ["wappalyzer"], inferred: false }),
        buildStructuredTechnologyDetection({ name: "Yoast SEO Premium:25.8", version: "25.8", sources: ["wappalyzer"], inferred: false }),
      ],
      wordpress: {
        plugins: ["jetpack"],
        themes: ["twentytwentyfour"],
      },
      cpe: [],
    })

    const ecosystemBucket = model.buckets.find((bucket) => bucket.id === "ecosystem")
    expect(ecosystemBucket?.items.map((item) => item.name)).toEqual([
      "Twenty Twenty-Four",
      "Jetpack",
      "Yoast SEO Premium",
    ])
    const infrastructureBucket = model.buckets.find((bucket) => bucket.id === "infrastructure")
    expect(infrastructureBucket).toBeUndefined()
  })

  it("adds wordpress as an inferred platform when wordpress-only signals are present", () => {
    const model = buildTechnologyDisplayModel({
      detections: [
        buildStructuredTechnologyDetection({ name: "Yoast SEO", version: null, sources: ["wappalyzer"], inferred: false }),
      ],
      wordpress: {
        plugins: ["yoast-seo"],
        themes: [],
      },
      cpe: [],
    })

    const platformBucket = model.buckets.find((bucket) => bucket.id === "platform")
    expect(platformBucket?.items.map((item) => item.name)).toEqual(["WordPress"])
  })
})
