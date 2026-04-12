"use client"

import { useCallback, useEffect, useState } from "react"
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

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
]

export interface CreateScheduleSeed {
  targets?: string[]
  options?: {
    followRedirects?: boolean
    includeRawResponse?: boolean
    headless?: boolean
  }
}

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed?: CreateScheduleSeed
  onCreated?: () => void
}

interface FormState {
  targets: string
  frequency: ScheduleFrequency
  timeOfDay: string
  timezone: string
  weekday: string
  dayOfMonth: string
  followRedirects: boolean
  includeRawResponse: boolean
  headless: boolean
}

function buildTargets(raw: string): string[] {
  return [...new Set(raw.split("\n").map((l) => l.trim()).filter(Boolean))]
}

function buildInitialForm(seed?: CreateScheduleSeed): FormState {
  return {
    targets: seed?.targets?.join("\n") ?? "",
    frequency: "daily",
    timeOfDay: "09:00",
    timezone: "America/New_York",
    weekday: "1",
    dayOfMonth: "1",
    followRedirects: seed?.options?.followRedirects ?? true,
    includeRawResponse: seed?.options?.includeRawResponse ?? false,
    headless: seed?.options?.headless ?? false,
  }
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  seed,
  onCreated,
}: CreateScheduleDialogProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(seed))

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    setForm(buildInitialForm(seed))
    setError(null)
  }, [open, seed])

  const handleSubmit = async () => {
    const targets = buildTargets(form.targets)
    if (targets.length === 0) {
      setError("Enter at least one target.")
      return
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.timeOfDay)) {
      setError("Time must be in HH:MM format (00:00–23:59).")
      return
    }

    const payload: Record<string, unknown> = {
      targets,
      frequency: form.frequency,
      timeOfDay: form.timeOfDay,
      timezone: form.timezone,
      options: {
        followRedirects: form.followRedirects,
        includeRawResponse: form.includeRawResponse,
        headless: form.headless,
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
      const res = await fetch("/api/v1/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? "Failed to create schedule.")
      }

      setForm(buildInitialForm(seed))
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[var(--accent)]" />
            Create Schedule
          </DialogTitle>
          <DialogDescription>
            Set up a recurring scan schedule. Targets will be scanned automatically at the specified frequency and time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-targets">Targets</Label>
            <Textarea
              id="schedule-targets"
              value={form.targets}
              onChange={(e) => update("targets", e.target.value)}
              placeholder={"https://example.com\nhttps://docs.example.com"}
              className="min-h-24 bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-time">Time (HH:MM)</Label>
              <Input
                id="schedule-time"
                type="text"
                value={form.timeOfDay}
                onChange={(e) => update("timeOfDay", e.target.value)}
                placeholder="09:00"
                className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="schedule-timezone">Timezone</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => update("timezone", v)}
              >
                <SelectTrigger className="w-full bg-[var(--surface-mid)] border-[var(--gray-border)]">
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

          <div className="border border-[var(--gray-border)]/30 rounded-lg p-4 space-y-3 bg-[var(--surface-mid)]/10">
            <p className="text-sm font-medium text-[var(--foreground)]">Scan options</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--foreground)]">Follow redirects</p>
                <p className="text-xs text-[var(--muted-foreground)]">Follow HTTP redirects during scans.</p>
              </div>
              <Switch
                checked={form.followRedirects}
                onCheckedChange={(v) => update("followRedirects", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--foreground)]">Include raw response</p>
                <p className="text-xs text-[var(--muted-foreground)]">Store raw HTTP response bodies.</p>
              </div>
              <Switch
                checked={form.includeRawResponse}
                onCheckedChange={(v) => update("includeRawResponse", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--foreground)]">Headless browser</p>
                <p className="text-xs text-[var(--muted-foreground)]">Use a headless browser for screenshots.</p>
              </div>
              <Switch
                checked={form.headless}
                onCheckedChange={(v) => update("headless", v)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
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
            {isSubmitting ? "Creating…" : "Create Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
