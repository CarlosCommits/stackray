"use client"

import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Globe } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { GradientBorder } from "@/components/ui/gradient-border"
import { Separator } from "@/components/ui/separator"
import type { CreateScanResponse, ScanListItem } from "@/lib/contracts/scans"
import type { RecentScan } from "@/components/dashboard/types"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import { DemoScanQuotaDialog } from "@/components/scans/demo-scan-quota-dialog"
import { trackStackrayEvent } from "@/lib/analytics"

interface SearchCommandBarProps {
  demoMode?: boolean
  onScanQueued?: (scan: RecentScan) => void
}

interface ScanMatchState {
  query: string
  items: ScanListItem[]
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

function getDedupedScanMatches(items: ScanListItem[]) {
  const seenTargets = new Set<string>()
  const deduped: ScanListItem[] = []

  for (const item of items) {
    const targetKey = item.target.trim().toLowerCase()

    if (seenTargets.has(targetKey)) {
      continue
    }

    seenTargets.add(targetKey)
    deduped.push(item)
  }

  return deduped
}

const scanMatchStatusPresentation: Record<
  ScanListItem["status"],
  { label: string; dotClassName: string; textClassName: string }
> = {
  completed: { label: "Completed", dotClassName: "bg-emerald-400", textClassName: "text-emerald-300" },
  running: { label: "Running", dotClassName: "bg-[var(--accent)]", textClassName: "text-[var(--accent)]" },
  processing: { label: "Processing", dotClassName: "bg-[var(--accent)]", textClassName: "text-[var(--accent)]" },
  pending: { label: "Pending", dotClassName: "bg-[var(--text-dim)]", textClassName: "text-[var(--text-dim)]" },
  queued: { label: "Queued", dotClassName: "bg-[var(--text-dim)]", textClassName: "text-[var(--text-dim)]" },
  failed: { label: "Failed", dotClassName: "bg-red-400", textClassName: "text-red-300" },
  cancelled: { label: "Cancelled", dotClassName: "bg-amber-400", textClassName: "text-amber-300" },
}

function formatRelativeScanTime(value: string): string {
  const then = new Date(value).getTime()

  if (!Number.isFinite(then)) {
    return ""
  }

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))

  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  if (days < 7) {
    return `${days}d ago`
  }

  const weeks = Math.floor(days / 7)

  if (weeks < 5) {
    return `${weeks}w ago`
  }

  const months = Math.floor(days / 30)

  if (months < 12) {
    return `${months}mo ago`
  }

  return `${Math.floor(days / 365)}y ago`
}

function ScanMatchFavicon({ scan }: { scan: ScanListItem }) {
  const [faviconHidden, setFaviconHidden] = useState(false)
  const faviconPreviewSrc = faviconHidden ? null : resolveFaviconPreviewSrc(scan.faviconUrl)

  if (faviconPreviewSrc) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
        <img
          src={faviconPreviewSrc}
          alt=""
          className="size-6 object-contain"
          onError={() => setFaviconHidden(true)}
        />
      </span>
    )
  }

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-black/30">
      <Globe className="size-4.5 text-[#8fc4ff]" />
    </span>
  )
}

export function SearchCommandBar({ demoMode = false, onScanQueued }: SearchCommandBarProps) {
  const { push, refresh } = useRouter()
  const [target, setTarget] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const [scanMatchState, setScanMatchState] = useState<ScanMatchState>({ query: "", items: [] })
  const [isMatchesOpen, setIsMatchesOpen] = useState(false)
  const [debouncedSearchTarget, setDebouncedSearchTarget] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputId = useId()
  const searchTarget = target.trim()
  const hasActiveSearch = searchTarget.length >= 3
  const matchedScans = scanMatchState.items
  const showMatches = demoMode && isMatchesOpen && matchedScans.length > 0 && hasActiveSearch

  useEffect(() => {
    const shouldFocus = window.matchMedia?.("(min-width: 768px)").matches ?? true

    if (shouldFocus) {
      inputRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (!demoMode) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTarget(searchTarget)
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [demoMode, searchTarget])

  useEffect(() => {
    if (!demoMode || debouncedSearchTarget.length < 3) {
      return
    }

    const controller = new AbortController()

    fetch(`/api/v1/scans?target=${encodeURIComponent(debouncedSearchTarget)}&limit=4`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to search past scans.")
        }

        const payload = await response.json() as { items?: ScanListItem[] }
        const items = getDedupedScanMatches(payload.items ?? [])

        setScanMatchState({
          query: debouncedSearchTarget,
          items,
        })
        setIsMatchesOpen(items.length > 0)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setScanMatchState({
          query: debouncedSearchTarget,
          items: [],
        })
        setIsMatchesOpen(false)
      })

    return () => controller.abort()
  }, [demoMode, debouncedSearchTarget])

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
    trackStackrayEvent("scan_submit_clicked", { source: "dashboard" })

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
        const body = await response.json().catch(() => null)

        if (response.status === 429 && body?.error?.code === "demo_scan_rate_limit_exceeded") {
          trackStackrayEvent("demo_quota_hit", { source: "dashboard" })
          setQuotaDialogOpen(true)
          return
        }

        trackStackrayEvent("scan_create_failed", {
          source: "dashboard",
          failure_type: response.status >= 500 ? "server" : "validation",
        })
        push(`/scans/new?target=${encodeURIComponent(trimmedTarget)}`)
        return
      }

      const payload = await response.json() as CreateScanResponse
      trackStackrayEvent("scan_created", { source: "dashboard", reused: payload.reused, status: payload.status })
      setIsMatchesOpen(false)
      if (onScanQueued) {
        onScanQueued(buildQueuedScanCard(trimmedTarget, payload))
      } else {
        refresh()
      }
      setTarget("")
    } catch {
      trackStackrayEvent("scan_create_failed", { source: "dashboard", failure_type: "network" })
      push(`/scans/new?target=${encodeURIComponent(trimmedTarget)}`)
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
    <>
      <form
        role="search"
        className="sticky top-0 z-30 -mx-4 mb-6 w-auto px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        onSubmit={handleSubmit}
      >
        <label htmlFor={inputId} className="sr-only">
          Target domain or URL
        </label>
        <div className="relative mx-auto w-full max-w-5xl rounded-[14px] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--gray-charcoal)_94%,transparent)_0%,color-mix(in_srgb,var(--gray-charcoal)_88%,transparent)_72%,transparent_100%)] p-2 backdrop-blur">
          <InputGroup className="h-12 rounded-[10px] border-[var(--gray-border)] bg-[var(--surface-dark)] px-2 shadow-[0_14px_36px_rgb(0_0_0_/_0.24),inset_0_1px_0_rgb(255_255_255_/_0.05)] transition-[border-color,box-shadow] focus-within:border-[var(--accent)] focus-within:shadow-[0_14px_36px_rgb(0_0_0_/_0.28),0_0_0_2px_rgb(251_191_36_/_0.14),inset_0_1px_0_rgb(255_255_255_/_0.05)] has-[[data-slot=input-group-control]:focus-visible]:ring-1 sm:h-14 sm:px-4">
            <InputGroupInput
              ref={inputRef}
              id={inputId}
              name="target"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Enter a domain or URL…"
              value={target}
              onChange={(event) => {
                setTarget(event.target.value)
                const nextSearchTarget = event.target.value.trim()
                setIsMatchesOpen(nextSearchTarget.length >= 3)
              }}
              onFocus={() => setIsMatchesOpen(searchTarget.length >= 3 && scanMatchState.items.length > 0)}
              onKeyDown={handleInputKeyDown}
              className="h-full min-w-0 px-1 text-base font-mono text-[var(--foreground)] placeholder:text-[var(--text-dim)]/75 sm:px-2 md:text-sm"
            />
            <InputGroupAddon align="inline-end" className="gap-2 pr-0 sm:gap-6">
              <Separator orientation="vertical" className="hidden h-7 bg-[var(--gray-border)] sm:block" />
              <GradientBorder
                backgroundColor="color-mix(in srgb, var(--accent) 26%, var(--surface-dark))"
                borderRadius={6}
                borderWidth={1}
                className="h-8 min-w-18 cursor-pointer rounded-md shadow-[0_6px_14px_rgb(251_191_36_/_0.18)] data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60 sm:min-w-24"
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
                  className="h-full w-full cursor-pointer rounded-[5px] border-0 bg-transparent px-3 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-none transition-[color] hover:bg-transparent hover:text-white focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-100 sm:px-5 sm:tracking-[0.22em]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Queueing…" : "SCAN"}
                </InputGroupButton>
              </GradientBorder>
            </InputGroupAddon>
          </InputGroup>

          {showMatches ? (
            <div className="absolute left-2 right-2 top-[calc(100%-0.25rem)] z-40 animate-in fade-in-0 slide-in-from-top-1 duration-150 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-dark)] text-[var(--foreground)] shadow-[0_24px_64px_rgb(0_0_0_/_0.5),inset_0_1px_0_rgb(255_255_255_/_0.05)]">
              <div className="flex items-start border-b border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-mid)]/40 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-semibold text-[var(--foreground)]">This website was already scanned</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    Open an existing result, or run a fresh scan if you want updated data.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1 p-2">
                {matchedScans.map((scan) => {
                  const status = scanMatchStatusPresentation[scan.status]
                  const relativeTime = formatRelativeScanTime(scan.submittedAt)

                  return (
                    <button
                      key={scan.scanId}
                      type="button"
                      className="group/row flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-[border-color,background-color] hover:border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] hover:bg-[var(--surface-mid)]/45 focus-visible:border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] focus-visible:bg-[var(--surface-mid)]/45 focus-visible:outline-none"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setIsMatchesOpen(false)
                        push(`/scans/${scan.scanId}`)
                      }}
                    >
                      <ScanMatchFavicon scan={scan} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm font-medium text-[var(--foreground)]">
                          {formatTargetForDisplay(scan.target)}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-[var(--text-dim)]">
                          <span className={`inline-flex items-center gap-1.5 ${status.textClassName}`}>
                            <span className={`size-1.5 rounded-full ${status.dotClassName}`} />
                            {status.label}
                          </span>
                          {relativeTime ? (
                            <>
                              <span className="text-[var(--gray-border)]">·</span>
                              <span>{relativeTime}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-[var(--text-dim)] transition-[color,transform] group-hover/row:translate-x-0.5 group-hover/row:text-[var(--accent)]" />
                    </button>
                  )
                })}
              </div>

            </div>
          ) : null}
        </div>
      </form>
      <DemoScanQuotaDialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen} />
    </>
  )
}
