"use client"

import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { SavedSearchRow } from "./types"
import {
  SAVED_SEARCHES_CREATE_BUTTON_LABEL,
  SAVED_SEARCHES_RENAME_BUTTON_LABEL,
} from "./types"

interface SavedSearchEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  savedSearch?: SavedSearchRow
  onSave: (name: string, queryDescription: string) => void
}

export function SavedSearchEditorDialog({
  open,
  onOpenChange,
  mode,
  savedSearch,
  onSave,
}: SavedSearchEditorDialogProps) {
  const [name, setName] = useState(() =>
    mode === "edit" && savedSearch ? savedSearch.name : "",
  )
  const [queryDescription, setQueryDescription] = useState(() =>
    mode === "edit" && savedSearch ? savedSearch.queryDescription : "",
  )

  const handleSave = () => {
    const trimmedName = name.trim()
    const trimmedQuery = queryDescription.trim()

    if (!trimmedName || !trimmedQuery) {
      return
    }

    onSave(trimmedName, trimmedQuery)
    onOpenChange(false)
  }

  const isValid = name.trim().length > 0 && queryDescription.trim().length > 0
  const isRenameMode = mode === "edit"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create saved search" : "Rename saved search"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new saved search to keep reusable queries close at hand."
              : "Update the saved search name. The query description stays unchanged in this mock-backed flow."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="saved-search-name">Name</Label>
            <Input
              id="saved-search-name"
              placeholder="e.g., WordPress + WooCommerce"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {isRenameMode ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="saved-search-query-description">Query description</Label>
              <Textarea
                id="saved-search-query-description"
                value={queryDescription}
                readOnly
                aria-readonly="true"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="saved-search-query-description">Query description</Label>
              <Textarea
                id="saved-search-query-description"
                placeholder="e.g., Sites using WordPress and WooCommerce"
                value={queryDescription}
                onChange={(event) => setQueryDescription(event.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {mode === "create" ? SAVED_SEARCHES_CREATE_BUTTON_LABEL : SAVED_SEARCHES_RENAME_BUTTON_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
