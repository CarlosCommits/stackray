import { cn } from "@/lib/utils"

interface SquareLoaderProps {
  label: string
  color: string
  paused?: boolean
  speedSeconds?: number
  trackOpacity?: number
  className?: string
  decorative?: boolean
}

// Inspired by LDRS Square (MIT), using a masked rotating gradient to avoid per-frame SVG repainting.
export function SquareLoader({
  label,
  color,
  paused = false,
  speedSeconds = 1.2,
  trackOpacity = 0.16,
  className,
  decorative = false,
}: SquareLoaderProps) {
  return (
    <span
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-live={decorative ? undefined : "polite"}
      aria-hidden={decorative ? "true" : undefined}
      className={cn("relative inline-flex size-6 shrink-0", className)}
      data-slot="square-loader"
      style={{ color }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[3px] border-2 border-current"
        style={{ opacity: trackOpacity }}
      />
      <span aria-hidden="true" className="square-loader-snake-mask">
        <span
          className="square-loader-snake"
          style={{
            animationDuration: String(speedSeconds) + "s",
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </span>
    </span>
  )
}
