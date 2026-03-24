import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { History, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HistoryEmptyStateProps {
  hasFilters?: boolean
  onClearFilters?: () => void
}

export function HistoryEmptyState({
  hasFilters = false,
  onClearFilters,
}: HistoryEmptyStateProps) {
  return (
    <Empty className="bg-[var(--surface-mid)] border border-[var(--gray-border)]/50 min-h-[300px]">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-[var(--surface-light)]/50 text-[var(--accent)]">
          {hasFilters ? (
            <Search className="size-5" />
          ) : (
            <History className="size-5" />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-[var(--foreground)]">
          {hasFilters ? "No matching scans" : "No scan history"}
        </EmptyTitle>
        <EmptyDescription className="text-[var(--text-dim)]">
          {hasFilters
            ? "Try adjusting your search or filters to find what you're looking for."
            : "Run your first scan to see results here."}
        </EmptyDescription>
      </EmptyHeader>

      {hasFilters && onClearFilters && (
        <Button
          variant="outline"
          size="sm"
          className="border-[var(--gray-border)] text-[var(--text-dim)] hover:text-[var(--accent)]"
          onClick={onClearFilters}
        >
          Clear filters
        </Button>
      )}
    </Empty>
  )
}
