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
import { buildRunsRow, buildRunsRows } from "@/lib/queries/runs"

describe("/runs row contract", () => {
  it("locks the canonical column order", () => {
    expect(RUNS_COLUMNS).toEqual([
      { key: "submittedAt", label: "Submitted at" },
      { key: "targetCount", label: "Target count" },
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

  it("builds a completed row with visible target urls and hidden count", () => {
    const completedScan = mockScanList.items[0]
    expect(completedScan).toBeDefined()

    const completedRow: RunsRow = buildRunsRow(
      completedScan!,
      getMockScanListEnrichment(completedScan!.scanId),
      ["https://primary.example.test", "primary.example.test", "shop.primary.example.test", "checkout.primary.example.test"],
    )

    expect(completedRow.href).toBe(`/scans/${completedScan!.scanId}`)
    expect(completedRow.targetCount).toEqual({
      value: 1,
      label: "1 target",
    })
    expect(completedRow.targetUrls).toEqual(["https://primary.example.test", "primary.example.test", "shop.primary.example.test"])
    expect(completedRow.hiddenTargetCount).toBe(1)
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
    const rows = buildRunsRows(
      mockScanList.items,
      getMockScanListEnrichment,
      (scanId) => (scanId === "scn_01J_demo_recent" ? ["https://primary.example.test"] : ["https://queue.example.com"]),
    )

    expect(rows.map((row) => row.scanId)).toEqual(mockScanList.items.map((item) => item.scanId))
    expect(rows[1]?.targetUrls).toEqual(["https://queue.example.com"])
  })
})
