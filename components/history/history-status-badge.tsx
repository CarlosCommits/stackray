import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Activity,
  AlertCircle,
  Clock,
} from "lucide-react"
import type { HistoryStatusValue } from "./types"

interface HistoryStatusBadgeProps {
  status: HistoryStatusValue
}

export function HistoryStatusBadge({ status }: HistoryStatusBadgeProps) {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className="text-[9px] px-2 py-0.5 border-emerald-500/40 text-emerald-400 rounded-full font-medium"
        >
          <CheckCircle2 className="size-3 mr-1" />
          Completed
        </Badge>
      )

    case "running":
      return (
        <Badge className="text-[9px] px-2 py-0.5 bg-[var(--accent)] text-[var(--primary-foreground)] rounded-full font-medium flex items-center gap-1">
          <Activity className="size-3" />
          <span className="w-1 h-1 bg-[var(--primary-foreground)] rounded-full animate-ping" />
          Running
        </Badge>
      )

    case "failed":
      return (
        <Badge
          variant="outline"
          className="text-[9px] px-2 py-0.5 border-red-500/40 text-red-400 rounded-full font-medium"
        >
          <AlertCircle className="size-3 mr-1" />
          Failed
        </Badge>
      )

    case "queued":
      return (
        <Badge
          variant="outline"
          className="text-[9px] px-2 py-0.5 border-[var(--gray-border)] text-[var(--text-dim)] rounded-full font-medium"
        >
          <Clock className="size-3 mr-1" />
          Queued
        </Badge>
      )

    case "cancelled":
      return (
        <Badge
          variant="outline"
          className="text-[9px] px-2 py-0.5 border-amber-500/40 text-amber-400 rounded-full font-medium"
        >
          <AlertCircle className="size-3 mr-1" />
          Cancelled
        </Badge>
      )

    default:
      return null
  }
}
