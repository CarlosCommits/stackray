"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pin, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ScanComparisonResponse } from "@/lib/contracts/changes";
import { formatUtcInstant } from "@/lib/time";

type BaselineOption = ScanComparisonResponse["baselineOptions"][number];

export function BaselineControls({
  canonicalTargetId,
  currentScanId,
  options,
  canManageBaseline,
}: {
  canonicalTargetId: string | null;
  currentScanId: string;
  options: BaselineOption[];
  canManageBaseline: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOption = options.find((option) => option.selected) ?? options[0] ?? null;
  const requestedBaselineScanId = searchParams.get("baseline");
  const selectedScanId = requestedBaselineScanId && options.some((option) => option.id === requestedBaselineScanId)
    ? requestedBaselineScanId
    : selectedOption?.id ?? "";
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function compareAgainst(scanId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "changes");
    params.set("baseline", scanId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function updateMonitoringBaseline(payload: { mode: "previous" } | { mode: "pinned"; scanId: string }) {
    if (!canonicalTargetId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/targets/${canonicalTargetId}/monitoring-baseline`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          setError(body?.error?.message ?? "Unable to update the monitoring baseline.");
          return;
        }

        router.refresh();
      } catch {
        setError("Unable to reach Stackray. Check your connection and try again.");
      }
    });
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)]/45 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
          Compare against
          <select
            value={selectedScanId}
            onChange={(event) => compareAgainst(event.target.value)}
            className="mt-2 h-9 w-full rounded-md border border-[var(--gray-border)] bg-[var(--surface-dark)] px-3 font-mono text-sm font-normal normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {formatUtcInstant(option.completedAt, "fullDateTimeWithZone", "Completion time unavailable")}
                {option.pinned ? " · pinned" : ""}
              </option>
            ))}
          </select>
        </label>

        {canManageBaseline && canonicalTargetId ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !selectedScanId || selectedScanId === currentScanId}
              onClick={() => updateMonitoringBaseline({ mode: "pinned", scanId: selectedScanId })}
            >
              <Pin aria-hidden="true" />
              Use as monitoring baseline
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => updateMonitoringBaseline({ mode: "previous" })}
            >
              <RotateCcw aria-hidden="true" />
              Use previous scan
            </Button>
          </>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-300" role="alert">{error}</p> : null}
      {canManageBaseline ? (
        <p className="mt-3 text-xs text-[var(--text-dim)]">
          Changing the monitoring baseline affects future comparisons and alerts. Historical comparisons stay unchanged.
        </p>
      ) : null}
    </div>
  );
}
