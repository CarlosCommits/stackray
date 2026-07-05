"use client"

type UmamiTrack = {
  (eventName: string, data?: Record<string, unknown>): void
}

declare global {
  interface Window {
    umami?: {
      track?: UmamiTrack
    }
  }
}

export function trackStackrayEvent(eventName: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.umami?.track !== "function") {
    return
  }

  try {
    window.umami.track(eventName, data)
  } catch {
    // Analytics must never affect product behavior.
  }
}
