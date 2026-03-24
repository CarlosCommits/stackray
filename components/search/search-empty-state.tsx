"use client"

import { Search, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { SEARCH_EMPTY_STATE, SEARCH_FILTER_EMPTY_STATE, SEARCH_CLEAR_FILTERS_BUTTON_LABEL } from "./types"

interface SearchEmptyStateProps {
  hasFilters?: boolean
  onClearFilters?: () => void
}

export function SearchEmptyState({ hasFilters, onClearFilters }: SearchEmptyStateProps) {
  const copy = hasFilters ? SEARCH_FILTER_EMPTY_STATE : SEARCH_EMPTY_STATE
  const Icon = hasFilters ? SearchX : Search

  return (
    <Empty aria-label="search empty state" className="bg-[var(--surface-mid)] border border-[var(--gray-border)]/50 min-h-[300px]">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-[var(--surface-light)]/50 text-[var(--accent)]">
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-[var(--foreground)]">{copy.title}</EmptyTitle>
        <EmptyDescription className="text-[var(--text-dim)]">{copy.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {hasFilters && onClearFilters && (
          <Button variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)] hover:text-[var(--accent)]" onClick={onClearFilters}>
            {SEARCH_CLEAR_FILTERS_BUTTON_LABEL}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
