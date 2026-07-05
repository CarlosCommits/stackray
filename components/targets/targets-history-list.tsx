"use client"

import Link from "next/link"
import { AlertCircle, ChevronsDown, Clock, ListPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LocalTime } from "@/components/ui/local-time"
import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { TargetsTechnologiesCell } from "./targets-technologies-cell"
import type { TargetHistoryItem } from "./targets-surface"

const LOADING_HISTORY_ROW_COUNT = 5
const INCREMENTAL_SKELETON_ROW_COUNT = 3
const TARGET_HISTORY_GRID_COLUMNS =
  "grid-cols-[minmax(0,190fr)_minmax(0,360fr)_minmax(0,240fr)_minmax(0,220fr)]"

function HistorySkeletonRows({ count }: { count: number }) {
  return (
    <div className="divide-y divide-[var(--gray-border)]/20">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`grid ${TARGET_HISTORY_GRID_COLUMNS} animate-pulse items-center gap-2 px-3 py-2`}
          aria-hidden="true"
        >
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 rounded-sm bg-[var(--surface-light)]/45" />
            <div className="h-5 w-20 rounded bg-[var(--surface-light)]/55" />
          </div>
          <div className="h-4 w-4/5 rounded bg-[var(--surface-light)]/45" />
          <div className="flex gap-1.5">
            <div className="h-5 w-16 rounded bg-[var(--surface-light)]/55" />
            <div className="h-5 w-20 rounded bg-[var(--surface-light)]/45" />
          </div>
          <div className="h-4 w-28 rounded bg-[var(--surface-light)]/45" />
        </div>
      ))}
    </div>
  )
}

function HistoryErrorRow({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-[var(--gray-border)]/30 px-3 py-2">
      <span className="flex min-w-0 items-center gap-1.5 break-words text-xs text-red-400/90">
        <AlertCircle className="size-3.5 shrink-0" />
        {error}
      </span>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  )
}

function getTargetHistoryStatusLabel(status: TargetHistoryItem["status"]) {
  switch (status) {
    case "pending":
    case "queued":
      return "Queued"
    case "running":
    case "processing":
      return "Running"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
  }
}

function TargetHistoryStatusBadge({ status }: { status: TargetHistoryItem["status"] }) {
  const statusColors: Record<TargetHistoryItem["status"], string> = {
    pending: "bg-[var(--surface-light)]/50 text-[var(--text-dim)]",
    queued: "bg-[var(--surface-light)]/50 text-[var(--text-dim)]",
    running: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    processing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-500/10 text-red-400 border-red-500/30",
    cancelled: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  }

  return (
    <Badge
      variant="outline"
      className={`h-5 rounded px-2 py-0 text-xs border-[var(--gray-border)] ${statusColors[status]}`}
    >
      {getTargetHistoryStatusLabel(status)}
    </Badge>
  )
}

interface TargetsHistoryRowsProps {
  hasMoreHistory: boolean
  history: TargetHistoryItem[]
  isLoading: boolean
  hasLoadedHistory: boolean
  isOpen: boolean
  error: string | null
  onLoadAll: () => void
  onLoadMore: () => void
  onRetry: () => void
  panelId?: string
  totalHistoryCount: number | null
}

export function TargetsHistoryRows({
  hasMoreHistory,
  history,
  isLoading,
  hasLoadedHistory,
  isOpen,
  error,
  onLoadAll,
  onLoadMore,
  onRetry,
  panelId,
  totalHistoryCount,
}: TargetsHistoryRowsProps) {
  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell colSpan={4} className="p-0">
        <Collapsible open={isOpen}>
          <CollapsibleContent id={panelId}>
            <div className="m-2 rounded-lg border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-mid)]/55 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
              <div className={`grid ${TARGET_HISTORY_GRID_COLUMNS} items-center gap-2 border-b border-[var(--gray-border)]/30 px-3 py-2`}>
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-dim)]/60">
                  Status
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-dim)]/60">
                  Title
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-dim)]/60">
                  Technologies
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-dim)]/60">
                  Scanned at
                </span>
              </div>

              {isLoading && !hasLoadedHistory ? (
                <HistorySkeletonRows count={LOADING_HISTORY_ROW_COUNT} />
              ) : error && !hasLoadedHistory ? (
                <HistoryErrorRow error={error} onRetry={onRetry} />
              ) : hasLoadedHistory && history.length === 0 ? (
                <div className="px-3 py-3 text-xs text-[var(--text-dim)]">
                  No previous scans for this target.
                </div>
              ) : (
                <div className="divide-y divide-[var(--gray-border)]/20 animate-in fade-in-0 duration-200">
                  {history.map((item) => {
                    const timestamp = item.completedAt ?? item.submittedAt
                    return (
                      <Link
                        key={item.scanId}
                        href={`/scans/${item.scanId}`}
                        className={`grid ${TARGET_HISTORY_GRID_COLUMNS} cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--surface-light)]/20 focus-visible:bg-[var(--surface-light)]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]`}
                        aria-label={`Open previous scan ${item.title || item.scanId}`}
                      >
                        <TargetHistoryStatusBadge status={item.status} />
                        <span className="min-w-0 truncate text-sm text-[var(--text-dim)]">
                          {item.title || "No title recorded"}
                        </span>
                        <TargetsTechnologiesCell technologies={item.technologies} maxVisible={2} wrap={false} />
                        <div className="flex min-w-0 items-center gap-1.5 text-sm font-mono text-[var(--text-dim)]/70">
                          <Clock className="size-4 shrink-0" />
                          <LocalTime value={timestamp} preset="fullDateTimeWithZone" className="truncate" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
              {isLoading && hasLoadedHistory && (
                <HistorySkeletonRows count={INCREMENTAL_SKELETON_ROW_COUNT} />
              )}
              {error && hasLoadedHistory && (
                <HistoryErrorRow error={error} onRetry={onRetry} />
              )}
              {hasLoadedHistory && hasMoreHistory && history.length > 0 && !error && (
                <div className="flex items-center justify-between gap-3 border-t border-[var(--gray-border)]/30 px-3 py-2">
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
                      {isLoading ? "Loading" : "Load 50 more"}
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
                      Load all
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </TableCell>
    </TableRow>
  )
}
