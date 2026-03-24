"use client"

import { Bookmark, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import {
  SAVED_SEARCHES_EMPTY_STATE,
  SAVED_SEARCHES_FILTER_EMPTY_STATE,
  SAVED_SEARCHES_CLEAR_FILTERS_BUTTON_LABEL,
} from "./types"

interface SavedSearchesEmptyStateProps {
  hasFilters: boolean
  onClearFilters?: () => void
}

export function SavedSearchesEmptyState({ hasFilters, onClearFilters }: SavedSearchesEmptyStateProps) {
  const copy = hasFilters ? SAVED_SEARCHES_FILTER_EMPTY_STATE : SAVED_SEARCHES_EMPTY_STATE
  const Icon = hasFilters ? SearchX : Bookmark

  return (
    <Empty aria-label="saved searches empty state">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{copy.title}</EmptyTitle>
        <EmptyDescription>{copy.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {hasFilters && onClearFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            {SAVED_SEARCHES_CLEAR_FILTERS_BUTTON_LABEL}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
