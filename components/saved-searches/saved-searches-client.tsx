"use client"

import { useMemo, useState } from "react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { savedSearchSchema, type SavedSearch } from "@/lib/contracts/search"
import {
  createSavedSearch,
  deleteSavedSearch,
  filterSavedSearchRows,
  renameSavedSearch,
  setSavedSearchPinned,
} from "@/lib/queries/saved-searches"
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

  const handleEditorSave = (name: string, queryDescription: string) => {
    if (editorMode === "create") {
      const nextSavedSearch: SavedSearch = savedSearchSchema.parse({
        id: `ss_${Date.now()}`,
        name,
        pinned: false,
        queryDescription,
      })
      setRows((currentRows) => sortRows(createSavedSearch(currentRows, nextSavedSearch)))
    } else if (editingRow) {
      setRows((currentRows) => sortRows(renameSavedSearch(currentRows, editingRow.id, name)))
    }
  }

  const handleTogglePinned = (savedSearchId: string) => {
    setRows((currentRows) => {
      const row = currentRows.find((candidate) => candidate.id === savedSearchId)
      if (!row) return currentRows
      return sortRows(setSavedSearchPinned(currentRows, savedSearchId, !row.pinned))
    })
  }

  const handleDelete = (savedSearchId: string) => {
    setRows((currentRows) => sortRows(deleteSavedSearch(currentRows, savedSearchId)))
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
