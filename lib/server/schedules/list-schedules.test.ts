import { beforeEach, describe, expect, it, vi } from "vitest"

class QueryChain<T> extends Promise<T> {
  static resolveValue<T>(value: T) {
    return new QueryChain<T>((resolve) => resolve(value))
  }

  from() {
    return this
  }

  where() {
    return this
  }

  orderBy() {
    return this
  }
}

function createQueryChain<T>(result: T) {
  return QueryChain.resolveValue(result)
}

const selectMock = vi.fn()

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock,
  },
}))

vi.mock("@/lib/authorization/authz", () => ({
  isAdmin: () => false,
}))

vi.mock("@/lib/server/scans/access", () => ({
  assertCanRunScans: () => undefined,
}))

describe("listSchedules", () => {
  beforeEach(() => {
    selectMock.mockReset()
  })

  it("uses the linked scan status for the last run label", async () => {
    selectMock
      .mockImplementationOnce(() =>
        createQueryChain([
          {
            id: "schedule_01",
            createdByUserId: "user_01",
            frequency: "daily",
            hour: 9,
            minute: 0,
            weekday: null,
            dayOfMonth: null,
            timezone: "America/New_York",
            enabled: true,
            optionsJson: { followRedirects: true },
            targetCount: 1,
            nextRunAt: new Date("2026-04-13T13:00:00.000Z"),
            createdAt: new Date("2026-04-11T13:00:00.000Z"),
            updatedAt: new Date("2026-04-11T13:00:00.000Z"),
          },
        ]),
      )
      .mockImplementationOnce(() =>
        createQueryChain([
          {
            id: "target_01",
            scheduleId: "schedule_01",
            canonicalTargetId: null,
            inputTarget: "https://example.com",
            normalizedTarget: "https://example.com/",
            sortOrder: 0,
            createdAt: new Date("2026-04-11T13:00:00.000Z"),
          },
        ]),
      )
      .mockImplementationOnce(() =>
        createQueryChain([
          {
            id: "run_01",
            scheduleId: "schedule_01",
            status: "queued",
            scheduledForAt: new Date("2026-04-12T13:00:00.000Z"),
            queuedAt: new Date("2026-04-12T13:00:01.000Z"),
            queuedScanCount: 1,
            skipReason: null,
            errorMessage: null,
            createdAt: new Date("2026-04-12T13:00:01.000Z"),
          },
        ]),
      )
      .mockImplementationOnce(() =>
        createQueryChain([
          {
            id: "run_scan_01",
            scheduleRunId: "run_01",
            scanId: "scan_01",
            sortOrder: 0,
            createdAt: new Date("2026-04-12T13:00:01.000Z"),
          },
        ]),
      )
      .mockImplementationOnce(() =>
        createQueryChain([
          {
            id: "scan_01",
            status: "completed",
          },
        ]),
      )

    const { listSchedules } = await import("@/lib/server/schedules/service")

    const result = await listSchedules({
      user: { id: "user_01", role: "user" },
      source: "ui",
      token: null,
    } as never)

    expect(result.items[0]).toMatchObject({
      scheduleId: "schedule_01",
      lastScanId: "scan_01",
      lastRunStatus: "queued",
      lastRunLabel: "Completed",
    })
  })
})
