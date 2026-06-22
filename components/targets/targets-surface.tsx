"use client"

import { useId, useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Globe, Clock, ChevronRight, Check, X, Loader, Ban, ChevronsDown, ListPlus } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import { TargetsTechnologiesCell } from "./targets-technologies-cell"
import { TargetsHistoryRows } from "./targets-history-list"
import type { TargetsRow } from "./types"

const TARGETS_HISTORY_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

const TARGETS_ROW_SCAN_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  year: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
})

const TARGETS_ROW_SCAN_MOBILE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

function formatTargetsHistoryDate(value: string) {
  return TARGETS_HISTORY_DATE_FORMAT.format(new Date(value))
}

function formatTargetsRowScanDate(value: string) {
  return TARGETS_ROW_SCAN_DATE_FORMAT.format(new Date(value))
}

function formatTargetsRowScanMobileDate(value: string) {
  return TARGETS_ROW_SCAN_MOBILE_DATE_FORMAT.format(new Date(value))
}

export interface TargetHistoryItem {
  scanId: string
  status: "pending" | "queued" | "running" | "processing" | "completed" | "failed" | "cancelled"
  title: string
  technologies: string[]
  submittedAt: string
  completedAt: string | null
}

interface TargetsSurfaceProps {
  rows: TargetsRow[]
}

const TARGET_HISTORY_LIMIT = 50
const TARGET_HISTORY_LOAD_INCREMENT = 50

interface TargetHistoryResponse {
  items: TargetHistoryItem[]
  totalCount?: number
  hasMore?: boolean
}

function useTargetHistory(row: TargetsRow) {
  const [isOpen, setIsOpen] = useState(false)
  const [history, setHistory] = useState<TargetHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
  const [totalHistoryCount, setTotalHistoryCount] = useState<number | null>(null)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)

  const loadHistory = async (limit: number | "all") => {
    setIsOpen(true)
    setIsLoading(true)

    try {
      const limitParam = limit === "all" ? "all" : String(limit)
      const response = await fetch(
        `/api/v1/targets/${row.canonicalTargetId}/history?limit=${limitParam}`,
      )

      if (response.ok) {
        const data = await response.json() as TargetHistoryResponse
        setHistory(data.items)
        setTotalHistoryCount(data.totalCount ?? data.items.length)
        setHasMoreHistory(data.hasMore ?? false)
        setHasLoadedHistory(true)
      } else {
        setIsOpen(hasLoadedHistory)
      }
    } catch (error) {
      console.error("Failed to load target history:", error)
      setIsOpen(hasLoadedHistory)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleHistory = async () => {
    if (hasLoadedHistory) {
      setIsOpen((previous) => !previous)
      return
    }

    await loadHistory(TARGET_HISTORY_LIMIT)
  }

  const loadMoreHistory = async () => {
    if (isLoading) {
      return
    }

    const nextLimit = totalHistoryCount === null
      ? history.length + TARGET_HISTORY_LOAD_INCREMENT
      : Math.min(totalHistoryCount, history.length + TARGET_HISTORY_LOAD_INCREMENT)
    await loadHistory(nextLimit)
  }

  const loadAllHistory = async () => {
    if (isLoading) {
      return
    }

    await loadHistory("all")
  }

  return {
    history,
    hasMoreHistory,
    isLoading,
    isOpen,
    hasLoadedHistory,
    totalHistoryCount,
    loadAllHistory,
    loadMoreHistory,
    setIsOpen,
    toggleHistory,
  }
}

function ExpandableTargetsRow({ row }: { row: TargetsRow }) {
  const {
    history,
    hasMoreHistory,
    isLoading,
    isOpen,
    hasLoadedHistory,
    loadAllHistory,
    loadMoreHistory,
    totalHistoryCount,
    toggleHistory,
  } = useTargetHistory(row)
  const [desktopFaviconHidden, setDesktopFaviconHidden] = useState(false)
  const historyPanelId = useId()
  const faviconPreviewSrc = desktopFaviconHidden ? null : resolveFaviconPreviewSrc(row.faviconUrl)
  const displayTarget = formatTargetForDisplay(row.target)
  const isHistoryMounted = isLoading || isOpen || hasLoadedHistory

  const handleDesktopHistoryToggle = async () => {
    if (isLoading) {
      return
    }

    await toggleHistory()
  }

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement
    if (target.closest("a") || target.closest("button")) {
      return
    }
    void handleDesktopHistoryToggle()
  }

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      void handleDesktopHistoryToggle()
    }
  }

  return (
    <>
      <TableRow
        className="h-10 border-[var(--gray-border)]/35 cursor-pointer hover:bg-[var(--surface-mid)]/55 focus-visible:bg-[var(--surface-mid)]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        onClick={handleRowClick}
        onKeyDown={handleRowKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        aria-controls={isHistoryMounted ? historyPanelId : undefined}
        aria-label={isOpen ? `Collapse scan history for ${displayTarget}` : `Expand scan history for ${displayTarget}`}
      >
        <TableCell className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="size-4 shrink-0 rounded-full border-2 border-[var(--text-dim)]/30 border-t-[var(--accent)] animate-spin" />
            ) : (
              <ChevronRight className={`size-4 shrink-0 text-[var(--text-dim)] transition-transform duration-200 ${isOpen ? "rotate-90 text-[var(--accent)]" : ""}`} />
            )}
            {faviconPreviewSrc ? (
              <div className="size-4 shrink-0 rounded overflow-hidden flex items-center justify-center bg-[var(--surface-mid)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
                <img
                  src={faviconPreviewSrc}
                  alt=""
                  className="size-4 object-contain"
                  onError={() => setDesktopFaviconHidden(true)}
                />
              </div>
            ) : (
              <Globe className="size-4 text-[var(--accent)] shrink-0" />
            )}
            <span className="font-mono text-sm truncate max-w-[150px] text-[var(--foreground)]">
              {displayTarget}
            </span>
          </div>
        </TableCell>
        <TableCell className="px-2 py-1.5">
          <span className="text-sm text-[var(--text-dim)] line-clamp-1">
            {row.title}
          </span>
        </TableCell>
        <TableCell className="px-2 py-1.5">
          <TargetsTechnologiesCell technologies={row.technologies} maxVisible={1} wrap={false} />
        </TableCell>
        <TableCell className="px-2 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-sm font-mono text-[var(--text-dim)]">
            <Clock className="size-4 shrink-0" />
            <span className="truncate" title={row.lastScannedAt.label}>{formatTargetsRowScanDate(row.lastScannedAt.iso)}</span>
          </div>
        </TableCell>
      </TableRow>
      {isHistoryMounted && (
        <TargetsHistoryRows
          history={history}
          hasMoreHistory={hasMoreHistory}
          isLoading={isLoading}
          hasLoadedHistory={hasLoadedHistory}
          isOpen={isOpen}
          onLoadAll={() => void loadAllHistory()}
          onLoadMore={() => void loadMoreHistory()}
          panelId={historyPanelId}
          totalHistoryCount={totalHistoryCount}
        />
      )}
    </>
  )
}

function MobileTargetHistoryStatusIcon({ status }: { status: TargetHistoryItem["status"] }) {
  const baseClassName = "size-4 shrink-0"

  switch (status) {
    case "completed":
      return <Check className={`${baseClassName} text-emerald-400`} aria-label="Completed" />
    case "failed":
      return <X className={`${baseClassName} text-red-400`} aria-label="Failed" />
    case "running":
    case "processing":
      return <Loader className={`${baseClassName} animate-spin text-blue-400`} aria-label="Running" />
    case "cancelled":
      return <Ban className={`${baseClassName} text-amber-400`} aria-label="Cancelled" />
    case "pending":
    case "queued":
      return <Clock className={`${baseClassName} text-[var(--text-dim)]`} aria-label="Queued" />
  }
}

function MobileTargetHistory({
  hasMoreHistory,
  history,
  isLoading,
  onLoadAll,
  onLoadMore,
  totalHistoryCount,
}: {
  hasMoreHistory: boolean
  history: TargetHistoryItem[]
  isLoading: boolean
  onLoadAll: () => void
  onLoadMore: () => void
  totalHistoryCount: number | null
}) {
  if (history.length === 0) {
    return <div className="text-sm text-[var(--text-dim)] text-center py-4">No previous runs for this target yet.</div>
  }

  return (
    <div className="space-y-1.5">
      {history.map((item) => {
        const timestamp = item.completedAt ?? item.submittedAt

        return (
          <Link
            key={item.scanId}
            href={`/scans/${item.scanId}`}
            aria-label={`Open previous scan ${item.scanId}`}
            className="flex items-center gap-2 rounded-md border border-[var(--gray-border)]/50 bg-[var(--surface-dark)]/30 px-2.5 py-1.5 transition-colors hover:border-[var(--accent)]/45 hover:bg-[var(--surface-light)]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <MobileTargetHistoryStatusIcon status={item.status} />
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-dim)]">
              {item.title || "No title recorded"}
            </span>
            <span className="shrink-0 font-mono text-xs text-[var(--text-dim)]/70">
              {formatTargetsHistoryDate(timestamp)}
            </span>
          </Link>
        )
      })}
      {hasMoreHistory && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
          <span className="font-mono text-xs text-[var(--text-dim)]/70">
            {totalHistoryCount === null ? `${history.length} loaded` : `${history.length} of ${totalHistoryCount} loaded`}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="border-[var(--gray-border)] bg-[var(--surface-dark)]/40 text-[var(--text-dim)] hover:text-[var(--foreground)]"
              disabled={isLoading}
              onClick={onLoadMore}
            >
              <ChevronsDown className="size-3" />
              {isLoading ? "Loading" : "Load 50"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-[var(--text-dim)] hover:text-[var(--foreground)]"
              disabled={isLoading}
              onClick={onLoadAll}
            >
              <ListPlus className="size-3" />
              All
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function MobileTargetsRow({ row }: { row: TargetsRow }) {
  const {
    history,
    hasMoreHistory,
    isLoading,
    isOpen,
    hasLoadedHistory,
    loadAllHistory,
    loadMoreHistory,
    setIsOpen,
    toggleHistory,
    totalHistoryCount,
  } = useTargetHistory(row)
  const [mobileFaviconHidden, setMobileFaviconHidden] = useState(false)
  const faviconPreviewSrc = mobileFaviconHidden ? null : resolveFaviconPreviewSrc(row.faviconUrl)
  const historyPanelId = useId()
  const displayTarget = formatTargetForDisplay(row.target)

  const handleHistoryToggle = () => {
    if (isLoading) {
      return
    }

    void toggleHistory()
  }

  return (
    <Card className="gap-0 overflow-hidden rounded-lg border-[var(--gray-border)]/55 bg-[color-mix(in_srgb,var(--surface-dark)_82%,var(--surface-mid))] py-0 shadow-[0_12px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-[var(--accent)]/45">
      <button
        type="button"
        onClick={handleHistoryToggle}
        disabled={isLoading}
        className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 px-2.5 py-2 text-left disabled:cursor-wait"
        aria-controls={isLoading || hasLoadedHistory ? historyPanelId : undefined}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Collapse scan history for ${displayTarget}` : `Expand scan history for ${displayTarget}`}
      >
        <div className="row-span-2 flex size-8 shrink-0 items-center justify-center rounded-md bg-black/20">
          {faviconPreviewSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
              <img
                src={faviconPreviewSrc}
                alt=""
                className="size-5 object-contain"
                onError={() => setMobileFaviconHidden(true)}
              />
            </>
          ) : (
            <Globe className="size-4 shrink-0 text-[var(--accent)]" />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="min-w-0 truncate font-mono text-sm font-semibold leading-tight text-[var(--foreground)]">
            {displayTarget}
          </h3>
          <p className="mt-0.5 min-w-0 truncate text-xs leading-tight text-[var(--text-dim)]">
            {row.title || "No title recorded"}
          </p>
        </div>

        <span className="shrink-0 font-mono text-sm leading-none text-[var(--text-dim)]">
          {formatTargetsRowScanMobileDate(row.lastScannedAt.iso)}
        </span>

        <span className="row-span-2 flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors group-hover:text-[var(--foreground)]">
          {isLoading ? (
            <span className="size-4 rounded-full border-2 border-[var(--text-dim)]/30 border-t-[var(--accent)] animate-spin" />
          ) : (
            <ChevronRight className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
          )}
        </span>
      </button>

      {(isLoading || hasLoadedHistory) && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent id={historyPanelId}>
            <div className="space-y-3 border-t border-[var(--gray-border)]/50 px-3 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]/70">
                Scan history
              </div>
              {isLoading && !hasLoadedHistory ? (
                <div className="flex items-center justify-center py-6">
                  <div className="size-5 rounded-full border-2 border-[var(--text-dim)]/30 border-t-[var(--accent)] animate-spin" />
                </div>
              ) : hasLoadedHistory ? (
                <MobileTargetHistory
                  hasMoreHistory={hasMoreHistory}
                  history={history}
                  isLoading={isLoading}
                  onLoadAll={() => void loadAllHistory()}
                  onLoadMore={() => void loadMoreHistory()}
                  totalHistoryCount={totalHistoryCount}
                />
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  )
}

export function TargetsSurface({ rows }: TargetsSurfaceProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <>
      <div className="hidden lg:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="h-8 border-[var(--gray-border)]/70 hover:bg-transparent">
              <TableHead className="h-8 w-[190px] px-2 text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Target
              </TableHead>
              <TableHead className="h-8 w-[360px] px-2 text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Title
              </TableHead>
              <TableHead className="h-8 w-[240px] px-2 text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Technologies
              </TableHead>
              <TableHead className="h-8 w-[220px] px-2 text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Last scanned at
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ExpandableTargetsRow key={`${row.canonicalTargetId}:${row.lastScannedAt.iso}:${row.title}`} row={row} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="lg:hidden">
        <div className="space-y-1.5">
          {rows.map((row) => (
            <MobileTargetsRow key={`${row.canonicalTargetId}:${row.lastScannedAt.iso}:${row.title}`} row={row} />
          ))}
        </div>
      </div>
    </>
  )
}
