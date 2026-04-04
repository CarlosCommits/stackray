import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { History } from "lucide-react"

interface RunsEmptyStateProps {
  hasFilters?: boolean
  onClearFilters?: () => void
}

export function RunsEmptyState({ hasFilters, onClearFilters }: RunsEmptyStateProps) {
  return (
    <Card className="bg-[var(--surface-mid)] border-[var(--gray-border)]">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="size-12 rounded-full bg-[var(--surface-light)] flex items-center justify-center">
            <History className="size-6 text-[var(--text-dim)]" />
          </div>
        </div>
        <CardTitle className="text-lg font-semibold text-[var(--foreground)]">
          {hasFilters ? "No matching runs" : "No scan runs yet"}
        </CardTitle>
        <CardDescription className="text-sm text-[var(--text-dim)]">
          {hasFilters
            ? "Try adjusting your filters to find what you're looking for."
            : "Run your first scan to see results here."}
        </CardDescription>
      </CardHeader>
      {hasFilters && onClearFilters && (
        <CardContent className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="text-[var(--text-dim)] border-[var(--gray-border)] hover:text-[var(--accent)]"
          >
            Clear filters
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
