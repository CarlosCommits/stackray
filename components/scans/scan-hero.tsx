"use client"

import { CheckCircle2, Clock, Globe, Scan, Server } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface ScanHeroProps {
  scanId: string
  target: string
  profile: string
  source: string
  status: "completed" | "running" | "failed" | "cancelled"
  submittedAt: string
  completedAt?: string | null
}

export function ScanHero({
  scanId,
  target,
  profile,
  source,
  status,
  submittedAt,
  completedAt,
}: ScanHeroProps) {
  const isCompleted = status === "completed"
  const formattedSubmitted = new Date(submittedAt).toLocaleString()
  const formattedCompleted = completedAt
    ? new Date(completedAt).toLocaleString()
    : null

  return (
    <Card className="border-l-4 border-l-[var(--accent)] border-[var(--gray-border)]/20 bg-transparent shadow-none">
      <CardContent className="py-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className="border-[var(--accent)] text-[var(--accent)] text-xs font-bold tracking-wider uppercase"
              >
                Target
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)]">
                {target.replace(/^https?:\/\//, "")}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase text-[var(--text-dim)]">
              <span className="flex items-center gap-1.5">
                <Scan className="w-3.5 h-3.5" />
                ID: {scanId}
              </span>
              <Separator orientation="vertical" className="h-3 bg-[var(--gray-border)]/30" />
              <span className="flex items-center gap-1.5 opacity-70">
                <Server className="w-3.5 h-3.5" />
                Profile: {profile}
              </span>
              <Separator orientation="vertical" className="h-3 bg-[var(--gray-border)]/30" />
              <span className="flex items-center gap-1.5 opacity-70">
                <Globe className="w-3.5 h-3.5" />
                Source: {source}
              </span>
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-md">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
              )}
              <span className="text-[var(--accent)] text-sm font-bold tracking-wider uppercase">
                Scan {status}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-[var(--text-dim)] font-mono">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                Submitted: {formattedSubmitted}
              </p>
              {formattedCompleted && (
                <p className="text-xs text-[var(--text-dim)] font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                  Completed: {formattedCompleted}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
