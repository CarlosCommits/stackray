"use client"

import { useId, useState, type ComponentProps, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { BorderRotate } from "@/components/ui/animated-gradient-border"
import { Separator } from "@/components/ui/separator"
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
        techCount: 0,
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
        phaseLabel: "Discovery & enrichment",
        phaseDescription: "Running Subfinder, Nuclei, and metadata enrichment",
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
  const { push, refresh } = useRouter()
  const [target, setTarget] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputId = useId()

  const handleQueueScan = async () => {
    if (isSubmitting) {
      return
    }

    const trimmedTarget = target.trim()

    if (!trimmedTarget) {
      push("/scans/new")
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
        push(`/scans/new?target=${encodeURIComponent(trimmedTarget)}`)
        return
      }

      const payload = await response.json() as CreateScanResponse
      if (onScanQueued) {
        onScanQueued(buildQueuedScanCard(trimmedTarget, payload))
      } else {
        refresh()
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
    <form
      role="search"
      className="sticky top-0 z-30 -mx-8 mb-6 w-auto px-8 py-2"
      onSubmit={handleSubmit}
    >
      <label htmlFor={inputId} className="sr-only">
        Target domain or URL
      </label>
      <div className="mx-auto w-full max-w-5xl rounded-[14px] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--gray-charcoal)_94%,transparent)_0%,color-mix(in_srgb,var(--gray-charcoal)_88%,transparent)_72%,transparent_100%)] p-2 backdrop-blur">
        <InputGroup className="h-12 rounded-[10px] border-[var(--gray-border)] bg-[var(--surface-dark)] px-3 shadow-[0_14px_36px_rgb(0_0_0_/_0.24),inset_0_1px_0_rgb(255_255_255_/_0.05)] transition-[border-color,box-shadow] focus-within:border-[var(--accent)] focus-within:shadow-[0_14px_36px_rgb(0_0_0_/_0.28),0_0_0_2px_rgb(251_191_36_/_0.14),inset_0_1px_0_rgb(255_255_255_/_0.05)] has-[[data-slot=input-group-control]:focus-visible]:ring-1 sm:h-14 sm:px-4">
          <InputGroupInput
            id={inputId}
            name="target"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoFocus
            spellCheck={false}
            placeholder="Enter a domain or URL…"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            onKeyDown={handleInputKeyDown}
            className="h-full min-w-0 px-1 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--text-dim)]/75 sm:px-2"
          />
          <InputGroupAddon align="inline-end" className="gap-5 pr-0 sm:gap-6">
            <Separator orientation="vertical" className="hidden h-7 bg-[var(--gray-border)] sm:block" />
            <BorderRotate
              animationMode="auto-rotate"
              animationSpeed={4}
              backgroundColor="color-mix(in srgb, var(--accent) 26%, var(--surface-dark))"
              borderRadius={6}
              borderWidth={1}
              className="h-8 min-w-20 cursor-pointer rounded-md shadow-[0_6px_14px_rgb(251_191_36_/_0.18)] data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60 sm:min-w-24"
              data-disabled={isSubmitting ? "true" : undefined}
              gradientColors={{
                primary: "#584827",
                secondary: "#c7a03c",
                accent: "#f9de90",
              }}
            >
              <InputGroupButton
                type="submit"
                size="sm"
                variant="ghost"
                className="h-full w-full cursor-pointer rounded-[5px] border-0 bg-transparent px-5 text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-none transition-[color] hover:bg-transparent hover:text-white focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-100"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Queueing…" : "SCAN"}
              </InputGroupButton>
            </BorderRotate>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </form>
  )
}
