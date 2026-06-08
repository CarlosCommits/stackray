"use client"

import { useCallback, useLayoutEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarClock } from "lucide-react"
import type { ScheduleListItem } from "@/lib/contracts/schedules"
import { COMMON_TIMEZONES, DEFAULT_SCHEDULE_TIMEZONE } from "@/lib/schedules/timezones"

type ScheduleFrequency = "daily" | "weekly" | "monthly"

const WEEKDAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
]

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

export interface CreateScheduleSeed {
  targets?: string[]
  options?: {
    followRedirects?: boolean
  }
}

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed?: CreateScheduleSeed
  schedule?: ScheduleListItem | null
  onSaved?: () => void
}

interface FormState {
  targets: string
  frequency: ScheduleFrequency
  timeHour: string
  timeMinute: string
  timePeriod: "AM" | "PM"
  timezone: string
  weekday: string
  dayOfMonth: string
  followRedirects: boolean
}

export function parseStoredTimeOfDay(timeOfDay: string): Pick<FormState, "timeHour" | "timeMinute" | "timePeriod"> {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeOfDay)

  if (!match) {
    return {
      timeHour: "9",
      timeMinute: "00",
      timePeriod: "AM",
    }
  }

  const hour24 = Number.parseInt(match[1] ?? "09", 10)
  const timeMinute = match[2] ?? "00"
  const timePeriod: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  return {
    timeHour: String(hour12),
    timeMinute,
    timePeriod,
  }
}

export function formatStoredTimeOfDay(hour: string, minute: string, period: "AM" | "PM") {
  const parsedHour = Number.parseInt(hour, 10)
  const normalizedHour = Number.isInteger(parsedHour) && parsedHour >= 1 && parsedHour <= 12 ? parsedHour : 9
  const normalizedMinute = /^([0-5]\d)$/.test(minute) ? minute : "00"

  let hour24 = normalizedHour % 12
  if (period === "PM") {
    hour24 += 12
  }

  return `${String(hour24).padStart(2, "0")}:${normalizedMinute}`
}

function sanitizeTimeInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 2)
}

function isValidHourInput(value: string) {
  if (!value) {
    return false
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12
}

function isValidMinuteInput(value: string) {
  if (value.length !== 2) {
    return false
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 59
}

function buildTimeInputError(hour: string, minute: string) {
  if (!isValidHourInput(hour)) {
    return "Hour must be between 1 and 12."
  }

  if (!isValidMinuteInput(minute)) {
    return "Minute must be between 00 and 59."
  }

  return null
}

function buildTargets(raw: string): string[] {
  return [...new Set(raw.split("\n").map((l) => l.trim()).filter(Boolean))]
}

function buildInitialForm(seed?: CreateScheduleSeed, schedule?: ScheduleListItem | null): FormState {
  const time = parseStoredTimeOfDay(schedule?.timeOfDay ?? "09:00")

  return {
    targets: schedule?.targets?.join("\n") ?? seed?.targets?.join("\n") ?? "",
    frequency: schedule?.frequency ?? "daily",
    timeHour: time.timeHour,
    timeMinute: time.timeMinute,
    timePeriod: time.timePeriod,
    timezone: schedule?.timezone ?? DEFAULT_SCHEDULE_TIMEZONE,
    weekday: schedule?.weekday !== null && schedule?.weekday !== undefined ? String(schedule.weekday) : "1",
    dayOfMonth: schedule?.dayOfMonth !== null && schedule?.dayOfMonth !== undefined ? String(schedule.dayOfMonth) : "1",
    followRedirects: schedule?.options?.followRedirects ?? seed?.options?.followRedirects ?? true,
  }
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  seed,
  schedule,
  onSaved,
}: CreateScheduleDialogProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(seed, schedule))

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    setForm(buildInitialForm(seed, schedule))
    setError(null)
  }, [open, schedule, seed])

  const handleHourChange = (value: string) => {
    const sanitized = sanitizeTimeInput(value)

    if (sanitized.length === 0 || isValidHourInput(sanitized)) {
      update("timeHour", sanitized)
    }
  }

  const handleMinuteChange = (value: string) => {
    const sanitized = sanitizeTimeInput(value)

    if (sanitized.length <= 1) {
      update("timeMinute", sanitized)
      return
    }

    if (isValidMinuteInput(sanitized)) {
      update("timeMinute", sanitized)
    }
  }

  const normalizeTimeInputs = () => {
    if (form.timeHour.length === 1) {
      update("timeHour", form.timeHour)
    }

    if (form.timeMinute.length === 1) {
      update("timeMinute", `0${form.timeMinute}`)
    }

    if (form.timeMinute.length === 0) {
      update("timeMinute", "00")
    }
  }

  const handleSubmit = async () => {
    const targets = buildTargets(form.targets)
    if (targets.length === 0) {
      setError("Enter at least one target.")
      return
    }

    const timeError = buildTimeInputError(form.timeHour, form.timeMinute)

    if (timeError) {
      setError(timeError)
      return
    }

    const timeOfDay = formatStoredTimeOfDay(form.timeHour, form.timeMinute, form.timePeriod)

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeOfDay)) {
      setError("Pick a valid schedule time.")
      return
    }

    const payload: Record<string, unknown> = {
      targets,
      frequency: form.frequency,
      timeOfDay,
      timezone: form.timezone,
      options: {
        followRedirects: form.followRedirects,
      },
    }

    if (form.frequency === "weekly") {
      payload.weekday = Number(form.weekday)
    }
    if (form.frequency === "monthly") {
      payload.dayOfMonth = Number(form.dayOfMonth)
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const isEditing = Boolean(schedule)
      const res = await fetch(isEditing ? `/api/v1/schedules/${schedule?.scheduleId}` : "/api/v1/schedules", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? "Failed to create schedule.")
      }

      setForm(buildInitialForm(seed, schedule))
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:!max-w-lg sm:max-h-[85vh]">
        <DialogHeader className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-[var(--accent)]" />
            {schedule ? "Edit Schedule" : "Create Schedule"}
          </DialogTitle>
          <DialogDescription>
            Set up a recurring scan schedule. Targets will be scanned automatically at the specified frequency and time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-2 sm:px-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-targets">Targets</Label>
            <Textarea
              id="schedule-targets"
              value={form.targets}
              onChange={(e) => update("targets", e.target.value)}
              placeholder={"https://example.com\nhttps://docs.example.com"}
              className="min-h-20 bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)] sm:min-h-24"
            />
            <p className="text-xs text-[var(--muted-foreground)]">One target per line.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-frequency">Frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) => update("frequency", v as ScheduleFrequency)}
            >
              <SelectTrigger className="w-full bg-[var(--surface-mid)] border-[var(--gray-border)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {form.frequency === "weekly" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-weekday">Day of week</Label>
              <Select
                value={form.weekday}
                onValueChange={(v) => update("weekday", v)}
              >
                <SelectTrigger className="w-full bg-[var(--surface-mid)] border-[var(--gray-border)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          {form.frequency === "monthly" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-day-of-month">Day of month</Label>
              <Select
                value={form.dayOfMonth}
                onValueChange={(v) => update("dayOfMonth", v)}
              >
                <SelectTrigger className="w-full bg-[var(--surface-mid)] border-[var(--gray-border)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DAYS_OF_MONTH.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Time</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Input
                  id="schedule-time-hour"
                  type="text"
                  inputMode="numeric"
                  value={form.timeHour}
                  onBlur={normalizeTimeInputs}
                  onChange={(e) => handleHourChange(e.target.value)}
                  placeholder="12"
                  aria-label="Hour"
                  className="w-14 text-center bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  maxLength={2}
                />
                <span className="text-[var(--muted-foreground)]" aria-hidden="true">:</span>
                <Input
                  id="schedule-time-minute"
                  type="text"
                  inputMode="numeric"
                  value={form.timeMinute}
                  onBlur={normalizeTimeInputs}
                  onChange={(e) => handleMinuteChange(e.target.value)}
                  placeholder="00"
                  aria-label="Minute"
                  className="w-14 text-center bg-[var(--surface-mid)] border-[var(--gray-border)]"
                  maxLength={2}
                />
                <Select value={form.timePeriod} onValueChange={(value) => update("timePeriod", value as "AM" | "PM")}>
                  <SelectTrigger className="w-[4.5rem] bg-[var(--surface-mid)] border-[var(--gray-border)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <Select
                value={form.timezone}
                onValueChange={(v) => update("timezone", v)}
              >
                <SelectTrigger className="w-full min-w-0 bg-[var(--surface-mid)] border-[var(--gray-border)] sm:flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border border-[var(--gray-border)]/30 rounded-lg p-3 space-y-3 bg-[var(--surface-mid)]/10 sm:p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">Scan options</p>
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-3">
                <p className="text-sm text-[var(--foreground)]">Follow redirects</p>
                <p className="text-xs text-[var(--muted-foreground)]">Follow HTTP redirects during scans.</p>
              </div>
              <Switch
                checked={form.followRedirects}
                onCheckedChange={(v) => update("followRedirects", v)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-b-xl px-4 py-3 sm:px-5">
          <Button
            variant="outline"
            className="border-[var(--gray-border)] text-[var(--foreground)]"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (schedule ? "Saving…" : "Creating…") : (schedule ? "Save changes" : "Create Schedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
