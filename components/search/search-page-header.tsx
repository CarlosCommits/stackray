"use client"

import { Search } from "lucide-react"
import { SEARCH_PAGE_TITLE } from "./types"

interface SearchPageHeaderProps {
  title?: string
}

export function SearchPageHeader({
  title = SEARCH_PAGE_TITLE,
}: SearchPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Search data-icon="inline-start" className="text-primary" />
        <h1 className="font-heading text-xl font-bold">
          {title}
        </h1>
      </div>
    </div>
  )
}
