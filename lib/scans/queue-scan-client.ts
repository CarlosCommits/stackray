"use client"

import { trackStackrayEvent } from "@/lib/analytics"
import type { CreateScanResponse } from "@/lib/contracts/scans"

export type ScanQueueSource = "subdomain" | "target_profile"

export class DemoScanQuotaExceededError extends Error {
  constructor() {
    super("The demo scan quota has been reached.")
    this.name = "DemoScanQuotaExceededError"
  }
}

export async function queueScanFromUi({
  source,
  target,
}: {
  source: ScanQueueSource
  target: string
}) {
  trackStackrayEvent("scan_submit_clicked", { source })

  let response: Response

  try {
    response = await fetch("/api/v1/scans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target,
        options: {
          followRedirects: true,
          includeRawResponse: false,
        },
        client: {
          source: "ui",
        },
      }),
    })
  } catch (error) {
    trackStackrayEvent("scan_create_failed", { source, failure_type: "network" })
    throw error
  }

  const body = await response.json().catch(() => null)

  if (response.status === 429 && body?.error?.code === "demo_scan_rate_limit_exceeded") {
    trackStackrayEvent("demo_quota_hit", { source })
    throw new DemoScanQuotaExceededError()
  }

  if (!response.ok) {
    trackStackrayEvent("scan_create_failed", {
      source,
      failure_type: response.status >= 500 ? "server" : "validation",
    })
    throw new Error(body?.error?.message ?? "Unable to queue the scan.")
  }

  const payload = body as CreateScanResponse
  trackStackrayEvent("scan_created", {
    source,
    reused: payload.reused,
    status: payload.status,
  })

  return payload
}
