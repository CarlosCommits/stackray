import { AlertCircle, GitCompareArrows, History } from "lucide-react";

import { BaselineControls } from "@/components/changes/baseline-controls";
import { ChangeComparisonCard } from "@/components/changes/change-summary";
import { Card, CardContent } from "@/components/ui/card";
import type { ScanComparisonResponse } from "@/lib/contracts/changes";

export function ScanChangesPanel({
  currentScanId,
  canonicalTargetId,
  response,
}: {
  currentScanId: string;
  canonicalTargetId: string | null;
  response: ScanComparisonResponse;
}) {
  return (
    <section className="space-y-4" aria-labelledby="scan-changes-heading">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Monitoring</p>
        <h2 id="scan-changes-heading" className="mt-1 font-heading text-xl font-semibold text-[var(--foreground)]">
          Changes since baseline
        </h2>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          Structured differences from persisted scan evidence, including body, headers, favicon, infrastructure, TLS, and technologies.
        </p>
      </div>

      <BaselineControls
        canonicalTargetId={canonicalTargetId}
        currentScanId={currentScanId}
        options={response.baselineOptions}
        canManageBaseline={response.canManageBaseline}
      />

      {response.comparison ? <ChangeComparisonCard comparison={response.comparison} expanded /> : null}

      {!response.comparison && response.state === "baseline_established" ? (
        <EmptyState
          icon={History}
          title="Baseline established"
          description="Run this target again with the same scan settings to see what changed."
        />
      ) : null}
      {!response.comparison && response.state === "pending" ? (
        <EmptyState
          icon={GitCompareArrows}
          title="Change analysis pending"
          description="The scan is complete. Stackray is still preparing its persisted comparison."
        />
      ) : null}
      {!response.comparison && (response.state === "failed" || response.state === "incompatible") ? (
        <EmptyState
          icon={AlertCircle}
          title={response.state === "failed" ? "Change analysis unavailable" : "No earlier baseline"}
          description={response.state === "failed"
            ? "The scan results remain available, but Stackray could not prepare this comparison. An admin can retry the analysis."
            : "Earlier scans used materially different settings, so their evidence is not compared automatically."}
        />
      ) : null}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof History;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardContent className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
        <Icon className="size-9 text-orange-300" aria-hidden="true" />
        <h3 className="mt-4 font-heading text-base font-semibold text-[var(--foreground)]">{title}</h3>
        <p className="mt-2 max-w-xl text-sm text-[var(--text-dim)]">{description}</p>
      </CardContent>
    </Card>
  );
}
