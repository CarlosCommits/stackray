"use client"

import { useMemo, useState } from "react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { savedSearchSchema } from "@/lib/contracts/search"
import {
  deleteSavedSearch,
  filterSavedSearchRows,
  renameSavedSearch,
  setSavedSearchPinned,
} from "@/lib/saved-searches/shared"
import { SavedSearchesPageHeader } from "./saved-searches-page-header"
import { SavedSearchesFilterBar } from "./saved-searches-filter-bar"
import { SavedSearchesEmptyState } from "./saved-searches-empty-state"
import { SavedSearchesSurface } from "./saved-searches-surface"
import { SavedSearchEditorDialog } from "./saved-search-editor-dialog"
import { SavedSearchDeleteDialog } from "./saved-search-delete-dialog"
import type { SavedSearchRow } from "./types"

interface SavedSearchesClientProps {
  initialRows: SavedSearchRow[]
}

function sortRows(rows: SavedSearchRow[]): SavedSearchRow[] {
  return [...rows].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })
}

export function SavedSearchesClient({ initialRows }: SavedSearchesClientProps) {
  const [rows, setRows] = useState<SavedSearchRow[]>(() => initialRows.map((row) => ({ ...row })))
  const [filterValue, setFilterValue] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create")
  const [editingRow, setEditingRow] = useState<SavedSearchRow | undefined>(undefined)
  const [editorSession, setEditorSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingRow, setDeletingRow] = useState<SavedSearchRow | null>(null)

  const filteredRows = useMemo(() => {
    const filtered = filterSavedSearchRows(rows, filterValue)
    return sortRows(filtered)
  }, [rows, filterValue])

  const hasFilters = filterValue.trim().length > 0

  const handleCreateClick = () => {
    setEditorMode("create")
    setEditingRow(undefined)
    setEditorSession((current) => current + 1)
    setEditorOpen(true)
  }

  const handleEditClick = (row: SavedSearchRow) => {
    setEditorMode("edit")
    setEditingRow(row)
    setEditorSession((current) => current + 1)
    setEditorOpen(true)
  }

  const handleDeleteClick = (row: SavedSearchRow) => {
    setDeletingRow(row)
    setDeleteOpen(true)
  }

  const handleEditorSave = async (name: string, queryDescription: string) => {
    setErrorMessage(null)

    try {
      if (editorMode === "create") {
        const response = await fetch("/api/v1/saved-searches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            queryDescription,
            pinned: false,
          }),
        })

        if (!response.ok) {
          throw new Error("Unable to create the saved search.")
        }

        const createdRow: SavedSearchRow = savedSearchSchema.parse(await response.json())
        setRows((currentRows) => sortRows([...currentRows.map((row) => ({ ...row })), createdRow]))
        return
      }

      if (editingRow) {
        const response = await fetch(`/api/v1/saved-searches/${editingRow.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
          }),
        })

        if (!response.ok) {
          throw new Error("Unable to rename the saved search.")
        }

        const updatedRow: SavedSearchRow = savedSearchSchema.parse(await response.json())
        setRows((currentRows) => sortRows(renameSavedSearch(currentRows, editingRow.id, updatedRow.name)))
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save the changes.")
    }
  }

  const handleTogglePinned = async (savedSearchId: string) => {
    const row = rows.find((candidate) => candidate.id === savedSearchId)

    if (!row) {
      return
    }

    setErrorMessage(null)

    try {
      const response = await fetch(`/api/v1/saved-searches/${savedSearchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pinned: !row.pinned,
        }),
      })

      if (!response.ok) {
        throw new Error("Unable to update the saved search pin state.")
      }

      const updatedRow: SavedSearchRow = savedSearchSchema.parse(await response.json())
      setRows((currentRows) => sortRows(setSavedSearchPinned(currentRows, savedSearchId, updatedRow.pinned)))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the saved search.")
    }
  }

  const handleDelete = async (savedSearchId: string) => {
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/v1/saved-searches/${savedSearchId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Unable to delete the saved search.")
      }

      setRows((currentRows) => sortRows(deleteSavedSearch(currentRows, savedSearchId)))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete the saved search.")
    }
  }

  return (
    <div className="space-y-6">
      <SavedSearchesPageHeader onCreateClick={handleCreateClick} />

      <Card>
        <CardHeader className="pb-4">
          <SavedSearchesFilterBar
            value={filterValue}
            onChange={setFilterValue}
            hasFilters={hasFilters}
          />
          {errorMessage && (
            <p className="pt-3 text-sm text-red-400">{errorMessage}</p>
          )}
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <SavedSearchesEmptyState
              hasFilters={hasFilters}
              onClearFilters={hasFilters ? () => setFilterValue("") : undefined}
            />
          ) : (
            <SavedSearchesSurface
              rows={filteredRows}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onTogglePinned={handleTogglePinned}
            />
          )}
        </CardContent>
      </Card>

      <SavedSearchEditorDialog
        key={`${editorMode}-${editingRow?.id ?? "new"}-${editorSession}`}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editorMode}
        savedSearch={editingRow}
        onSave={handleEditorSave}
      />

      <SavedSearchDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        savedSearch={deletingRow}
        onDelete={handleDelete}
      />
    </div>
  )
}
