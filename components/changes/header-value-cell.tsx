import { CopyTextButton } from "@/components/changes/copy-fingerprint-button"
import { cn } from "@/lib/utils"

function VisibleHeaderValue({
  values,
  label,
  current,
  wrap = false,
}: {
  values: readonly string[]
  label: string
  current: boolean
  wrap?: boolean
}) {
  const fullValue = values.join("\n")
  const displayValue = values.join(", ")

  return (
    <div className={cn("flex min-w-0 gap-1.5", wrap ? "items-start" : "items-center")}>
      <code
        className={cn(
          "min-w-0 flex-1 font-mono text-xs",
          wrap
            ? "max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            : "truncate",
          current ? "text-orange-400" : "text-muted-foreground",
        )}
        title={wrap ? undefined : displayValue}
        tabIndex={wrap ? 0 : undefined}
        role={wrap ? "region" : undefined}
        aria-label={wrap ? `Stored ${label} header value` : undefined}
      >
        {displayValue}
      </code>
      <CopyTextButton
        value={fullValue}
        ariaLabel={`Copy ${label} header value`}
        tooltip="Copy full header value"
      />
    </div>
  )
}

export function HeaderValueCell({
  values,
  label,
  current = false,
  missingLabel,
}: {
  values: readonly string[] | null
  label: string
  current?: boolean
  missingLabel: string
}) {
  if (!values || values.length === 0) {
    return (
      <span className={cn(
        "text-xs",
        current && missingLabel === "Not present"
          ? "font-medium text-orange-400"
          : "text-muted-foreground",
      )}>
        {missingLabel}
      </span>
    )
  }

  return <VisibleHeaderValue values={values} label={label} current={current} />
}
