"use client"

import { Bookmark, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SAVED_SEARCHES_PAGE_TITLE, SAVED_SEARCHES_CREATE_BUTTON_LABEL } from "./types"

interface SavedSearchesPageHeaderProps {
  onCreateClick: () => void
}

export function SavedSearchesPageHeader({ onCreateClick }: SavedSearchesPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Bookmark data-icon="inline-start" className="text-primary" />
        <h1 className="font-heading text-xl font-bold">
          {SAVED_SEARCHES_PAGE_TITLE}
        </h1>
      </div>
      <Button onClick={onCreateClick}>
        <Plus data-icon="inline-start" />
        {SAVED_SEARCHES_CREATE_BUTTON_LABEL}
      </Button>
    </div>
  )
}
