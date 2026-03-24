import { desc, eq, inArray } from "drizzle-orm";

import type { HistoryRow } from "@/components/history/types";
import {
  HISTORY_UNAVAILABLE_LABEL,
  deriveHistoryDuration,
  formatHistoryTargetCount,
  getHistoryScanDetailHref,
  getHistorySourceLabel,
  getHistoryStatusLabel,
  normalizeHistoryStatus,
  summarizeHistoryTopTechnologies,
} from "@/components/history/types";
import { requireAppSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { apiTokens, scanTargets, scans, users } from "@/lib/db/schema";
import type { ScanListItem } from "@/lib/contracts/scans";
import type { MockScanListEnrichment } from "@/lib/mocks/scans";
import { listWorkspaceCompletedResultSnapshots } from "@/lib/server/scans/read-service";

const HISTORY_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export interface HistoryPageData {
  rows: HistoryRow[];
}

function formatHistorySubmittedAtLabel(submittedAtIso: string): string {
  const submittedAt = new Date(submittedAtIso);

  if (Number.isNaN(submittedAt.getTime())) {
    return HISTORY_UNAVAILABLE_LABEL;
  }

  const month = HISTORY_MONTH_LABELS[submittedAt.getUTCMonth()];
  const day = submittedAt.getUTCDate();
  const year = submittedAt.getUTCFullYear();
  const hours = submittedAt.getUTCHours();
  const minutes = submittedAt.getUTCMinutes().toString().padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;

  return `${month} ${day}, ${year}, ${twelveHour}:${minutes} ${meridiem}`;
}

function cloneHistoryCreatedBy(createdBy: MockScanListEnrichment["createdBy"]): HistoryRow["createdBy"] {
  return { ...createdBy };
}

function cloneOrderedValues(values: readonly string[]): string[] {
  return [...values];
}

export function buildHistoryRow(scan: ScanListItem, enrichment: MockScanListEnrichment): HistoryRow {
  const normalizedStatus = normalizeHistoryStatus(scan.status);

  return {
    scanId: scan.scanId,
    href: getHistoryScanDetailHref(scan.scanId),
    submittedAt: {
      iso: scan.submittedAt,
      label: formatHistorySubmittedAtLabel(scan.submittedAt),
    },
    targetCount: {
      value: scan.targetCount,
      label: formatHistoryTargetCount(scan.targetCount),
    },
    status: {
      rawValue: scan.status,
      value: normalizedStatus,
      label: getHistoryStatusLabel(normalizedStatus),
    },
    source: {
      value: scan.source,
      label: getHistorySourceLabel(scan.source),
    },
    createdBy: cloneHistoryCreatedBy(enrichment.createdBy),
    duration: deriveHistoryDuration(scan.submittedAt, scan.completedAt),
    topTechnologies: summarizeHistoryTopTechnologies(cloneOrderedValues(enrichment.topTechnologies)),
    filters: {
      profile: scan.profile,
      hiddenTargets: cloneOrderedValues(enrichment.hiddenTargets),
    },
  };
}

export function buildHistoryRows(
  scans: readonly ScanListItem[],
  getEnrichment: (scanId: string) => MockScanListEnrichment,
): HistoryRow[] {
  return scans.map((scan) => buildHistoryRow(scan, getEnrichment(scan.scanId)));
}

export async function getHistoryPageData(): Promise<HistoryPageData> {
  const session = await requireAppSession();
  const [scanRows, targetRows, resultSnapshots] = await Promise.all([
    db
      .select()
      .from(scans)
      .where(eq(scans.workspaceId, session.workspace.id))
      .orderBy(desc(scans.submittedAt)),
    db
      .select()
      .from(scanTargets)
      .where(
        inArray(
          scanTargets.scanId,
          db
            .select({ id: scans.id })
            .from(scans)
            .where(eq(scans.workspaceId, session.workspace.id)),
        ),
      ),
    listWorkspaceCompletedResultSnapshots(session),
  ]);

  const userIds = [...new Set(scanRows.map((scan) => scan.createdByUserId).filter((value): value is string => Boolean(value)))];
  const tokenIds = [...new Set(scanRows.map((scan) => scan.createdByTokenId).filter((value): value is string => Boolean(value)))];
  const [userRows, tokenRows] = await Promise.all([
    userIds.length > 0 ? db.select().from(users).where(inArray(users.id, userIds)) : Promise.resolve([]),
    tokenIds.length > 0 ? db.select().from(apiTokens).where(inArray(apiTokens.id, tokenIds)) : Promise.resolve([]),
  ]);

  const userById = new Map(userRows.map((user) => [user.id, user]));
  const tokenById = new Map(tokenRows.map((token) => [token.id, token]));
  const targetsByScanId = new Map<string, string[]>();
  const technologiesByScanId = new Map<string, string[]>();

  for (const target of targetRows) {
    const existingTargets = targetsByScanId.get(target.scanId) ?? [];
    existingTargets.push(target.normalizedTarget);
    targetsByScanId.set(target.scanId, existingTargets);
  }

  for (const snapshot of resultSnapshots) {
    const existingTechnologies = technologiesByScanId.get(snapshot.scanId) ?? [];

    for (const technology of snapshot.technologies) {
      if (!existingTechnologies.includes(technology)) {
        existingTechnologies.push(technology);
      }
    }

    technologiesByScanId.set(snapshot.scanId, existingTechnologies);
  }

  const enrichments = new Map<string, MockScanListEnrichment>(
    scanRows.map((scan) => {
      const user = scan.createdByUserId ? userById.get(scan.createdByUserId) : null;
      const token = scan.createdByTokenId ? tokenById.get(scan.createdByTokenId) : null;
      return [
        scan.id,
        {
          createdBy: user
            ? {
                label: user.displayName ?? user.email,
                kind: "user" as const,
                userId: user.id,
                tokenId: null,
              }
            : token
              ? {
                  label: token.name,
                  kind: "token" as const,
                  userId: null,
                  tokenId: token.id,
                }
              : {
                  label: "Unknown actor",
                  kind: "unknown" as const,
                  userId: null,
                  tokenId: null,
                },
          hiddenTargets: targetsByScanId.get(scan.id) ?? [],
          topTechnologies: technologiesByScanId.get(scan.id) ?? [],
        } satisfies MockScanListEnrichment,
      ];
    }),
  );

  const rows = buildHistoryRows(
    scanRows.map((scan) => ({
      scanId: scan.id,
      status: scan.status,
      profile: scan.profile as ScanListItem["profile"],
      source: scan.source,
      targetCount: scan.targetCount,
      submittedAt: scan.submittedAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
    })),
    (scanId) => enrichments.get(scanId) ?? {
      createdBy: {
        label: "Unknown actor",
        kind: "unknown",
        userId: null,
        tokenId: null,
      },
      hiddenTargets: [],
      topTechnologies: [],
    },
  );

  return {
    rows,
  };
}
