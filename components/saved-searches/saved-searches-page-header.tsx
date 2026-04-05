"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SAVED_SEARCHES_CREATE_BUTTON_LABEL } from "./types"

interface SavedSearchesPageHeaderProps {
  onCreateClick: () => void
}

export function SavedSearchesPageHeader({ onCreateClick }: SavedSearchesPageHeaderProps) {
  return (
    <div className="flex items-center justify-end">
      <Button onClick={onCreateClick}>
        <Plus data-icon="inline-start" />
        {SAVED_SEARCHES_CREATE_BUTTON_LABEL}
      </Button>
    </div>
  )
}
