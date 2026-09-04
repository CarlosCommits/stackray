import { z } from "zod";

import {
  getChangePreview,
  type ChangePreviewItem,
} from "../../changes/change-preview.ts";
import type {
  AlertWebhookChange,
  AlertWebhookPayload,
} from "./webhook-payload.ts";

export const alertEventSummarySchema = z.object({
  headline: z.string(),
  totalChanges: z.number().int().nonnegative(),
  includedChanges: z.number().int().nonnegative(),
  targetId: z.string().nullable(),
  targetLabel: z.string(),
  targetUrl: z.string(),
  comparisonScanId: z.string(),
  baselineScanId: z.string(),
  matchedItemIds: z.array(z.string()).max(1_000),
});

export type AlertEventSummary = z.infer<typeof alertEventSummarySchema>;

export type AlertPayloadChange = ChangePreviewItem & {
  id: string;
  category: string;
  summary: string;
};

function targetUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return `https://${value}`;
  }
}

function comparisonUrl(input: {
  comparisonId: string;
  publicOrigin: string;
  summary: AlertEventSummary;
  changes: readonly AlertPayloadChange[];
}) {
  if (!input.summary.targetId) {
    return new URL(`/scans/${encodeURIComponent(input.summary.comparisonScanId)}`, input.publicOrigin).toString();
  }

  const params = new URLSearchParams({ comparison: input.comparisonId });
  const deliveredChangeIds = new Set(input.changes.map((change) => change.id));
  const firstChangeId = input.summary.matchedItemIds.find((id) => deliveredChangeIds.has(id));

  if (firstChangeId) {
    params.set("item", firstChangeId);
  }

  return new URL(
    `/targets/${encodeURIComponent(input.summary.targetId)}/changes?${params.toString()}`,
    input.publicOrigin,
  ).toString();
}

export function createAlertWebhookPayload(input: {
  eventId: string;
  eventCreatedAt: Date;
  comparisonId: string;
  publicOrigin: string;
  summary: AlertEventSummary;
  changes: readonly AlertPayloadChange[];
}): AlertWebhookPayload {
  const normalizedTargetUrl = targetUrl(input.summary.targetUrl);

  return {
    schemaVersion: 2,
    event: {
      id: input.eventId,
      type: "scan.changes.detected",
      occurredAt: input.eventCreatedAt.toISOString(),
    },
    target: {
      id: input.summary.targetId ?? "unknown-target",
      label: input.summary.targetLabel,
      url: normalizedTargetUrl,
    },
    comparison: {
      id: input.comparisonId,
      currentScanId: input.summary.comparisonScanId,
      baselineScanId: input.summary.baselineScanId,
      url: comparisonUrl(input),
    },
    summary: {
      headline: input.summary.headline,
      totalChanges: input.summary.totalChanges,
      includedChanges: input.summary.includedChanges,
    },
    changes: input.changes.map((change): AlertWebhookChange => {
      const preview = getChangePreview(change, normalizedTargetUrl);

      return {
        id: change.id,
        category: change.category,
        type: change.changeType,
        summary: change.summary,
        ...(preview ? { preview } : {}),
        ...(change.endpointIdentity ? { endpoint: change.endpointIdentity } : {}),
      };
    }),
  };
}
