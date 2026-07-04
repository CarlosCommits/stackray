"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { CloudDownload, ExternalLink, X } from "lucide-react"

import { APP_VERSION } from "@/lib/version"
import type { StackrayUpdateStatus } from "@/lib/contracts/app-updates"
import { ReleaseNotesMarkdown } from "@/components/shell/release-notes-markdown"
import { Button } from "@/components/ui/button"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/runs": "Runs",
  "/targets": "Targets",
  "/technology-compare": "Technology Comparison",
  "/schedules": "Schedules",
  "/settings/api-keys": "API Keys",
  "/settings/api-docs": "API Docs",
  "/settings/account": "Account",
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
  const [dismissedFingerprint, setDismissedFingerprint] = useState<string | null | undefined>(undefined)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
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
    dismissedFingerprint !== undefined &&
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
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-3 border-b border-[var(--gray-border)] bg-[var(--surface-dark)]/90 px-4 pl-16 backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <h1 className="truncate font-heading text-base font-semibold text-[var(--accent)] sm:text-lg">
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-[var(--text-dim)]">
          {stackrayUpdateStatus?.updateAvailable && stackrayUpdateSummary && (
            <button
              type="button"
              onClick={() => setUpdateDialogOpen(true)}
              title={`Stackray update available. Deploy the latest release to apply the latest tested scanner and app updates. ${stackrayUpdateSummary}`}
              aria-label="View Stackray update details"
              className="inline-flex size-7 items-center justify-center rounded-md border border-amber-400/35 bg-amber-400/10 text-amber-200 transition hover:bg-amber-400/15 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
            >
              <CloudDownload className="size-3.5" aria-hidden="true" />
            </button>
          )}
          <span className="text-[10px] font-mono">v{APP_VERSION}</span>
        </div>
      </header>
      {stackrayUpdateStatus?.updateAvailable && stackrayUpdateSummary && showStackrayUpdateBanner && (
        <div className="border-b border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 sm:px-4 sm:pl-16 sm:text-sm md:px-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <CloudDownload className="size-3.5 shrink-0 text-amber-200 sm:size-4" aria-hidden="true" />
              <p className="min-w-0 whitespace-normal sm:truncate">
                <span className="sm:hidden">Update available. </span>
                <span className="hidden sm:inline">
                  Stackray update available. Deploy the latest release to apply scanner and app updates.{" "}
                </span>
                <span className="text-amber-100/75">{stackrayUpdateSummary}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={() => setUpdateDialogOpen(true)}
                aria-label="View details"
                className="cursor-pointer rounded-md px-1.5 py-1 text-xs font-medium text-amber-100/90 transition hover:bg-amber-400/15 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 sm:px-2"
              >
                <span className="sm:hidden" aria-hidden="true">Details</span>
                <span className="hidden sm:inline" aria-hidden="true">View details</span>
              </button>
              <button
                type="button"
                onClick={dismissStackrayUpdateBanner}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-amber-100/75 transition hover:bg-amber-400/15 hover:text-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 sm:size-7"
                aria-label="Dismiss Stackray update banner"
              >
                <X className="size-3.5 sm:size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
      {stackrayUpdateStatus?.updateAvailable && stackrayUpdateSummary ? (
        <ResponsiveModal open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} drawerProps={{ repositionInputs: false }}>
          <ResponsiveModalContent
            desktopClassName="grid max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:!max-w-lg sm:max-h-[85vh]"
            mobileClassName="h-[92svh] overflow-hidden p-0"
          >
            <ResponsiveModalHeader className="px-4 pb-3 pt-4 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left sm:px-5 sm:pt-5">
              <ResponsiveModalTitle className="flex items-center gap-2">
                <CloudDownload className="size-4 text-amber-300" aria-hidden="true" />
                Stackray update available
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                Deploy the latest release to apply scanner and app updates. On Railway, use Deploy Latest Commit for the
                Stackray services instead of redeploying the existing deployment.
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>

            <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-2 text-sm sm:px-5">
              <div className="grid grid-cols-2 gap-3 rounded-md border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 font-mono text-xs">
                <div>
                  <p className="mb-1 text-[var(--text-dim)]">Current</p>
                  <p className="text-[var(--foreground)]">v{stackrayUpdateStatus.currentVersion}</p>
                </div>
                <div>
                  <p className="mb-1 text-[var(--text-dim)]">Latest</p>
                  <p className="text-[var(--foreground)]">v{stackrayUpdateStatus.latestVersion}</p>
                </div>
              </div>

              {(stackrayUpdateStatus.latestRelease?.title || stackrayUpdateStatus.latestUrl) && (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  {stackrayUpdateStatus.latestRelease?.title ? (
                    <p className="font-medium text-[var(--foreground)]">{stackrayUpdateStatus.latestRelease.title}</p>
                  ) : <span aria-hidden="true" />}
                  {stackrayUpdateStatus.latestUrl ? (
                    <a
                      href={stackrayUpdateStatus.latestUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-200 hover:text-amber-100"
                    >
                      View release on GitHub
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              )}

              {stackrayUpdateStatus.latestRelease?.body ? (
                <ReleaseNotesMarkdown markdown={stackrayUpdateStatus.latestRelease.body} scrollable={false} />
              ) : (
                <p className="text-[var(--text-dim)]">
                  Release notes are available from the latest Stackray release.
                </p>
              )}

              <div className="rounded-md border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 text-xs leading-5 text-[var(--text-dim)]">
                <p className="mb-1 font-medium text-[var(--foreground)]">Railway update steps</p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Open the Railway project that hosts Stackray.</li>
                  <li>
                    For <span className="font-mono text-[var(--foreground)]">Stackray-website</span>,{" "}
                    <span className="font-mono text-[var(--foreground)]">worker-http</span>,{" "}
                    <span className="font-mono text-[var(--foreground)]">worker-intel</span>, and{" "}
                    <span className="font-mono text-[var(--foreground)]">worker-browser</span>, open the service command palette.
                  </li>
                  <li>Run Deploy Latest Commit so Railway builds the latest connected GitHub commit.</li>
                </ol>
              </div>
            </div>
            <ResponsiveModalFooter className="mx-0 mb-0 flex-col-reverse rounded-b-xl border-t border-[var(--gray-border)]/50 bg-[var(--surface-mid)]/45 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:px-5">
              <Button size="sm" onClick={() => setUpdateDialogOpen(false)}>
                Done
              </Button>
            </ResponsiveModalFooter>
          </ResponsiveModalContent>
        </ResponsiveModal>
      ) : null}
    </>
  )
}
