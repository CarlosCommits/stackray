import { describe, expect, it } from "vitest"

import { listRunsResponseSchema, runsListQuerySchema } from "@/lib/contracts/runs"
import { getMockScanListEnrichment, mockScanList } from "@/lib/mocks/scans"
import { buildRunsRow } from "@/lib/queries/runs"

describe("runs contract", () => {
  it("accepts the normalized runs list query shape", () => {
    expect(
      runsListQuerySchema.parse({
        q: "wordpress",
        status: "completed",
        source: "ui",
        sort: "oldest",
        cursor: "50",
        limit: 25,
      })
    ).toEqual({
      q: "wordpress",
      status: "completed",
      source: "ui",
      sort: "oldest",
      cursor: "50",
      limit: 25,
    })
  })

  it("locks the paginated runs response shape", () => {
    const scan = mockScanList.items[0]
    expect(scan).toBeDefined()

    const row = buildRunsRow(
      scan!,
      getMockScanListEnrichment(scan!.scanId),
      ["https://primary.example.test", "shop.primary.example.test"],
      "https://primary.example.test/favicon.ico"
    )

    expect(
      listRunsResponseSchema.parse({
        items: [row],
        nextCursor: "1",
      })
    ).toEqual({
      items: [row],
      nextCursor: "1",
    })
  })
})
