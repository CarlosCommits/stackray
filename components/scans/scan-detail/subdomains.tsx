"use client"

import { useMemo, useState } from "react"
import { Globe2, Plus } from "lucide-react"

import type { ScanSubdomainItem } from "@/lib/contracts/scans"
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
  const { summary } = subdomains
  const [items, setItems] = useState(subdomains.items)
  const [total, setTotal] = useState(subdomains.total)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const statusLabel = summary.state === "not_run" ? "Not run" : summary.state
  const hasMore = items.length < total

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
    <SectionPanel
      title="Subdomains"
      icon={Globe2}
      badge={summary.resultCount}
      description="Validated hostnames discovered for the apex domain during the scan."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryStatTile
            label="Discovery Status"
            value={statusLabel}
            valueClassName="capitalize"
          />
          <SummaryStatTile
            label="Apex Domain"
            value={summary.targetDomain ?? null}
            mono
            breakAll
            fallback="N/A"
          />
          <SummaryStatTile
            label="Validated Hosts"
            value={summary.resultCount.toLocaleString()}
            mono
          />
        </div>

        {summary.errorMessage ? (
          <div className="rounded-lg border border-red-500/35 bg-red-500/5 p-3 text-sm text-red-300 ring-1 ring-white/5">
            {summary.errorMessage}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className={insetPanelClass}>
            {/* Header row: only on sm+ where we use the row layout */}
            <div className={cn("hidden grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] gap-3 bg-[var(--surface-mid)]/28 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)] sm:grid", insetHeaderDividerClass)}>
              <span>Host</span>
              <span>IP</span>
              <span>Source</span>
            </div>
            <div className="font-mono text-[13px] sm:text-sm">
              {items.map((item) => (
                <div
                  key={item.subdomainId}
                  className={cn("grid grid-cols-1 gap-1 px-3 py-2.5 transition-colors hover:bg-[var(--surface-mid)]/28 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] sm:gap-3 sm:py-2", insetRowDividerClass)}
                >
                  <span className="min-w-0 break-all text-[var(--foreground)]">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]/60 sm:hidden">
                      Host
                    </span>
                    {item.host}
                  </span>
                  <span className="min-w-0 break-all text-[var(--muted-foreground)]">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]/60 sm:hidden">
                      IP
                    </span>
                    {item.ip ?? "—"}
                  </span>
                  <span className="min-w-0 truncate text-[var(--muted-foreground)]">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]/60 sm:hidden">
                      Source
                    </span>
                    {item.source ?? "unknown"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn(insetPanelClass, "p-4 text-sm text-[var(--muted-foreground)]")}>
            No validated subdomains found.
          </div>
        )}

        {total > items.length ? (
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80">
            Showing {items.length} of {total.toLocaleString()} validated subdomains.
          </p>
        ) : null}

        {loadError ? (
          <div className="rounded-lg border border-red-500/35 bg-red-500/5 p-3 text-sm text-red-300 ring-1 ring-white/5">
            {loadError}
          </div>
        ) : null}

        {hasMore ? (
          <button
            type="button"
            onClick={loadMoreSubdomains}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-mid)]/38 px-3 py-2 text-sm text-[var(--foreground)] ring-1 ring-white/5 transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-mid)]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="size-4" />
            {loadingMore ? "Loading" : "Load more"}
          </button>
        ) : null}
      </div>
    </SectionPanel>
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
