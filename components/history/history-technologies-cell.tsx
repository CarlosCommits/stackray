import { Badge } from "@/components/ui/badge"
import type { HistoryRowTopTechnologies } from "./types"

interface HistoryTechnologiesCellProps {
  technologies: HistoryRowTopTechnologies
  size?: "sm" | "md"
}

export function HistoryTechnologiesCell({
  technologies,
  size = "sm",
}: HistoryTechnologiesCellProps) {
  if (technologies.totalCount === 0) {
    return (
      <span className="text-[var(--text-dim)]/40 text-[10px] font-mono">
        —
      </span>
    )
  }

  const sizeClasses = size === "sm"
    ? "text-[9px] px-1.5 py-0.5"
    : "text-xs px-2 py-1"

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {technologies.visibleItems.map((tech) => (
        <Badge
          key={tech}
          variant="outline"
          className={`${sizeClasses} bg-[var(--surface-light)]/50 border-[var(--gray-border)]/50 text-[var(--foreground)] rounded`}
        >
          {tech}
        </Badge>
      ))}
      {technologies.truncated && technologies.overflowLabel && (
        <span className="text-[9px] text-[var(--text-dim)]">
          {technologies.overflowLabel}
        </span>
      )}
    </div>
  )
}
