"use client"

import { useState, useCallback } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScheduleList } from "./schedule-list"
import { CreateScheduleDialog } from "./create-schedule-dialog"
import type { ScheduleListItem } from "@/lib/contracts/schedules"

interface SchedulesClientProps {
  initialSchedules: ScheduleListItem[]
}

async function fetchSchedules(): Promise<ScheduleListItem[]> {
  const res = await fetch("/api/v1/schedules")
  if (!res.ok) throw new Error("Failed to fetch schedules")
  const data = await res.json()
  return data.items
}

export function SchedulesClient({ initialSchedules }: SchedulesClientProps) {
  const [schedules, setSchedules] = useState<ScheduleListItem[]>(initialSchedules)
  const [dialogOpen, setDialogOpen] = useState(false)

  const refreshSchedules = useCallback(async () => {
    try {
      const items = await fetchSchedules()
      setSchedules(items)
    } catch {
      // Keep current data on fetch failure
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Button
          className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-4 h-4" />
          + Schedule
        </Button>
      </div>

      <ScheduleList schedules={schedules} onRefresh={refreshSchedules} />

      <CreateScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refreshSchedules}
      />
    </div>
  )
}
