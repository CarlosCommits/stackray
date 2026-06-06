import { render, screen, waitFor } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { LocalTime } from "@/components/ui/local-time"
import { TimeZoneProvider, useTimeZone } from "@/components/ui/time-zone-provider"
import { BROWSER_TIME_ZONE_COOKIE_NAME } from "@/lib/time"

function clearTimeZoneCookie() {
  document.cookie = `${BROWSER_TIME_ZONE_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
}

function TimeZoneProbe() {
  const { timeZone } = useTimeZone()

  return <span>{timeZone ?? "none"}</span>
}

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

afterEach(() => {
  clearTimeZoneCookie()
})

describe("LocalTime", () => {
  it("reserves hidden UTC text on first render when no timezone cookie is available", () => {
    const html = renderToString(
      <TimeZoneProvider initialTimeZone={null}>
        <LocalTime value="2026-03-23T16:00:12.000Z" />
      </TimeZoneProvider>,
    )

    expect(html).toContain("visibility:hidden")
    expect(html).toContain("Mar 23, 2026, 4:00 PM UTC")
  })

  it("renders visible cookie timezone text on the server when available", () => {
    const html = renderToString(
      <TimeZoneProvider initialTimeZone="America/New_York">
        <LocalTime value="2026-03-23T16:00:12.000Z" />
      </TimeZoneProvider>,
    )

    expect(html).not.toContain("visibility:hidden")
    expect(html).toContain("Mar 23, 2026, 12:00 PM EDT")
  })

  it("stores the browser timezone cookie after hydration", async () => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    render(
      <TimeZoneProvider initialTimeZone={null}>
        <TimeZoneProbe />
      </TimeZoneProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(browserTimeZone)).toBeInTheDocument()
    })
    expect(document.cookie).toContain(`${BROWSER_TIME_ZONE_COOKIE_NAME}=${browserTimeZone}`)
  })
})
