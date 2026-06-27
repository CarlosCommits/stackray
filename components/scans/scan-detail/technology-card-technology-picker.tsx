import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import type { TechnologyTableRow } from "./technologies"

type TechnologyCardTechnologyPickerProps = {
  readonly rows: readonly TechnologyTableRow[]
  readonly selectedIds: ReadonlySet<string>
  readonly selectedCount: number
  readonly totalCount: number
  readonly isExporting: boolean
  readonly searchQuery: string
  readonly onSearchChange: (query: string) => void
  readonly onToggleSelection: (rowId: string) => void
  readonly onSelectAll: () => void
  readonly onDeselectAll: () => void
}

export function TechnologyCardTechnologyPicker({
  rows,
  selectedIds,
  selectedCount,
  totalCount,
  isExporting,
  searchQuery,
  onSearchChange,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
}: TechnologyCardTechnologyPickerProps) {
  const visibleCount = rows.length

  return (
    <div className="flex max-h-[42vh] w-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-[var(--gray-border)]/30 bg-[var(--surface-mid)]/12 p-3 sm:max-h-56 lg:max-h-none lg:min-h-0 lg:flex-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Technologies
          </p>
          <span
            aria-label={`${selectedCount} of ${totalCount} selected`}
            className="rounded-full border border-[var(--gray-border)]/28 bg-[var(--background)]/34 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-[var(--foreground)]/72 lg:hidden"
          >
            {selectedCount}/{totalCount}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Select all"
            title="Select all"
            className="h-6 rounded-[9px] border border-[var(--gray-border)]/24 bg-[var(--background)]/28 px-2 text-[10px] text-[var(--muted-foreground)] hover:border-[var(--gray-border)]/40 hover:bg-white/6 hover:text-[var(--foreground)]"
            onClick={onSelectAll}
            disabled={isExporting || visibleCount === 0}
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Deselect all"
            title="Deselect all"
            className="h-6 rounded-[9px] border border-[var(--gray-border)]/24 bg-[var(--background)]/28 px-2 text-[10px] text-[var(--muted-foreground)] hover:border-[var(--gray-border)]/40 hover:bg-white/6 hover:text-[var(--foreground)]"
            onClick={onDeselectAll}
            disabled={isExporting || visibleCount === 0}
          >
            None
          </Button>
        </div>
      </div>

      <InputGroup className="h-8 rounded-md border-[var(--gray-border)]/40 bg-[var(--background)]/36 text-[var(--foreground)] ring-1 ring-white/5 hover:border-[var(--gray-border)]/55 focus-within:border-[var(--accent)]/60">
        <InputGroupAddon align="inline-start">
          <InputGroupText className="text-[var(--muted-foreground)]">
            <Search aria-hidden="true" />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Find technology..."
          disabled={isExporting}
          aria-label="Search technologies in export drawer"
          className="h-8 px-0 text-base placeholder:text-[var(--muted-foreground)] disabled:opacity-60 md:text-xs [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
        {searchQuery ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Clear drawer search"
              onClick={() => onSearchChange("")}
              disabled={isExporting}
              className="text-[var(--muted-foreground)] hover:bg-[var(--surface-mid)]/40 hover:text-[var(--foreground)]"
            >
              <X aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <ScrollArea
        className="min-h-0 w-full min-w-0 flex-1"
        scrollBarClassName="bg-[color-mix(in_srgb,var(--surface-dark)_84%,transparent)] data-horizontal:border-t-white/6 data-vertical:border-l-white/6"
        scrollThumbClassName="border-2 border-[color-mix(in_srgb,var(--surface-dark)_92%,black)] bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--accent)_64%,#64748b),color-mix(in_srgb,var(--accent)_36%,#334155))] hover:bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--accent)_78%,#94a3b8),color-mix(in_srgb,var(--accent)_50%,#475569))]"
      >
        <div className="flex w-full min-w-0 flex-col gap-1 pr-3">
          {rows.map((row) => {
            const checkboxId = `technology-export-${row.id}`

            return (
              <Label
                key={row.id}
                htmlFor={checkboxId}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-md border border-[var(--gray-border)]/18 bg-[var(--background)]/36 px-2 py-1.5 text-sm text-[var(--foreground)] transition-colors",
                  "w-full",
                  isExporting ? "opacity-60" : "cursor-pointer hover:bg-[var(--surface-mid)]/25",
                )}
              >
                <Checkbox
                  id={checkboxId}
                  className="size-3.5 border-[var(--gray-border)]/40 bg-[var(--surface-dark)] data-checked:border-[var(--accent)] data-checked:bg-[var(--accent)] data-checked:text-[var(--background)]"
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={(checked) => {
                    if (checked !== "indeterminate") {
                      onToggleSelection(row.id)
                    }
                  }}
                  disabled={isExporting}
                  aria-label={`Include ${row.name}`}
                />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="shrink-0 truncate text-xs text-[var(--muted-foreground)]">{row.category}</span>
              </Label>
            )
          })}
          {rows.length === 0 ? (
            <p className="py-2 text-center text-xs text-[var(--muted-foreground)]">No technologies match.</p>
          ) : null}
        </div>
      </ScrollArea>

    </div>
  )
}
