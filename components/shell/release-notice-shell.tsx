"use client"

import { useCallback } from "react"
import { ReleaseNotice } from "./release-notice"
import { APP_VERSION } from "@/lib/version"
import { getReleaseByVersion } from "@/lib/releases/registry"

interface ReleaseNoticeShellProps {
  lastSeenReleaseVersion: string | null
}

export function ReleaseNoticeShell({ lastSeenReleaseVersion }: ReleaseNoticeShellProps) {
  const release = getReleaseByVersion(APP_VERSION)

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
      releaseContent={release ? (
        <div className="space-y-3">
          <p className="font-medium text-[var(--foreground)]">{release.title}</p>
          <ul className="list-disc space-y-2 pl-5">
            {release.summary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : undefined}
      onDismiss={handleDismiss}
    />
  )
}
