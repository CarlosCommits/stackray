"use client"

import { useSearchParams } from "next/navigation"

import { GettingStartedShell } from "./getting-started-shell"

interface SetupCompleteGettingStartedShellProps {
  enabled?: boolean
}

export function SetupCompleteGettingStartedShell({ enabled }: SetupCompleteGettingStartedShellProps) {
  const searchParams = useSearchParams()

  if (!enabled || searchParams.get("stackraySetupComplete") !== "1") {
    return null
  }

  return <GettingStartedShell />
}
