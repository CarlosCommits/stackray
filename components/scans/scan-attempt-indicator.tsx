"use client"

import { CheckCircle2, AlertCircle, RotateCcw, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type RequestProfile = "baseline" | "browser_headers" | "tlsi_final_url"

interface ScanAttempt {
  attemptId: string
  attemptNumber: number
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  requestProfile: RequestProfile
  fallbackReason: string | null
  resultCount: number
  forbiddenResultCount: number
}

interface ScanAttemptIndicatorProps {
  currentAttempt: ScanAttempt
  attemptHistory: ScanAttempt[]
}

const profileLabels: Record<RequestProfile, string> = {
  baseline: "Baseline",
  browser_headers: "Browser headers",
  tlsi_final_url: "TLS impersonation",
}

function getProfileBadgeColor(profile: RequestProfile): string {
  switch (profile) {
    case "baseline":
      return "bg-slate-500/10 text-slate-600 border-slate-500/30"
    case "browser_headers":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30"
    case "tlsi_final_url":
      return "bg-purple-500/10 text-purple-600 border-purple-500/30"
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/30"
  }
}

function AttemptBadge({ attempt, isCurrent }: { attempt: ScanAttempt; isCurrent: boolean }) {
  const label = profileLabels[attempt.requestProfile]
  const colorClass = getProfileBadgeColor(attempt.requestProfile)

  const icon = isCurrent ? (
    <CheckCircle2 className="w-3 h-3" />
  ) : attempt.fallbackReason ? (
    <RotateCcw className="w-3 h-3" />
  ) : (
    <AlertCircle className="w-3 h-3" />
  )

  const tooltipContent = (
    <div className="space-y-1 max-w-xs">
      <p className="font-medium">{label}</p>
      {attempt.fallbackReason && (
        <p className="text-xs text-muted-foreground">Fallback: {attempt.fallbackReason}</p>
      )}
      {attempt.forbiddenResultCount > 0 && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          {attempt.forbiddenResultCount} blocked response{attempt.forbiddenResultCount !== 1 ? "s" : ""}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{attempt.resultCount} result{attempt.resultCount !== 1 ? "s" : ""}</p>
    </div>
  )

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${colorClass} text-xs font-medium cursor-help flex items-center gap-1.5 px-2 py-0.5 ${
              isCurrent ? "ring-1 ring-current" : "opacity-70"
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{attempt.attemptNumber}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function ScanAttemptIndicator({ currentAttempt, attemptHistory }: ScanAttemptIndicatorProps) {
  const hasMultipleAttempts = attemptHistory.length > 1
  const isNonBaseline = currentAttempt.requestProfile !== "baseline"

  if (!hasMultipleAttempts && !isNonBaseline) {
    return null
  }

  const sortedHistory = [...attemptHistory].sort((a, b) => a.attemptNumber - b.attemptNumber)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-[var(--text-dim)] uppercase font-medium">Strategy:</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {sortedHistory.map((attempt) => (
          <AttemptBadge
            key={attempt.attemptId}
            attempt={attempt}
            isCurrent={attempt.attemptId === currentAttempt.attemptId}
          />
        ))}
      </div>
    </div>
  )
}
