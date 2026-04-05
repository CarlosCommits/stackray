"use client"

import Link from "next/link"
import { Clock, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TargetHistoryItem } from "./targets-surface"

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
      className={`text-[10px] px-2 py-0.5 border-[var(--gray-border)] ${statusColors[status]}`}
    >
      {getTargetHistoryStatusLabel(status)}
    </Badge>
  )
}

interface TargetsHistoryListProps {
  history: TargetHistoryItem[]
}

export function TargetsHistoryList({ history }: TargetsHistoryListProps) {
  if (history.length === 0) {
    return (
      <div className="py-4 text-sm text-[var(--text-dim)] text-center">
        No previous runs for this target yet.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {history.map((item) => {
        const timestamp = item.completedAt ?? item.submittedAt
        const formattedDate = new Date(timestamp).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })

        return (
          <Link
            key={item.scanId}
            href={`/scans/${item.scanId}`}
            className="flex items-center gap-3 py-2.5 px-3 rounded-md border border-transparent bg-transparent hover:bg-[var(--surface-mid)]/50 hover:border-[var(--gray-border)]/30 transition-colors group"
          >
            <div className="shrink-0">
              <TargetHistoryStatusBadge status={item.status} />
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <History className="size-4 text-[var(--text-dim)] shrink-0" />
              <span className="text-sm text-[var(--text-dim)] truncate group-hover:text-[var(--foreground)] transition-colors">
                {item.title || "No title recorded"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-dim)] shrink-0">
              <Clock className="size-3.5 shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-[var(--text-dim)] hover:text-[var(--accent)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.preventDefault()}
            >
              View
            </Button>
          </Link>
        )
      })}
    </div>
  )
}
