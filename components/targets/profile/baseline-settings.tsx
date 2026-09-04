"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Circle, CircleDot, Pin } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { LocalTime } from "@/components/ui/local-time"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type BaselineOption = { id: string; completedAt: string | null }
type BaselineMode = "previous" | "pinned"

export function BaselineSettings({
  targetId,
  mode,
  pinnedScanId,
  options,
  canManage,
}: {
  targetId: string
  mode: "previous" | "pinned"
  pinnedScanId: string | null
  options: BaselineOption[]
  canManage: boolean
}) {
  const router = useRouter()
  const [selectedMode, setSelectedMode] = useState<BaselineMode>(mode)
  const [selectedScanId, setSelectedScanId] = useState(pinnedScanId ?? options[0]?.id ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function update(payload: { mode: "previous" } | { mode: "pinned"; scanId: string }) {
    setError(null)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/targets/${targetId}/monitoring-baseline`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
          setError(body?.error?.message ?? "Unable to update the monitoring baseline.")
          return
        }
        setSelectedMode(payload.mode)
        if (payload.mode === "previous") {
          toast.success("Automatic baseline saved", {
            description: "Future scans will compare with the previous completed scan.",
          })
        } else {
          toast.success("Pinned baseline saved", {
            description: "Future scans will compare with the selected scan.",
          })
        }
        router.refresh()
      } catch {
        setError("Unable to reach Stackray. Check your connection and try again.")
      }
    })
  }

  return (
    <section className="flex h-full flex-col gap-6" aria-labelledby="monitoring-baseline-heading">
      <div>
        <h3 id="monitoring-baseline-heading" className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Comparison baseline
        </h3>
      </div>

      <FieldGroup className="gap-4">
        <Field>
          <ToggleGroup
            type="single"
            value={selectedMode}
            onValueChange={(value) => {
              if (value) {
                setError(null)
                setSelectedMode(value as BaselineMode)
              }
            }}
            disabled={!canManage || isPending}
            variant="outline"
            orientation="vertical"
            spacing={3}
            aria-label="Comparison baseline mode"
            className="w-full items-stretch"
          >
            <ToggleGroupItem
              value="previous"
              aria-label="Automatic"
              className="group/baseline-option h-auto min-h-24 w-full cursor-pointer justify-start gap-4 rounded-xl border px-5 py-4 text-left whitespace-normal data-[state=on]:border-[var(--accent)] data-[state=on]:bg-[var(--accent)]/8 data-[state=on]:ring-1 data-[state=on]:ring-[var(--accent)]/60 data-[state=on]:ring-inset"
            >
              {selectedMode === "previous" ? (
                <CircleDot className="size-6 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              ) : (
                <Circle className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="flex min-w-0 flex-col items-start gap-1.5">
                <span className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-semibold text-foreground group-data-[state=on]/baseline-option:text-[var(--accent)]">
                    Automatic
                  </span>
                  <Badge
                    variant="outline"
                    className="border-[var(--accent)]/30 bg-[var(--accent)]/8 text-[var(--accent)]"
                  >
                    Recommended
                  </Badge>
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  Uses the previous completed scan.
                </span>
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="pinned"
              aria-label="Pinned scan"
              disabled={options.length === 0}
              className="group/baseline-option h-auto min-h-24 w-full cursor-pointer justify-start gap-4 rounded-xl border px-5 py-4 text-left whitespace-normal data-[state=on]:border-[var(--accent)] data-[state=on]:bg-[var(--accent)]/8 data-[state=on]:ring-1 data-[state=on]:ring-[var(--accent)]/60 data-[state=on]:ring-inset"
            >
              {selectedMode === "pinned" ? (
                <CircleDot className="size-6 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              ) : (
                <Circle className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="flex min-w-0 flex-col items-start gap-1.5">
                <span className="text-base font-semibold text-foreground group-data-[state=on]/baseline-option:text-[var(--accent)]">
                  Pinned scan
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  Keeps comparisons anchored to a chosen scan.
                </span>
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>

        {selectedMode === "previous" && canManage && mode !== "previous" ? (
          <Field>
            <Button className="w-fit" size="sm" disabled={isPending} onClick={() => update({ mode: "previous" })}>
              Save automatic baseline
            </Button>
          </Field>
        ) : selectedMode === "pinned" ? (
          <Field>
            <FieldLabel htmlFor="pinned-baseline-scan">Pinned baseline scan</FieldLabel>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={selectedScanId} onValueChange={setSelectedScanId} disabled={!canManage || isPending}>
                <SelectTrigger id="pinned-baseline-scan" className="w-full flex-1" aria-label="Pinned baseline scan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <LocalTime value={option.completedAt} preset="fullDateTimeWithZone" />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {canManage ? (
                <Button
                  className="shrink-0"
                  disabled={isPending || !selectedScanId || (mode === "pinned" && selectedScanId === pinnedScanId)}
                  onClick={() => update({ mode: "pinned", scanId: selectedScanId })}
                >
                  <Pin data-icon="inline-start" aria-hidden="true" />
                  Save pinned scan
                </Button>
              ) : null}
            </div>
            <FieldDescription>Future scans compare with this scan until an administrator changes it.</FieldDescription>
          </Field>
        ) : null}

        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>

      <div className="mt-auto flex flex-col gap-1.5 pt-5 text-xs leading-5 text-muted-foreground">
        {!canManage ? <p>Only administrators can change monitoring baselines.</p> : null}
        <p>Only future comparisons and alerts are affected. Historical comparisons remain unchanged.</p>
      </div>
    </section>
  )
}
