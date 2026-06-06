import { describe, expect, it } from "vitest"

import { formatDateOnlyInTimeZone, formatUtcInstant, parseDateBoundary } from "@/lib/time"

describe("time helpers", () => {
  it("formats UTC instants with an explicit timezone label", () => {
    expect(formatUtcInstant("2026-03-23T16:00:12.000Z", "fullDateTimeWithZone")).toBe(
      "Mar 23, 2026, 4:00 PM UTC",
    )
  })

  it("parses date-only boundaries in the supplied IANA timezone", () => {
    expect(parseDateBoundary("2026-06-02", "from", "America/New_York")).toBe("2026-06-02T04:00:00.000Z")
    expect(parseDateBoundary("2026-06-02", "to", "America/New_York")).toBe("2026-06-03T03:59:59.999Z")
  })

  it("honors daylight saving changes when parsing local calendar days", () => {
    expect(parseDateBoundary("2026-03-08", "from", "America/New_York")).toBe("2026-03-08T05:00:00.000Z")
    expect(parseDateBoundary("2026-03-08", "to", "America/New_York")).toBe("2026-03-09T03:59:59.999Z")
  })

  it("formats UTC boundaries back to date-only values in the supplied timezone", () => {
    expect(formatDateOnlyInTimeZone("2026-06-02T04:00:00.000Z", "America/New_York")).toBe("2026-06-02")
    expect(formatDateOnlyInTimeZone("2026-06-03T03:59:59.999Z", "America/New_York")).toBe("2026-06-02")
  })
})
