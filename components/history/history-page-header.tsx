import { History } from "lucide-react"

interface HistoryPageHeaderProps {
  title?: string
}

export function HistoryPageHeader({
  title = "Scan History",
}: HistoryPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <History className="size-5 text-[var(--accent)]" />
        <h1 className="font-[var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          {title}
        </h1>
      </div>
    </div>
  )
}
