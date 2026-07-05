import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import {
  CreateScheduleDialog,
  formatStoredTimeOfDay,
  parseStoredTimeOfDay,
} from "@/components/schedules/create-schedule-dialog"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("schedule time helpers", () => {
  it("parses stored 24-hour times into 12-hour controls", () => {
    expect(parseStoredTimeOfDay("09:00")).toEqual({
      timeHour: "9",
      timeMinute: "00",
      timePeriod: "AM",
    })

    expect(parseStoredTimeOfDay("12:30")).toEqual({
      timeHour: "12",
      timeMinute: "30",
      timePeriod: "PM",
    })

    expect(parseStoredTimeOfDay("00:15")).toEqual({
      timeHour: "12",
      timeMinute: "15",
      timePeriod: "AM",
    })
  })

  it("formats 12-hour control values back into 24-hour payload values", () => {
    expect(formatStoredTimeOfDay("9", "00", "AM")).toBe("09:00")
    expect(formatStoredTimeOfDay("12", "00", "AM")).toBe("00:00")
    expect(formatStoredTimeOfDay("12", "15", "PM")).toBe("12:15")
    expect(formatStoredTimeOfDay("3", "45", "PM")).toBe("15:45")
  })
})

describe("CreateScheduleDialog", () => {
  it("blocks invalid minute values from replacing the current input", () => {
    render(
      <CreateScheduleDialog
        open
        onOpenChange={() => undefined}
      />,
    )

    const minuteInput = screen.getByLabelText("Minute") as HTMLInputElement
    fireEvent.change(minuteInput, { target: { value: "99" } })

    expect(minuteInput.value).toBe("00")
  })

  it("renders hour, minute, AM/PM, and timezone controls", () => {
    render(
      <CreateScheduleDialog
        open
        onOpenChange={() => undefined}
      />,
    )

    expect(screen.getByLabelText("Hour")).toBeTruthy()
    expect(screen.getByLabelText("Minute")).toBeTruthy()
    const comboboxes = screen.getAllByRole("combobox")
    expect(comboboxes.length).toBeGreaterThanOrEqual(3)
  })

  it("hides the submit action in demo mode", () => {
    render(
      <CreateScheduleDialog
        open
        demoMode
        onOpenChange={() => undefined}
      />,
    )

    expect(screen.queryByRole("button", { name: "Create Schedule" })).toBeNull()
  })
})
