"use client"

import Link from "next/link"
import { ChevronRight, ChevronsDown, Clock, ListPlus } from "lucide-react"
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
const TARGET_HISTORY_GRID_COLUMNS =
  "grid-cols-[28px_130px_minmax(240px,1fr)_minmax(150px,0.55fr)_220px]"

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

export function TargetHistoryStatusBadge({ status }: { status: TargetHistoryItem["status"] }) {
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
  onLoadAll: () => void
  onLoadMore: () => void
  panelId?: string
  totalHistoryCount: number | null
}

export function TargetsHistoryRows({
  hasMoreHistory,
  history,
  isLoading,
  hasLoadedHistory,
  isOpen,
  onLoadAll,
  onLoadMore,
  panelId,
  totalHistoryCount,
}: TargetsHistoryRowsProps) {
  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell colSpan={4} className="p-0">
        <Collapsible open={isOpen}>
          <CollapsibleContent id={panelId}>
            <div className="mx-2 mb-1.5 ml-10">
              <div className="rounded-md border border-[var(--gray-border)]/45 border-l-[var(--accent)] bg-[var(--surface-mid)]/35 shadow-sm">
                <div className={`grid ${TARGET_HISTORY_GRID_COLUMNS} items-center gap-2 border-b border-[var(--gray-border)]/35 px-3 py-2`}>
                  <div />
                  <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]/70">
                    Status
                  </span>
                  <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]/70">
                    Title
                  </span>
                  <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]/70">
                    Technologies
                  </span>
                  <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]/70">
                    Scanned at
                  </span>
                </div>

                {isLoading && !hasLoadedHistory ? (
                  <div className="divide-y divide-[var(--gray-border)]/25 animate-in fade-in-0 duration-200">
                    {Array.from({ length: LOADING_HISTORY_ROW_COUNT }).map((_, index) => (
                      <div
                        key={index}
                        className={`grid ${TARGET_HISTORY_GRID_COLUMNS} items-center gap-2 px-3 py-2`}
                      >
                        <ChevronRight className="size-3.5 text-[var(--text-dim)]/35" />
                        <div className="h-4 w-24 rounded bg-[var(--surface-light)]/60" />
                        <div className="h-4 w-4/5 rounded bg-[var(--surface-light)]/45" />
                        <div className="flex gap-1.5">
                          <div className="h-5 w-16 rounded bg-[var(--surface-light)]/55" />
                          <div className="h-5 w-20 rounded bg-[var(--surface-light)]/45" />
                        </div>
                        <div className="h-4 w-28 rounded bg-[var(--surface-light)]/45" />
                      </div>
                    ))}
                  </div>
                ) : hasLoadedHistory && history.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[var(--text-dim)]">
                    No previous scans for this target.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--gray-border)]/25 animate-in fade-in-0 duration-200">
                    {history.map((item) => {
                      const timestamp = item.completedAt ?? item.submittedAt
                      return (
                        <Link
                          key={item.scanId}
                          href={`/scans/${item.scanId}`}
                          className={`grid ${TARGET_HISTORY_GRID_COLUMNS} cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--surface-light)]/25 focus-visible:bg-[var(--surface-light)]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]`}
                          aria-label={`Open previous scan ${item.scanId}`}
                        >
                          <ChevronRight className="size-3.5 text-[var(--text-dim)]/70" />
                          <TargetHistoryStatusBadge status={item.status} />
                          <span className="min-w-0 truncate text-sm text-[var(--text-dim)]">
                            {item.title || "No title recorded"}
                          </span>
                          <TargetsTechnologiesCell technologies={item.technologies} maxVisible={2} wrap={false} />
                          <div className="flex items-center gap-1.5 text-sm font-mono text-[var(--text-dim)]/70">
                            <Clock className="size-4 shrink-0" />
                            <LocalTime value={timestamp} preset="fullDateTimeWithZone" />
                          </div>
                        </Link>
                      )
                      })}
                    </div>
                  )}
                  {hasLoadedHistory && hasMoreHistory && history.length > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-[var(--gray-border)]/35 px-3 py-2">
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
              </div>
            </CollapsibleContent>
        </Collapsible>
      </TableCell>
    </TableRow>
  )
}
