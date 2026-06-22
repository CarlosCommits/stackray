"use client"

import { useState, useCallback } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScheduleList } from "./schedule-list"
import { CreateScheduleDialog } from "./create-schedule-dialog"
import type { ScheduleListItem } from "@/lib/contracts/schedules"

interface SchedulesClientProps {
  initialSchedules: ScheduleListItem[]
  demoMode?: boolean
}

function ScheduleDeleteDialog({
  open,
  onOpenChange,
  schedule,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleListItem | null
  onDelete: (scheduleId: string) => Promise<boolean>
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!schedule) {
      return
    }

    try {
      setIsDeleting(true)
      const deleted = await onDelete(schedule.scheduleId)

      if (deleted) {
        onOpenChange(false)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isDeleting) {
        return
      }

      onOpenChange(nextOpen)
    }}>
      <DialogContent
        showCloseButton={!isDeleting}
        onEscapeKeyDown={(event) => {
          if (isDeleting) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (isDeleting) {
            event.preventDefault()
          }
        }}
        onPointerDownOutside={(event) => {
          if (isDeleting) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Delete schedule</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this schedule for &quot;{schedule?.targets[0] ?? "this target"}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

async function fetchSchedules(): Promise<ScheduleListItem[]> {
  const res = await fetch("/api/v1/schedules")
  if (!res.ok) throw new Error("Failed to fetch schedules")
  const data = await res.json()
  return data.items
}

export function SchedulesClient({ initialSchedules, demoMode = false }: SchedulesClientProps) {
  const [schedules, setSchedules] = useState<ScheduleListItem[]>(initialSchedules)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleListItem | null>(null)
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduleListItem | null>(null)

  const refreshSchedules = useCallback(async () => {
    try {
      const items = await fetchSchedules()
      setSchedules(items)
    } catch {
      // Keep current data on fetch failure
    }
  }, [])

  const handleDeleteSchedule = useCallback(async (scheduleId: string) => {
    if (demoMode) {
      return false
    }

    const response = await fetch(`/api/v1/schedules/${scheduleId}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      return false
    }

    await refreshSchedules()
    return true
  }, [demoMode, refreshSchedules])

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-2 md:px-4">
      <div className="flex items-center justify-between">
        <div />
        <Button
          className="mt-2 bg-[var(--accent)] text-[var(--primary-foreground)] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all"
          onClick={() => {
            setEditingSchedule(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" />
          Schedule
        </Button>
      </div>

      <ScheduleList
        schedules={schedules}
        onEdit={(schedule) => {
          setEditingSchedule(schedule)
          setDialogOpen(true)
        }}
        onDeleteRequest={setScheduleToDelete}
        onRefresh={refreshSchedules}
      />

      <CreateScheduleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingSchedule(null)
          }
        }}
        schedule={editingSchedule}
        demoMode={demoMode}
        onSaved={refreshSchedules}
      />

      <ScheduleDeleteDialog
        open={Boolean(scheduleToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleToDelete(null)
          }
        }}
        schedule={scheduleToDelete}
        onDelete={handleDeleteSchedule}
      />
    </div>
  )
}
