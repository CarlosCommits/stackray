import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { SchedulesClient } from "@/components/schedules/schedules-client"
import type { ScheduleListItem } from "@/lib/contracts/schedules"

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

const mockSchedules: ScheduleListItem[] = [
  {
    scheduleId: "sch_001",
    targets: ["https://example.com/"],
    frequency: "daily",
    timeOfDay: "09:00",
    weekday: null,
    dayOfMonth: null,
    timezone: "America/New_York",
    enabled: true,
    nextRunAt: "2026-04-12T13:00:00.000Z",
    lastScheduledForAt: "2026-04-11T23:29:12.275Z",
    lastScanId: "scan_001",
    lastRunStatus: "queued",
    lastRunLabel: "Queued",
    createdAt: "2026-04-11T23:29:38.399Z",
  },
]

describe("SchedulesClient", () => {
  it("opens the create schedule dialog from the page action", () => {
    render(<SchedulesClient initialSchedules={mockSchedules} />)

    fireEvent.click(screen.getByRole("button", { name: /\+ schedule/i }))

    expect(screen.getByRole("heading", { name: "Create Schedule" })).toBeTruthy()
    expect(screen.getByLabelText("Targets")).toBeTruthy()
  })

  it("renders last run information and a run link", () => {
    render(<SchedulesClient initialSchedules={mockSchedules} />)

    expect(screen.getByText("Last run: Queued")).toBeTruthy()
    expect(screen.getByRole("link", { name: /view run/i })).toHaveAttribute("href", "/scans/scan_001")
  })
})
