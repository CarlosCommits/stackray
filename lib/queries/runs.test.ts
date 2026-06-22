import { describe, expect, it } from "vitest"

import {
  RUNS_COLUMNS,
  RUNS_SOURCE_LABELS,
  RUNS_STATUS_NORMALIZATION,
  getRunsSourceLabel,
  getRunsStatusLabel,
  normalizeRunsStatus,
} from "@/components/runs/types"
import type { RunsRow } from "@/components/runs/types"
import { getMockScanListEnrichment, mockScanList } from "@/lib/mocks/scans"
import { RUNS_DEFAULT_PAGE_LIMIT, buildRunsListResponse, buildRunsRow, buildRunsRows, parseRunsQuery } from "@/lib/queries/runs"

function buildMockRunsRows() {
  return buildRunsRows(
    mockScanList.items,
    getMockScanListEnrichment,
    (scanId) => (scanId === "scn_01J_demo_recent" ? ["https://primary.example.test"] : ["https://queue.example.com"]),
    (_scanId, firstTarget) => (firstTarget === "https://primary.example.test" ? "https://primary.example.test/favicon.ico" : null),
  )
}

describe("/runs row contract", () => {
  it("locks the canonical column order", () => {
    expect(RUNS_COLUMNS).toEqual([
      { key: "submittedAt", label: "Submitted at" },
      { key: "targetUrls", label: "Targets" },
      { key: "status", label: "Status" },
      { key: "source", label: "Source" },
      { key: "createdBy", label: "Created by" },
      { key: "duration", label: "Duration" },
      { key: "topTechnologies", label: "Top technologies" },
    ])
  })

  it("locks source labels and status normalization", () => {
    expect(RUNS_STATUS_NORMALIZATION).toEqual({
      pending: "queued",
      queued: "queued",
      running: "running",
      processing: "running",
      completed: "completed",
      failed: "failed",
      cancelled: "cancelled",
    })

    expect(normalizeRunsStatus("pending")).toBe("queued")
    expect(normalizeRunsStatus("processing")).toBe("running")
    expect(getRunsStatusLabel("running")).toBe("Running")
    expect(getRunsStatusLabel("failed")).toBe("Failed")

    expect(RUNS_SOURCE_LABELS).toEqual({
      ui: "UI",
      cli: "CLI",
      api: "API",
      system: "System",
    })
    expect(getRunsSourceLabel("api")).toBe("API")
  })

  it("builds a completed row with singular scan target data", () => {
    const completedScan = mockScanList.items[0]
    expect(completedScan).toBeDefined()

    const completedRow: RunsRow = buildRunsRow(
      completedScan!,
      getMockScanListEnrichment(completedScan!.scanId),
      ["https://primary.example.test"],
      "https://primary.example.test/favicon.ico",
    )

    expect(completedRow.href).toBe(`/scans/${completedScan!.scanId}`)
    expect(completedRow.targetCount).toEqual({
      value: 1,
      label: "1 target",
    })
    expect(completedRow.targetUrls).toEqual(["https://primary.example.test"])
    expect(completedRow.hiddenTargetCount).toBe(0)
    expect(completedRow.faviconUrl).toBe("https://primary.example.test/favicon.ico")
    expect(completedRow.createdBy.label).toBe("Ada Lovelace")
    expect(completedRow.topTechnologies.searchTokens).toEqual([
      "WordPress",
      "WooCommerce",
      "PHP",
      "Jetpack",
      "MySQL",
      "Nginx",
    ])
  })

  it("builds page-facing rows for runs consumers", () => {
    const rows = buildMockRunsRows()

    expect(rows.map((row) => row.scanId)).toEqual(mockScanList.items.map((item) => item.scanId))
    expect(rows[1]?.targetUrls).toEqual(["https://queue.example.com"])
    expect(rows[0]?.faviconUrl).toBe("https://primary.example.test/favicon.ico")
    expect(rows[1]?.faviconUrl).toBe(null)
  })

  it("normalizes list query params for server-side pagination", () => {
    expect(parseRunsQuery()).toEqual({
      q: null,
      status: null,
      source: null,
      sort: "newest",
      cursor: null,
      limit: RUNS_DEFAULT_PAGE_LIMIT,
    })

    expect(
      parseRunsQuery(
        new URLSearchParams([
          ["q", "  WordPress  "],
          ["status", "completed"],
          ["source", "ui"],
          ["sort", "oldest"],
          ["cursor", "25"],
          ["limit", "10"],
        ]),
      ),
    ).toEqual({
      q: "wordpress",
      status: "completed",
      source: "ui",
      sort: "oldest",
      cursor: "25",
      limit: 10,
    })
  })

  it("applies the existing runs search semantics across scan id, creator, technologies, and targets", () => {
    const rows = buildMockRunsRows()

    expect(buildRunsListResponse(rows, new URLSearchParams([["q", "demo_recent"]])).items.map((row) => row.scanId)).toEqual([
      "scn_01J_demo_recent",
    ])
    expect(buildRunsListResponse(rows, new URLSearchParams([["q", "Ada"]])).items.map((row) => row.scanId)).toEqual([
      "scn_01J_demo_recent",
    ])
    expect(buildRunsListResponse(rows, new URLSearchParams([["q", "WooCommerce"]])).items.map((row) => row.scanId)).toEqual([
      "scn_01J_demo_recent",
    ])
    expect(buildRunsListResponse(rows, new URLSearchParams([["q", "queue.example.com"]])).items.map((row) => row.scanId)).toEqual([
      "scn_01J_demo_running",
    ])
  })

  it("filters by normalized status and source, sorts by submittedAt, and paginates with offset cursors", () => {
    const processingRow = buildRunsRow(
      {
        scanId: "scn_01J_demo_processing",
        status: "processing",
        source: "api",
        target: "https://api.example.com",
        faviconUrl: null,
        submittedAt: "2026-03-23T15:55:00.000Z",
        completedAt: null,
      },
      {
        createdBy: {
          label: "API Worker",
          kind: "system",
          userId: null,
          apiKeyId: null,
        },
        hiddenTargets: ["https://api.example.com"],
        topTechnologies: ["Redis"],
      },
      ["https://api.example.com"],
      null,
    )

    const rows = [...buildMockRunsRows(), processingRow]
    const response = buildRunsListResponse(
      rows,
      new URLSearchParams([
        ["status", "running"],
        ["sort", "oldest"],
        ["limit", "1"],
      ]),
    )

    expect(response.items.map((row) => row.scanId)).toEqual(["scn_01J_demo_processing"])
    expect(response.nextCursor).toBe("1")

    expect(
      buildRunsListResponse(
        rows,
        new URLSearchParams([
          ["status", "running"],
          ["source", "api"],
        ]),
      ).items.map((row) => row.scanId),
    ).toEqual(["scn_01J_demo_processing"])

    expect(
      buildRunsListResponse(
        rows,
        new URLSearchParams([
          ["status", "running"],
          ["sort", "oldest"],
          ["limit", "1"],
          ["cursor", "1"],
        ]),
      ).items.map((row) => row.scanId),
    ).toEqual(["scn_01J_demo_running"])
  })
})
