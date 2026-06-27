"use client"

import { useSyncExternalStore } from "react"

const MOBILE_EXPORT_CAPTURE_QUERY = "(max-width: 767px)"

function subscribeToMobileExportViewport(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {}
  }

  const query = window.matchMedia(MOBILE_EXPORT_CAPTURE_QUERY)

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", callback)
    return () => query.removeEventListener("change", callback)
  }

  if (typeof query.addListener === "function") {
    query.addListener(callback)
    return () => query.removeListener(callback)
  }

  return () => {}
}

function readMobileExportViewportSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }

  return window.matchMedia(MOBILE_EXPORT_CAPTURE_QUERY).matches
}

export function useMobileExportCapture() {
  return useSyncExternalStore(
    subscribeToMobileExportViewport,
    readMobileExportViewportSnapshot,
    () => false,
  )
}
