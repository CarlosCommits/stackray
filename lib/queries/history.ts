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
import type { ScanListItem } from "@/lib/contracts/scans";
import {
  getMockScanListEnrichment,
  mockScanList,
  type MockScanListEnrichment,
} from "@/lib/mocks/scans";

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
  const rows = buildHistoryRows(mockScanList.items, getMockScanListEnrichment);

  return {
    rows,
  };
}
