"use client"

import { useId, useState, type ComponentProps, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import type { CreateScanResponse } from "@/lib/contracts/scans"
import type { RecentScan } from "@/components/dashboard/types"

interface SearchCommandBarProps {
  onScanQueued?: (scan: RecentScan) => void
}

function buildQueuedScanCard(target: string, payload: CreateScanResponse): RecentScan {
  const timestamp = new Date().toISOString()

  switch (payload.status) {
    case "completed":
      return {
        id: payload.scanId,
        target,
        ip: "-",
        status: "complete",
        phase: "complete",
        phaseLabel: "Completed",
        timestamp,
        progress: 100,
        technologies: [],
        isNew: true,
      }
    case "failed":
    case "cancelled":
      return {
        id: payload.scanId,
        target,
        ip: "-",
        status: "failed",
        phase: "failed",
        phaseLabel: payload.status === "cancelled" ? "Cancelled" : "Failed",
        error: payload.status === "cancelled" ? "Cancelled" : "Scan failed",
        timestamp,
        isNew: true,
      }
    case "running":
      return {
        id: payload.scanId,
        target,
        ip: "-",
        status: "analyzing",
        phase: "httpx",
        phaseLabel: "HTTP probe",
        phaseDescription: "Collecting HTTP and headless browser signals",
        timestamp,
        progress: 35,
        isNew: true,
      }
    case "processing":
      return {
        id: payload.scanId,
        target,
        ip: "-",
        status: "analyzing",
        phase: "enrichment",
        phaseLabel: "Enrichment",
        phaseDescription: "Running post-probe Nuclei and metadata enrichment",
        timestamp,
        progress: 75,
        isNew: true,
      }
    case "pending":
    case "queued":
      return {
        id: payload.scanId,
        target,
        ip: "-",
        status: "analyzing",
        phase: "queued",
        phaseLabel: "Queued",
        phaseDescription: "Waiting for worker capacity",
        timestamp,
        progress: 5,
        isNew: true,
      }
  }
}

export function SearchCommandBar({ onScanQueued }: SearchCommandBarProps) {
  const router = useRouter()
  const [target, setTarget] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputId = useId()

  const handleQueueScan = async () => {
    if (isSubmitting) {
      return
    }

    const trimmedTarget = target.trim()

    if (!trimmedTarget) {
      router.push("/scans/new")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/v1/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: trimmedTarget,
          options: {
            followRedirects: true,
            includeRawResponse: false,
            headless: false,
          },
          client: {
            source: "ui",
          },
        }),
      })

      if (!response.ok) {
        router.push(`/scans/new?target=${encodeURIComponent(trimmedTarget)}`)
        return
      }

      const payload = await response.json() as CreateScanResponse
      if (onScanQueued) {
        onScanQueued(buildQueuedScanCard(trimmedTarget, payload))
      } else {
        router.refresh()
      }
      setTarget("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault()
    await handleQueueScan()
  }

  const handleInputKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return
    }

    event.preventDefault()
    await handleQueueScan()
  }

  return (
    <form className="mb-6 w-full" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="sr-only">
        Target domain or URL
      </label>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
        <InputGroup className="h-auto flex-1 rounded-xl border-[var(--gray-border)] bg-[var(--surface-mid)] px-2 py-1 shadow-2xl has-[data-slot=input-group-control]:focus-within:border-[var(--accent)] has-[data-slot=input-group-control]:focus-within:ring-2 has-[data-slot=input-group-control]:focus-within:ring-[var(--accent)]/50">
          <InputGroupAddon align="inline-start" className="pl-0.5">
            <Search className="size-4 text-[var(--accent)]" />
          </InputGroupAddon>
          <InputGroupInput
            id={inputId}
            name="target"
            type="text"
            autoComplete="off"
            placeholder="Enter a domain or URL..."
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            onKeyDown={handleInputKeyDown}
            className="h-10 px-1 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--text-dim)]/40"
          />
        </InputGroup>

        <div className="shrink-0">
          <Button
            type="submit"
            size="default"
            className="h-10 w-full min-w-36 justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary-foreground)] shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent)]/85 hover:shadow-[var(--accent)]/30 sm:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Queueing..." : "Scan"}
          </Button>
        </div>
      </div>
    </form>
  )
}
