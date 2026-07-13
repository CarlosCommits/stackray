import { cn } from "@/lib/utils"

interface ScanCompleteIndicatorProps {
  className?: string
  decorative?: boolean
  iconClassName?: string
  label?: string
}

export function ScanCompleteIndicator({
  className,
  decorative = false,
  iconClassName,
  label = "Scan complete",
}: ScanCompleteIndicatorProps) {
  return (
    <span
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? "true" : undefined}
      className={cn(
        "relative inline-flex size-6 shrink-0 items-center justify-center text-emerald-400",
        className,
      )}
      data-slot="complete-status-indicator"
    >
      <span aria-hidden="true" className="absolute inset-0 rounded-[3px] border-2 border-current opacity-15" />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn("relative size-5 fill-none", iconClassName)}
        focusable="false"
      >
        <path
          d="M5.25 12.3c1.65 1.35 2.8 2.55 4.25 4.05 2.85-3.75 5.7-6.55 9.25-9.15"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
