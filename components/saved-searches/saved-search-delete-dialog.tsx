"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { SavedSearchRow } from "./types"
import { SAVED_SEARCHES_DELETE_BUTTON_LABEL } from "./types"

interface SavedSearchDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  savedSearch: SavedSearchRow | null
  onDelete: (savedSearchId: string) => void
}

export function SavedSearchDeleteDialog({
  open,
  onOpenChange,
  savedSearch,
  onDelete,
}: SavedSearchDeleteDialogProps) {
  const handleDelete = () => {
    if (savedSearch) {
      onDelete(savedSearch.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete saved search</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{savedSearch?.name}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            {SAVED_SEARCHES_DELETE_BUTTON_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
