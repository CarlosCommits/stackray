"use client"

import { useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { ExternalLink } from "lucide-react"

import { ReleaseNotice } from "./release-notice"
import { ReleaseNotesMarkdown } from "./release-notes-markdown"
import { APP_VERSION } from "@/lib/version"
import type { StackrayReleaseMetadata } from "@/lib/contracts/app-updates"

interface ReleaseNoticeShellProps {
  lastSeenReleaseVersion: string | null
  currentRelease?: StackrayReleaseMetadata | null
  enableDevPreview?: boolean
}

export function ReleaseNoticeShell({ lastSeenReleaseVersion, currentRelease, enableDevPreview }: ReleaseNoticeShellProps) {
  const searchParams = useSearchParams()
  const showDevPreview = Boolean(enableDevPreview) && searchParams.get("stackrayPostUpdatePreview") === "1"
  const effectiveLastSeenReleaseVersion = showDevPreview ? "__stackray_dev_preview_previous_release__" : lastSeenReleaseVersion
  const handleDismiss = useCallback(async (version: string) => {
    if (showDevPreview) {
      return
    }

    try {
      const response = await fetch("/api/v1/me/product-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastSeenReleaseVersion: version }),
      })

      if (!response.ok) {
        console.error(`Unable to persist release version ${version}.`)
      }
    } catch (error) {
      console.error("Failed to persist release version", error)
    }
  }, [showDevPreview])

  return (
    <ReleaseNotice
      currentVersion={APP_VERSION}
      lastSeenVersion={effectiveLastSeenReleaseVersion}
      releaseContent={currentRelease ? (
        <div className="space-y-3">
          {(currentRelease.title || currentRelease.url) && (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              {currentRelease.title ? (
                <p className="font-medium text-[var(--foreground)]">{currentRelease.title}</p>
              ) : <span aria-hidden="true" />}
              {currentRelease.url ? (
                <a
                  href={currentRelease.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-200 hover:text-emerald-100"
                >
                  View release on GitHub
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          )}
          {currentRelease.body ? (
            <ReleaseNotesMarkdown markdown={currentRelease.body} scrollable={false} />
          ) : (
            <p>Stackray has been updated to v{currentRelease.version}.</p>
          )}
        </div>
      ) : undefined}
      onDismiss={handleDismiss}
    />
  )
}
