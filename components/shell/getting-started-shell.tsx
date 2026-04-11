"use client"

import { useCallback } from "react"
import { GettingStartedDialog } from "./getting-started-dialog"

export function GettingStartedShell() {
  const handleDismiss = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/me/product-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gettingStartedDismissedAt: new Date().toISOString() }),
      })

      if (!response.ok) {
        console.error("Unable to persist getting-started dismissal.")
      }
    } catch (error) {
      console.error("Failed to persist getting-started dismissal", error)
    }
  }, [])

  return <GettingStartedDialog onDismiss={handleDismiss} />
}