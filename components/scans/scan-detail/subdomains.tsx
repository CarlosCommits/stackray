"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Radar, Search } from "lucide-react"

import { DemoScanQuotaDialog } from "@/components/scans/demo-scan-quota-dialog"
import { BorderRotate } from "@/components/ui/animated-gradient-border"
import { Input } from "@/components/ui/input"
import { trackStackrayEvent } from "@/lib/analytics"
import type { CreateScanResponse, ScanSubdomainItem } from "@/lib/contracts/scans"
import type { SubdomainsSection } from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import { SectionPanel, insetHeaderDividerClass, insetPanelClass, insetRowDividerClass } from "./shared"

const SUBDOMAIN_PAGE_SIZE = 250

export function SubdomainsSectionCard({ scanId, subdomains }: { scanId: string; subdomains: SubdomainsSection }) {
  const resetKey = useMemo(
    () => `${scanId}:${subdomains.total}:${subdomains.items.map((item) => item.subdomainId).join("|")}`,
    [scanId, subdomains.items, subdomains.total],
  )

  return <SubdomainsSectionCardContent key={resetKey} scanId={scanId} subdomains={subdomains} />
}

function SubdomainsSectionCardContent({ scanId, subdomains }: { scanId: string; subdomains: SubdomainsSection }) {
  const { push } = useRouter()
  const { summary } = subdomains
  const [items, setItems] = useState(subdomains.items)
  const [total, setTotal] = useState(subdomains.total)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [queueingSubdomainId, setQueueingSubdomainId] = useState<string | null>(null)
  const [queuedSubdomainScans, setQueuedSubdomainScans] = useState<Map<string, string>>(() => new Map())
  const [queueError, setQueueError] = useState<string | null>(null)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const statusLabel = summary.state === "not_run" ? "Not run" : summary.state
  const hasMore = items.length < total
  const sources = useMemo(
    () => Array.from(new Set(items.map((item) => item.source ?? "unknown"))).toSorted(),
    [items],
  )
  const filteredItems = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase()

    return items.filter((item) => {
      const source = item.source ?? "unknown"
      const matchesSource = sourceFilter === "all" || source === sourceFilter
      const matchesQuery = !normalizedQuery || [item.host, item.ip, source]
        .some((value) => value?.toLowerCase().includes(normalizedQuery))

      return matchesSource && matchesQuery
    })
  }, [deferredSearchQuery, items, sourceFilter])

  async function queueSubdomainScan(item: ScanSubdomainItem) {
    if (queueingSubdomainId || queuedSubdomainScans.has(item.subdomainId)) {
      return
    }

    setQueueingSubdomainId(item.subdomainId)
    setQueueError(null)
    trackStackrayEvent("scan_submit_clicked", { source: "subdomain" })
    let failureType: "validation" | "network" | "server" = "network"

    try {
      const response = await fetch("/api/v1/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: item.host,
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
          trackStackrayEvent("demo_quota_hit", { source: "subdomain" })
          setQuotaDialogOpen(true)
          return
        }

        failureType = response.status >= 500 ? "server" : "validation"
        throw new Error(body?.error?.message ?? "Unable to queue the scan.")
      }

      const payload = await response.json() as CreateScanResponse
      trackStackrayEvent("scan_created", { source: "subdomain", reused: payload.reused, status: payload.status })
      setQueuedSubdomainScans((current) => {
        const next = new Map(current)
        next.set(item.subdomainId, payload.scanId)
        return next
      })
    } catch (error) {
      trackStackrayEvent("scan_create_failed", { source: "subdomain", failure_type: failureType })
      setQueueError(error instanceof Error ? error.message : "Unable to queue the scan.")
    } finally {
      setQueueingSubdomainId(null)
    }
  }

  async function loadMoreSubdomains() {
    if (loadingMore || !hasMore) {
      return
    }

    const nextPage = page + 1
    setLoadingMore(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(SUBDOMAIN_PAGE_SIZE),
      })
      const response = await fetch(`/api/v1/scans/${scanId}/subdomains?${params}`)

      if (!response.ok) {
        throw new Error("Unable to load more subdomains.")
      }

      const payload = await response.json() as {
        items?: ScanSubdomainItem[]
        total?: number
      }

      setItems((currentItems) => {
        const seen = new Set(currentItems.map((item) => item.subdomainId))
        const nextItems = (payload.items ?? []).filter((item) => {
          if (seen.has(item.subdomainId)) {
            return false
          }

          seen.add(item.subdomainId)
          return true
        })

        return [...currentItems, ...nextItems]
      })
      setTotal(typeof payload.total === "number" ? payload.total : total)
      setPage(nextPage)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load more subdomains.")
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <SectionPanel
        title="Subdomains"
        icon={Radar}
        badge={summary.resultCount}
        description="Validated hostnames discovered for the apex domain during the scan."
      >
        <div className="space-y-4">
          <div className="sm:hidden">
            <div className={cn(insetPanelClass, "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-3 py-2.5")}>
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold text-[var(--foreground)]">
                  {summary.targetDomain ?? "Unknown apex domain"}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                  {statusLabel === "completed" ? "Discovery complete" : statusLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold tabular-nums text-[var(--accent)]">
                  {summary.resultCount.toLocaleString()}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                  Validated
                </p>
              </div>
            </div>
          </div>

          <div className="hidden grid-cols-3 gap-2 sm:grid">
            <SummaryStatTile label="Discovery Status" value={statusLabel} valueClassName="capitalize" />
            <SummaryStatTile
              label="Apex Domain"
              value={summary.targetDomain ?? null}
              mono
              breakAll
              fallback="N/A"
            />
            <SummaryStatTile label="Validated Hosts" value={summary.resultCount.toLocaleString()} mono />
          </div>

          {summary.errorMessage ? (
            <div className="rounded-lg border border-red-500/35 bg-red-500/5 p-3 text-sm text-red-300 ring-1 ring-white/5">
              {summary.errorMessage}
            </div>
          ) : null}

          {items.length > 0 ? (
            <>
              <div className="space-y-2">
                <label className="sr-only" htmlFor={`subdomain-search-${scanId}`}>
                  Search subdomains
                </label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />
                  <Input
                    id={`subdomain-search-${scanId}`}
                    name="subdomain-search"
                    type="search"
                    autoComplete="off"
                    spellCheck={false}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search hosts, IPs, or sources…"
                    className="h-10 border-[var(--gray-border)]/35 bg-[var(--background)]/35 pl-9 font-mono text-sm"
                  />
                </div>
                {sources.length > 1 ? (
                  <div
                    aria-label="Filter subdomains by source"
                    className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="group"
                  >
                    {["all", ...sources].map((source) => {
                      const isActive = sourceFilter === source

                      return (
                        <button
                          key={source}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSourceFilter(source)}
                          className={cn(
                            "h-10 shrink-0 touch-manipulation rounded-md border px-2.5 font-mono text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55",
                            isActive
                              ? "border-[var(--accent)]/45 bg-[var(--accent)]/12 text-[var(--accent)]"
                              : "border-[var(--gray-border)]/28 bg-[var(--surface-mid)]/18 text-[var(--muted-foreground)] hover:border-[var(--gray-border)]/50 hover:text-[var(--foreground)]",
                          )}
                        >
                          {source === "all" ? "All sources" : `#${source}`}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              {filteredItems.length > 0 ? (
                <div className={cn(insetPanelClass, "-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-lg sm:border-x")}>
                  <div className={cn("hidden grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] gap-3 bg-[var(--surface-mid)]/28 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)] sm:grid", insetHeaderDividerClass)}>
                    <span>Host</span>
                    <span>IP</span>
                    <span>Source</span>
                  </div>
                  <div className="font-mono text-[13px] sm:text-sm">
                    {filteredItems.map((item) => {
                      const isQueueing = queueingSubdomainId === item.subdomainId
                      const queuedScanId = queuedSubdomainScans.get(item.subdomainId)
                      const isQueued = Boolean(queuedScanId)

                      return (
                        <div
                          key={item.subdomainId}
                          className={cn(
                            "group/subdomain-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2 [contain-intrinsic-size:auto_60px] [content-visibility:auto] sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] sm:gap-3 sm:px-3 sm:py-2",
                            insetRowDividerClass,
                          )}
                        >
                          <div className="contents sm:flex sm:min-w-0 sm:items-center sm:gap-2">
                          <span className="min-w-0 truncate font-medium text-[var(--foreground)]" title={item.host}>
                            {item.host}
                          </span>
                          <BorderRotate
                            animationMode="auto-rotate"
                            animationSpeed={4}
                            backgroundColor={isQueued
                              ? "color-mix(in srgb, #22c55e 34%, var(--surface-dark))"
                              : "color-mix(in srgb, var(--accent) 26%, var(--surface-dark))"}
                            borderRadius={6}
                            borderWidth={1}
                            className={cn(
                              "row-span-2 h-11 min-w-16 cursor-pointer rounded-md shadow-[0_6px_14px_rgb(251_191_36_/_0.18)] data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-70 sm:row-span-1 sm:h-7 sm:min-w-15 sm:opacity-0 sm:shadow-[0_4px_10px_rgb(251_191_36_/_0.14)] sm:group-hover/subdomain-row:opacity-100 sm:group-focus-within/subdomain-row:opacity-100",
                              isQueued && "shadow-[0_4px_12px_rgb(34_197_94_/_0.18)] sm:opacity-100 sm:shadow-[0_3px_9px_rgb(34_197_94_/_0.16)]",
                              isQueueing && "sm:opacity-100",
                            )}
                            data-disabled={isQueueing ? "true" : undefined}
                            gradientColors={isQueued
                              ? {
                                  primary: "#12351f",
                                  secondary: "#22c55e",
                                  accent: "#bbf7d0",
                                }
                              : {
                                  primary: "#584827",
                                  secondary: "#c7a03c",
                                  accent: "#f9de90",
                                }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (queuedScanId) {
                                  push(`/scans/${queuedScanId}`)
                                  return
                                }

                                void queueSubdomainScan(item)
                              }}
                              disabled={isQueueing}
                              title={queuedScanId ? `Open queued scan for ${item.host}` : `Queue scan for ${item.host}`}
                              aria-label={queuedScanId ? `Open queued scan for ${item.host}` : `Queue scan for ${item.host}`}
                              className="h-full w-full cursor-pointer touch-manipulation rounded-[5px] border-0 bg-transparent px-2 font-heading text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-none transition-[color,transform] active:translate-y-px hover:bg-transparent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 disabled:cursor-not-allowed disabled:opacity-100 sm:text-[9px]"
                            >
                              {isQueued ? "Open" : isQueueing ? "Queueing…" : "Scan"}
                            </button>
                          </BorderRotate>
                          </div>
                          <span className="hidden min-w-0 break-all text-[var(--muted-foreground)] sm:block">
                            {item.ip ?? "—"}
                          </span>
                          <span className="hidden min-w-0 truncate text-[var(--muted-foreground)] sm:block">
                            {item.source ?? "unknown"}
                          </span>
                          <span className="col-start-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] sm:hidden">
                            <span className="shrink-0 tabular-nums">{item.ip ?? "No IP"}</span>
                            <span aria-hidden="true" className="text-[var(--gray-border)]">·</span>
                            <span className="truncate">{item.source ?? "unknown"}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className={cn(insetPanelClass, "p-4 text-sm text-[var(--muted-foreground)]")}>
                  No subdomains match the current search and source filter.
                </div>
              )}
            </>
          ) : (
            <div className={cn(insetPanelClass, "p-4 text-sm text-[var(--muted-foreground)]")}>
              No validated subdomains found.
            </div>
          )}

          {filteredItems.length !== items.length ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]/80">
              Showing {filteredItems.length.toLocaleString()} of {items.length.toLocaleString()} loaded hosts
            </p>
          ) : total > items.length ? (
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]/80">
              Showing {items.length.toLocaleString()} of {total.toLocaleString()} validated hosts
            </p>
          ) : null}

          {loadError ? (
            <div aria-live="polite" className="rounded-lg border border-red-500/35 bg-red-500/5 p-3 text-sm text-red-300 ring-1 ring-white/5">
              {loadError}
            </div>
          ) : null}

          {queueError ? (
            <div aria-live="polite" className="rounded-lg border border-red-500/35 bg-red-500/5 p-3 text-sm text-red-300 ring-1 ring-white/5">
              {queueError}
            </div>
          ) : null}

          {hasMore ? (
            <button
              type="button"
              onClick={loadMoreSubdomains}
              disabled={loadingMore}
              className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-mid)]/38 px-3 py-2 text-sm text-[var(--foreground)] ring-1 ring-white/5 transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-mid)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus aria-hidden="true" className="size-4" />
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </div>
      </SectionPanel>
      <DemoScanQuotaDialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen} />
    </>
  )
}

function SummaryStatTile({
  label,
  value,
  valueClassName,
  mono = false,
  breakAll = false,
  fallback = "N/A",
}: {
  label: string
  value: string | null
  valueClassName?: string
  mono?: boolean
  breakAll?: boolean
  fallback?: string
}) {
  return (
    <div className={cn(insetPanelClass, "px-3 py-3")}>
      <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold leading-snug text-[var(--foreground)] sm:text-base",
          mono && "font-mono",
          breakAll ? "break-all" : "truncate",
          valueClassName,
        )}
      >
        {value ?? <span className="text-[var(--muted-foreground)]/50">{fallback}</span>}
      </p>
    </div>
  )
}

// TLS Certificate Section
