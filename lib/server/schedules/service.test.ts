import { describe, expect, it } from "vitest"

import { buildLastRunLabel } from "@/lib/server/schedules/service"

type ScheduleRunRecord = typeof import("@/lib/db/schema").scanScheduleRuns.$inferSelect
type ScanRecord = typeof import("@/lib/db/schema").scans.$inferSelect

function createRun(overrides: Partial<ScheduleRunRecord> = {}): ScheduleRunRecord {
  return {
    id: "schedule_run_01",
    scheduleId: "schedule_01",
    scanId: null,
    status: "queued",
    scheduledForAt: new Date("2026-04-12T13:00:00.000Z"),
    queuedAt: new Date("2026-04-12T13:00:01.000Z"),
    skipReason: null,
    errorMessage: null,
    createdAt: new Date("2026-04-12T13:00:01.000Z"),
    ...overrides,
  }
}

describe("buildLastRunLabel", () => {
  it("prefers the linked scan status when a scan exists", () => {
    expect(buildLastRunLabel(createRun({ scanId: "scan_01", status: "queued" }), "completed" satisfies ScanRecord["status"])).toBe("Completed")
    expect(buildLastRunLabel(createRun({ scanId: "scan_01", status: "queued" }), "running" satisfies ScanRecord["status"])).toBe("Running")
    expect(buildLastRunLabel(createRun({ scanId: "scan_01", status: "queued" }), "failed" satisfies ScanRecord["status"])).toBe("Failed")
  })

  it("preserves skipped schedule-level outcomes", () => {
    expect(
      buildLastRunLabel(
        createRun({ status: "skipped", skipReason: "Skipped because a previous scheduled scan is still active." }),
        null,
      ),
    ).toBe("Skipped because a previous scheduled scan is still active.")
  })

  it("preserves schedule-level failures when no linked scan exists", () => {
    expect(
      buildLastRunLabel(
        createRun({ status: "failed", errorMessage: "The schedule owner could not be resolved." }),
        null,
      ),
    ).toBe("The schedule owner could not be resolved.")
  })

  it("falls back to queued when no linked scan status is available", () => {
    expect(buildLastRunLabel(createRun({ status: "queued", scanId: null }), null)).toBe("Queued")
  })
})
