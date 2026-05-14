"use client"

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  CalendarClock,
  Pencil,
  Pause,
  Play,
  Trash2,
  Clock,
  Globe,
  Search,
  X,
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
  onEdit: (schedule: ScheduleListItem) => void
  onDeleteRequest: (schedule: ScheduleListItem) => void
  onRefresh: () => void
}

export function ScheduleList({ schedules, onEdit, onDeleteRequest, onRefresh }: ScheduleListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

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

  const filteredSchedules = useMemo(() => {
    if (!search.trim()) return schedules
    const q = search.toLowerCase()
    return schedules.filter((s) => {
      const targetMatch = s.targets.some((t) => t.toLowerCase().includes(q))
      const tzMatch = s.timezone.toLowerCase().includes(q)
      const freqMatch = (FREQUENCY_LABELS[s.frequency] ?? s.frequency).toLowerCase().includes(q)
      return targetMatch || tzMatch || freqMatch
    })
  }, [schedules, search])

  const hasActiveSearch = search.trim().length > 0

  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarClock className="size-12 text-[var(--muted-foreground)] mb-4" />
        <p className="text-[var(--muted-foreground)] text-lg font-medium">No schedules yet</p>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">
          Create a schedule to run scans automatically on a recurring basis.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <InputGroup className="flex-1 max-w-sm bg-[var(--surface-mid)] border-[var(--gray-border)]">
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-[var(--text-dim)]" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search schedules"
            placeholder="Filter by target, timezone, or frequency..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-[var(--foreground)] placeholder:text-[var(--text-dim)]/50"
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <Button
                aria-label="Clear search"
                variant="ghost"
                size="icon-xs"
                className="text-[var(--text-dim)] hover:text-[var(--foreground)]"
                onClick={() => setSearch("")}
              >
                <X className="size-3.5" />
              </Button>
            </InputGroupAddon>
          )}
        </InputGroup>
        {hasActiveSearch && (
          <Badge variant="outline" className="text-[10px] border-[var(--gray-border)] text-[var(--text-dim)]">
            {filteredSchedules.length === 1 ? "1 schedule" : `${filteredSchedules.length} schedules`}
          </Badge>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {filteredSchedules.length === 0 && hasActiveSearch ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="size-8 text-[var(--muted-foreground)] mb-3" />
          <p className="text-[var(--muted-foreground)] text-sm">No schedules match your search.</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-[var(--text-dim)] hover:text-[var(--accent)]"
            onClick={() => setSearch("")}
          >
            Clear search
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--gray-border)] hover:bg-transparent">
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                    Targets
                  </TableHead>
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                    Frequency
                  </TableHead>
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                    Time
                  </TableHead>
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                    Next run
                  </TableHead>
                  <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                    Last run
                  </TableHead>
                  <TableHead className="w-[100px] text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchedules.map((schedule) => {
                  const isToggling = togglingId === schedule.scheduleId

                  return (
                    <DesktopScheduleRow
                      key={schedule.scheduleId}
                      schedule={schedule}
                      isToggling={isToggling}
                      onEdit={onEdit}
                      onToggle={handleToggle}
                      onDeleteRequest={onDeleteRequest}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredSchedules.map((schedule) => {
              const isToggling = togglingId === schedule.scheduleId

              return (
                <MobileScheduleCard
                  key={schedule.scheduleId}
                  schedule={schedule}
                  isToggling={isToggling}
                  onEdit={onEdit}
                  onToggle={handleToggle}
                  onDeleteRequest={onDeleteRequest}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function DesktopScheduleRow({
  schedule,
  isToggling,
  onEdit,
  onToggle,
  onDeleteRequest,
}: {
  schedule: ScheduleListItem
  isToggling: boolean
  onEdit: (schedule: ScheduleListItem) => void
  onToggle: (scheduleId: string, currentlyEnabled: boolean) => void
  onDeleteRequest: (schedule: ScheduleListItem) => void
}) {
  return (
    <TableRow className="border-[var(--gray-border)]/50 hover:bg-[var(--surface-mid)]/50">
      <TableCell>
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
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {schedule.targets.map((target) => (
            <span
              key={target}
              className="text-sm font-mono text-[var(--foreground)] truncate max-w-[280px]"
              title={target}
            >
              {target}
            </span>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs border-[var(--gray-border)]">
          {FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5 text-sm text-[var(--text-dim)]">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5 shrink-0" />
            {schedule.timeOfDay}
          </span>
          <span className="flex items-center gap-1">
            <Globe className="size-3.5 shrink-0" />
            {schedule.timezone}
          </span>
          {schedule.frequency === "weekly" && schedule.weekday !== null && (
            <span className="text-xs">on {WEEKDAY_LABELS[schedule.weekday]}</span>
          )}
          {schedule.frequency === "monthly" && schedule.dayOfMonth !== null && (
            <span className="text-xs">on day {schedule.dayOfMonth}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {schedule.nextRunAt ? (
          <span className="text-sm text-[var(--text-dim)]">
            {formatNextRun(schedule.nextRunAt, schedule.timezone)}
          </span>
        ) : (
          <span className="text-sm text-[var(--text-dim)]">Not scheduled</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {schedule.lastRunLabel && (
            <span className="text-sm text-[var(--text-dim)]">{schedule.lastRunLabel}</span>
          )}
          {schedule.lastScanId && (
            <Link
              href={`/scans/${schedule.lastScanId}`}
              className="text-sm text-[var(--accent)] hover:text-[var(--accent)]/80"
            >
              View run
            </Link>
          )}
          {!schedule.lastRunLabel && !schedule.lastScanId && (
            <span className="text-sm text-[var(--text-dim)]">No runs yet</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(schedule)}
            disabled={isToggling}
            aria-label="Edit schedule"
            className="cursor-pointer text-[var(--muted-foreground)] hover:text-amber-400 hover:bg-amber-500/10"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggle(schedule.scheduleId, schedule.enabled)}
            disabled={isToggling}
            aria-label={schedule.enabled ? "Pause schedule" : "Resume schedule"}
            className="cursor-pointer text-[var(--muted-foreground)] hover:text-blue-400 hover:bg-blue-500/10"
          >
            {schedule.enabled ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDeleteRequest(schedule)}
            disabled={isToggling}
            aria-label="Delete schedule"
            className="cursor-pointer text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function MobileScheduleCard({
  schedule,
  isToggling,
  onEdit,
  onToggle,
  onDeleteRequest,
}: {
  schedule: ScheduleListItem
  isToggling: boolean
  onEdit: (schedule: ScheduleListItem) => void
  onToggle: (scheduleId: string, currentlyEnabled: boolean) => void
  onDeleteRequest: (schedule: ScheduleListItem) => void
}) {
  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
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
              <Badge variant="outline" className="text-xs border-[var(--gray-border)]">
                {FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
              </Badge>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(schedule)}
                disabled={isToggling}
                aria-label="Edit schedule"
                className="cursor-pointer text-[var(--muted-foreground)] hover:text-amber-400 hover:bg-amber-500/10"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onToggle(schedule.scheduleId, schedule.enabled)}
                disabled={isToggling}
                aria-label={schedule.enabled ? "Pause schedule" : "Resume schedule"}
                className="cursor-pointer text-[var(--muted-foreground)] hover:text-blue-400 hover:bg-blue-500/10"
              >
                {schedule.enabled ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDeleteRequest(schedule)}
                disabled={isToggling}
                aria-label="Delete schedule"
                className="cursor-pointer text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {schedule.targets.map((target) => (
              <span
                key={target}
                className="inline-block text-xs font-mono text-[var(--foreground)] bg-[var(--surface-mid)]/30 border border-[var(--gray-border)]/30 rounded px-2 py-0.5 truncate max-w-[200px]"
                title={target}
              >
                {target}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {schedule.timeOfDay}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="size-3.5" />
              {schedule.timezone}
            </span>
            {schedule.frequency === "weekly" && schedule.weekday !== null && (
              <span>on {WEEKDAY_LABELS[schedule.weekday]}</span>
            )}
            {schedule.frequency === "monthly" && schedule.dayOfMonth !== null && (
              <span>on day {schedule.dayOfMonth}</span>
            )}
          </div>

          {(schedule.nextRunAt || schedule.lastRunLabel || schedule.lastScanId) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)] border-t border-[var(--gray-border)]/20 pt-2">
              {schedule.nextRunAt && (
                <span>Next: {formatNextRun(schedule.nextRunAt, schedule.timezone)}</span>
              )}
              {schedule.lastRunLabel && <span>Last: {schedule.lastRunLabel}</span>}
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
}
