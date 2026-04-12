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
    options: {
      followRedirects: true,
    },
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

    fireEvent.click(screen.getByRole("button", { name: /^schedule$/i }))

    expect(screen.getByRole("heading", { name: "Create Schedule" })).toBeTruthy()
    expect(screen.getByLabelText("Targets")).toBeTruthy()
  })

  it("opens the edit dialog with the selected schedule prefilled", () => {
    render(<SchedulesClient initialSchedules={mockSchedules} />)

    const editButtons = screen.getAllByRole("button", { name: /edit schedule/i })
    fireEvent.click(editButtons[0])

    expect(screen.getByRole("heading", { name: "Edit Schedule" })).toBeTruthy()
    expect(screen.getByLabelText("Targets")).toHaveValue("https://example.com/")
  })

  it("opens a delete confirmation dialog before removing a schedule", () => {
    render(<SchedulesClient initialSchedules={mockSchedules} />)

    const deleteButtons = screen.getAllByRole("button", { name: /delete schedule/i })
    fireEvent.click(deleteButtons[0])

    expect(screen.getByRole("heading", { name: "Delete schedule" })).toBeTruthy()
    expect(screen.getByText(/this action cannot be undone/i)).toBeTruthy()
  })

  it("renders last run information and a run link", () => {
    render(<SchedulesClient initialSchedules={mockSchedules} />)

    expect(screen.getAllByText("Queued").length).toBeGreaterThanOrEqual(1)
    const viewRunLinks = screen.getAllByRole("link", { name: /view run/i })
    expect(viewRunLinks[0]).toHaveAttribute("href", "/scans/scan_001")
  })

  it("filters schedules by search input", () => {
    const twoSchedules: ScheduleListItem[] = [
      {
        scheduleId: "sch_001",
        targets: ["https://example.com/"],
        options: { followRedirects: true },
        frequency: "daily",
        timeOfDay: "09:00",
        weekday: null,
        dayOfMonth: null,
        timezone: "America/New_York",
        enabled: true,
        nextRunAt: "2026-04-12T13:00:00.000Z",
        lastScheduledForAt: null,
        lastScanId: null,
        lastRunStatus: null,
        lastRunLabel: null,
        createdAt: "2026-04-11T23:29:38.399Z",
      },
      {
        scheduleId: "sch_002",
        targets: ["https://alternate.example.test/"],
        options: { followRedirects: true },
        frequency: "weekly",
        timeOfDay: "14:00",
        weekday: 1,
        dayOfMonth: null,
        timezone: "Europe/London",
        enabled: false,
        nextRunAt: "2026-04-13T14:00:00.000Z",
        lastScheduledForAt: null,
        lastScanId: null,
        lastRunStatus: null,
        lastRunLabel: null,
        createdAt: "2026-04-11T23:29:38.399Z",
      },
    ]

    render(<SchedulesClient initialSchedules={twoSchedules} />)

    expect(screen.getAllByText("https://example.com/").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("https://alternate.example.test/").length).toBeGreaterThanOrEqual(1)

    const searchInput = screen.getByLabelText("Search schedules")
    fireEvent.change(searchInput, { target: { value: "London" } })

    expect(screen.getAllByText("https://alternate.example.test/").length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText("https://example.com/")).toBeNull()
  })
})