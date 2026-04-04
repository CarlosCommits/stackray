"use client"

import { Scan } from "lucide-react"
import { TARGETS_PAGE_TITLE } from "./types"

interface TargetsPageHeaderProps {
  title?: string
}

export function TargetsPageHeader({
  title = TARGETS_PAGE_TITLE,
}: TargetsPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Scan data-icon="inline-start" className="text-primary" />
        <h1 className="font-heading text-xl font-bold">
          {title}
        </h1>
      </div>
    </div>
  )
}
