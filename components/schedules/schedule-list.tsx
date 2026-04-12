"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CalendarClock,
  Pause,
  Play,
  Trash2,
  Clock,
  Globe,
} from "lucide-react"
import type { ScheduleListItem } from "@/lib/contracts/schedules"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}

function formatNextRun(isoDate: string, timeZone: string): string {
  const date = new Date(isoDate)
  return date.toLocaleString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

interface ScheduleListProps {
  schedules: ScheduleListItem[]
  onRefresh: () => void
}

export function ScheduleList({ schedules, onRefresh }: ScheduleListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = useCallback(async (scheduleId: string, currentlyEnabled: boolean) => {
    setTogglingId(scheduleId)
    setError(null)
    try {
      const res = await fetch(`/api/v1/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentlyEnabled }),
      })
      if (!res.ok) throw new Error("Failed to update schedule")
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update schedule.")
    } finally {
      setTogglingId(null)
    }
  }, [onRefresh])

  const handleDelete = useCallback(async (scheduleId: string) => {
    setDeletingId(scheduleId)
    setError(null)
    try {
      const res = await fetch(`/api/v1/schedules/${scheduleId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete schedule")
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete schedule.")
    } finally {
      setDeletingId(null)
    }
  }, [onRefresh])

  if (schedules.length === 0) {
    return (
      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardContent className="py-12 text-center">
          <CalendarClock className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)] text-lg font-medium">No schedules yet</p>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">
            Create a schedule to run scans automatically on a recurring basis.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {schedules.map((schedule) => {
        const isToggling = togglingId === schedule.scheduleId
        const isDeleting = deletingId === schedule.scheduleId

        return (
          <Card key={schedule.scheduleId} className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={
                          schedule.enabled
                            ? "border-emerald-400/30 text-emerald-400"
                            : "border-[var(--gray-border)] text-[var(--muted-foreground)]"
                        }
                      >
                        {schedule.enabled ? "Active" : "Paused"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {schedule.targets.map((target) => (
                        <span
                          key={target}
                          className="inline-block text-xs font-mono text-[var(--foreground)] bg-[var(--surface-mid)]/30 border border-[var(--gray-border)]/30 rounded px-2 py-0.5 truncate max-w-[200px]"
                        >
                          {target}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleToggle(schedule.scheduleId, schedule.enabled)}
                      disabled={isToggling || isDeleting}
                      aria-label={schedule.enabled ? "Pause schedule" : "Resume schedule"}
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      {schedule.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(schedule.scheduleId)}
                      disabled={isToggling || isDeleting}
                      aria-label="Delete schedule"
                      className="text-[var(--muted-foreground)] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)] pt-2 border-t border-[var(--gray-border)]/20">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {schedule.timeOfDay}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    {schedule.timezone}
                  </span>
                  {schedule.frequency === "weekly" && schedule.weekday !== null && (
                    <span>on {WEEKDAY_LABELS[schedule.weekday]}</span>
                  )}
                  {schedule.frequency === "monthly" && schedule.dayOfMonth !== null && (
                    <span>on day {schedule.dayOfMonth}</span>
                  )}
                  {schedule.nextRunAt && (
                    <span className="ml-auto">
                      Next: {formatNextRun(schedule.nextRunAt, schedule.timezone)}
                    </span>
                  )}
                </div>
                {(schedule.lastRunLabel || schedule.lastScanId) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
                    {schedule.lastRunLabel && <span>Last run: {schedule.lastRunLabel}</span>}
                    {schedule.lastScheduledForAt && (
                      <span>Slot: {formatNextRun(schedule.lastScheduledForAt, schedule.timezone)}</span>
                    )}
                    {schedule.lastScanId && (
                      <Link
                        href={`/scans/${schedule.lastScanId}`}
                        className="text-[var(--accent)] hover:text-[var(--accent)]/80"
                      >
                        View run
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
