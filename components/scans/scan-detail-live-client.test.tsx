import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ScanDetailLiveClient } from "@/components/scans/scan-detail-live-client"

const refreshMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}))

class MockEventSource {
  static instances: MockEventSource[] = []

  readonly listeners = new Map<string, Set<EventListener>>()
  onerror: ((event: Event) => void) | null = null
  closed = false

  constructor(readonly url: string) {
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }

  close() {
    this.closed = true
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type))
    }
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  refreshMock.mockReset()
  MockEventSource.instances = []
})

describe("ScanDetailLiveClient", () => {
  it("streams after the server-rendered event cursor", () => {
    vi.stubGlobal("EventSource", MockEventSource)

    render(<ScanDetailLiveClient scanId="scan_01" active latestEventId={42} />)

    expect(MockEventSource.instances[0]?.url).toBe("/api/v1/scans/scan_01/events?after=42")
  })

  it("debounces refreshes from bursty scan events", () => {
    vi.useFakeTimers()
    vi.stubGlobal("EventSource", MockEventSource)

    render(<ScanDetailLiveClient scanId="scan_01" active latestEventId={0} />)
    const source = MockEventSource.instances[0]

    source?.emit("scan.phase")
    source?.emit("scan.progress")
    source?.emit("scan.result")

    expect(refreshMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(999)
    expect(refreshMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("flushes pending refreshes and closes on terminal events", () => {
    vi.useFakeTimers()
    vi.stubGlobal("EventSource", MockEventSource)

    render(<ScanDetailLiveClient scanId="scan_01" active latestEventId={0} />)
    const source = MockEventSource.instances[0]

    source?.emit("scan.phase")
    source?.emit("scan.complete")
    vi.runAllTimers()

    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(source?.closed).toBe(true)
  })
})
