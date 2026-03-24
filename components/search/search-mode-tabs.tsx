"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SEARCH_MODE_LABELS } from "./types"
import type { SearchModeValue } from "./types"

interface SearchModeTabsProps {
  mode: SearchModeValue
  onModeChange: (mode: SearchModeValue) => void
}

export function SearchModeTabs({ mode, onModeChange }: SearchModeTabsProps) {
  return (
    <Tabs value={mode} onValueChange={(value) => onModeChange(value as SearchModeValue)}>
      <TabsList>
        <TabsTrigger value="latest" onClick={() => onModeChange("latest")}>
          {SEARCH_MODE_LABELS.latest}
        </TabsTrigger>
        <TabsTrigger value="snapshots" onClick={() => onModeChange("snapshots")}>
          {SEARCH_MODE_LABELS.snapshots}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
