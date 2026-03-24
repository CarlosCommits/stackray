"use client"

import { Search, X } from "lucide-react"

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton } from "@/components/ui/input-group"
import { SAVED_SEARCHES_FILTER_LABEL, SAVED_SEARCHES_FILTER_PLACEHOLDER, SAVED_SEARCHES_CLEAR_FILTERS_BUTTON_LABEL } from "./types"

interface SavedSearchesFilterBarProps {
  value: string
  onChange: (value: string) => void
  hasFilters: boolean
}

export function SavedSearchesFilterBar({ value, onChange, hasFilters }: SavedSearchesFilterBarProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="saved-search-filter" className="sr-only">
        {SAVED_SEARCHES_FILTER_LABEL}
      </label>
      <InputGroup className="flex-1">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          id="saved-search-filter"
          placeholder={SAVED_SEARCHES_FILTER_PLACEHOLDER}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {hasFilters && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={SAVED_SEARCHES_CLEAR_FILTERS_BUTTON_LABEL}
              onClick={() => onChange("")}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  )
}
