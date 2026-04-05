"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Clock, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { TargetsTechnologiesCell } from "./targets-technologies-cell"
import type { TargetHistoryItem } from "./targets-surface"

const ACCENT_BORDER_CELL =
  "relative before:content-[''] before:absolute before:left-5.5 before:top-0 before:bottom-0 before:w-0.5 before:bg-[var(--accent)]"

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
      className={`text-[10px] px-2 py-0.5 border-[var(--gray-border)] ${statusColors[status]}`}
    >
      {getTargetHistoryStatusLabel(status)}
    </Badge>
  )
}

interface TargetsHistoryRowsProps {
  history: TargetHistoryItem[]
  isLoading: boolean
  hasLoadedHistory: boolean
  animationState?: "open" | "closed"
  panelId?: string
}

export function TargetsHistoryRows({
  history,
  isLoading,
  hasLoadedHistory,
  animationState = "open",
  panelId,
}: TargetsHistoryRowsProps) {
  const router = useRouter()
  const isClosing = animationState === "closed"
  const containerAnimationClassName = isClosing
    ? "animate-out fade-out-0 slide-out-to-top-1 duration-150"
    : "animate-in fade-in-0 slide-in-from-top-1 duration-150"

  if (isLoading) {
    return (
      <TableRow className={`border-0 hover:bg-transparent ${containerAnimationClassName}`}>
        <TableCell id={panelId} colSpan={5} className={`py-3 ${ACCENT_BORDER_CELL}`}>
          <div className="flex items-center justify-center">
            <div className="size-4 border-2 border-[var(--text-dim)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        </TableCell>
      </TableRow>
    )
  }

  if (hasLoadedHistory && history.length === 0) {
    return (
      <TableRow className={`border-0 hover:bg-transparent ${containerAnimationClassName}`}>
        <TableCell id={panelId} colSpan={5} className={`py-2 ${ACCENT_BORDER_CELL}`}>
          <div className="pl-11">
            <span className="text-xs text-[var(--text-dim)]">No previous scans for this target.</span>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      <TableRow className={`border-0 hover:bg-transparent ${containerAnimationClassName}`}>
        <TableCell id={panelId} className={`py-1 pb-0 ${ACCENT_BORDER_CELL}`} colSpan={5}>
          <div className="pl-11">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]/50">
              Previous scans
            </span>
          </div>
        </TableCell>
      </TableRow>
      {history.map((item) => {
        const timestamp = item.completedAt ?? item.submittedAt
        const formattedDate = new Date(timestamp).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        return (
          <TableRow
            key={item.scanId}
            className={`border-0 group/history cursor-pointer hover:bg-[var(--surface-mid)]/30 focus-visible:bg-[var(--surface-mid)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${containerAnimationClassName}`}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) return
              router.push(`/scans/${item.scanId}`)
            }}
            tabIndex={0}
            role="link"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                router.push(`/scans/${item.scanId}`)
              }
            }}
          >
            <TableCell className={`py-1 ${ACCENT_BORDER_CELL}`}>
              <div className="pl-11 flex items-center gap-3">
                <TargetHistoryStatusBadge status={item.status} />
              </div>
            </TableCell>
            <TableCell className="py-1">
              <span className="text-xs text-[var(--text-dim)] group-hover/history:text-[var(--foreground)] transition-colors line-clamp-1">
                {item.title || "No title recorded"}
              </span>
            </TableCell>
            <TableCell className="py-1">
              <TargetsTechnologiesCell technologies={item.technologies} maxVisible={2} />
            </TableCell>
            <TableCell className="py-1">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-dim)]/60">
                <Clock className="size-3 shrink-0" />
                <span>{formattedDate}</span>
              </div>
            </TableCell>
            <TableCell className="py-1">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-6 text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)]"
              >
                <Link href={`/scans/${item.scanId}`}>
                  View scan
                  <ExternalLink className="size-3 ml-1" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        )
      })}
    </>
  )
}
