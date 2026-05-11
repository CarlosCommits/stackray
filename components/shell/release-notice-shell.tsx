"use client"

import { useCallback } from "react"
import { ExternalLink } from "lucide-react"

import { ReleaseNotice } from "./release-notice"
import { APP_VERSION } from "@/lib/version"
import type { StackrayReleaseMetadata } from "@/lib/contracts/app-updates"

interface ReleaseNoticeShellProps {
  lastSeenReleaseVersion: string | null
  currentRelease?: StackrayReleaseMetadata | null
}

export function ReleaseNoticeShell({ lastSeenReleaseVersion, currentRelease }: ReleaseNoticeShellProps) {
  const handleDismiss = useCallback(async (version: string) => {
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
  }, [])

  return (
    <ReleaseNotice
      currentVersion={APP_VERSION}
      lastSeenVersion={lastSeenReleaseVersion}
      releaseContent={currentRelease ? (
        <div className="space-y-3">
          {currentRelease.title ? (
            <p className="font-medium text-[var(--foreground)]">{currentRelease.title}</p>
          ) : null}
          {currentRelease.body ? (
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 font-mono text-xs leading-5 text-[var(--text-dim)]">
              {currentRelease.body}
            </div>
          ) : (
            <p>Stackray has been updated to v{currentRelease.version}.</p>
          )}
          {currentRelease.url ? (
            <a
              href={currentRelease.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent)]/80"
            >
              View release on GitHub
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : undefined}
      onDismiss={handleDismiss}
    />
  )
}
