"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { AlertTriangle, X } from "lucide-react"

import { APP_VERSION } from "@/lib/version"
import type { StackrayUpdateStatus } from "@/lib/contracts/app-updates"

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/runs": "Runs",
  "/targets": "Targets",
  "/schedules": "Schedules",
  "/settings/tokens": "Tokens",
  "/settings/api-docs": "API Docs",
  "/settings/users": "Users",
  "/scans/new": "New Scan",
}

interface HeaderProps {
  stackrayUpdateStatus?: StackrayUpdateStatus | null
}

function formatStackrayUpdateSummary(status: StackrayUpdateStatus) {
  return `v${status.currentVersion} -> v${status.latestVersion}`
}

export function Header({ stackrayUpdateStatus }: HeaderProps) {
  const pathname = usePathname()
  const [dismissedFingerprint, setDismissedFingerprint] = useState<string | null>(null)
  const title =
    routeTitles[pathname] ??
    (pathname.startsWith("/scans/") ? "Scan Detail" : pathname.startsWith("/targets/") ? "Target Timeline" : "Dashboard")
  const stackrayUpdateSummary = useMemo(
    () => stackrayUpdateStatus ? formatStackrayUpdateSummary(stackrayUpdateStatus) : null,
    [stackrayUpdateStatus],
  )
  const stackrayUpdateStorageKey = stackrayUpdateStatus
    ? `stackray:update-dismissed:${stackrayUpdateStatus.fingerprint}`
    : null
  const showStackrayUpdateBanner =
    Boolean(stackrayUpdateStatus?.updateAvailable) &&
    stackrayUpdateStatus?.fingerprint !== dismissedFingerprint

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!stackrayUpdateStorageKey || !stackrayUpdateStatus) {
        setDismissedFingerprint(null)
        return
      }

      setDismissedFingerprint(window.localStorage.getItem(stackrayUpdateStorageKey) === "true" ? stackrayUpdateStatus.fingerprint : null)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [stackrayUpdateStatus, stackrayUpdateStorageKey])

  const dismissStackrayUpdateBanner = () => {
    if (!stackrayUpdateStorageKey || !stackrayUpdateStatus) {
      return
    }

    window.localStorage.setItem(stackrayUpdateStorageKey, "true")
    setDismissedFingerprint(stackrayUpdateStatus.fingerprint)
  }

  return (
    <>
      <header className="h-14 border-b border-[var(--gray-border)] bg-[var(--surface-dark)]/90 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="font-heading text-lg font-semibold text-[var(--accent)]">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2 text-[var(--text-dim)]">
          {stackrayUpdateStatus?.updateAvailable && stackrayUpdateSummary && (
            <span
              title={`Stackray update available. Redeploy to apply the latest tested scanner and app updates. ${stackrayUpdateSummary}`}
              aria-label="Stackray update available"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-400/35 bg-amber-400/10 text-amber-200"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
          <span className="text-[10px] font-mono">v{APP_VERSION}</span>
        </div>
      </header>
      {stackrayUpdateStatus?.updateAvailable && stackrayUpdateSummary && showStackrayUpdateBanner && (
        <div className="border-b border-amber-400/25 bg-amber-400/10 px-6 py-2 text-sm text-amber-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
              <p className="min-w-0 truncate">
                Stackray update available. Redeploy to apply the latest tested scanner and app updates.{" "}
                <span className="text-amber-100/75">{stackrayUpdateSummary}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={dismissStackrayUpdateBanner}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-amber-100/75 transition hover:bg-amber-400/15 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
              aria-label="Dismiss Stackray update banner"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
