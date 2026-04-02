import { describe, expect, it } from "vitest";

import type { HistoryRow } from "@/components/history/types";
import {
  HISTORY_COLUMNS,
  HISTORY_SOURCE_LABELS,
  HISTORY_STATUS_NORMALIZATION,
  getHistorySourceLabel,
  getHistoryStatusLabel,
  normalizeHistoryStatus,
} from "@/components/history/types";
import { getMockScanListEnrichment, mockScanList } from "@/lib/mocks/scans";
import { buildHistoryRow, buildHistoryRows } from "@/lib/queries/history";

describe("/history row contract", () => {
  it("locks the canonical column order from docs/pages.md", () => {
    expect(HISTORY_COLUMNS).toEqual([
      { key: "submittedAt", label: "Submitted at" },
      { key: "targetCount", label: "Target count" },
      { key: "status", label: "Status" },
      { key: "source", label: "Source" },
      { key: "createdBy", label: "Created by" },
      { key: "duration", label: "Duration" },
      { key: "topTechnologies", label: "Top technologies" },
    ]);
  });

  it("locks source labels and status normalization for display badges", () => {
    expect(HISTORY_STATUS_NORMALIZATION).toEqual({
      pending: "queued",
      queued: "queued",
      running: "running",
      processing: "running",
      completed: "completed",
      failed: "failed",
      cancelled: "cancelled",
    });

    expect(normalizeHistoryStatus("pending")).toBe("queued");
    expect(normalizeHistoryStatus("queued")).toBe("queued");
    expect(normalizeHistoryStatus("processing")).toBe("running");
    expect(normalizeHistoryStatus("completed")).toBe("completed");
    expect(getHistoryStatusLabel("running")).toBe("Running");
    expect(getHistoryStatusLabel("failed")).toBe("Failed");

    expect(HISTORY_SOURCE_LABELS).toEqual({
      ui: "UI",
      cli: "CLI",
      api: "API",
      system: "System",
    });
    expect(getHistorySourceLabel("ui")).toBe("UI");
    expect(getHistorySourceLabel("cli")).toBe("CLI");
    expect(getHistorySourceLabel("api")).toBe("API");
  });

  it("builds a completed row with derived duration, href, creator metadata, and hidden target tokens", () => {
    const completedScan = mockScanList.items[0];

    expect(completedScan).toBeDefined();

    const completedRow: HistoryRow = buildHistoryRow(
      completedScan!,
      getMockScanListEnrichment(completedScan!.scanId),
    );

    expect(completedRow.href).toBe(`/scans/${completedScan!.scanId}`);
    expect(completedRow.submittedAt).toEqual({
      iso: completedScan!.submittedAt,
      label: "Mar 23, 2026, 4:00 PM",
    });
    expect(completedRow.targetCount).toEqual({
      value: 1,
      label: "1 target",
    });
    expect(completedRow.status).toEqual({
      rawValue: "completed",
      value: "completed",
      label: "Completed",
    });
    expect(completedRow.source).toEqual({
      value: "ui",
      label: "UI",
    });
    expect(completedRow.createdBy).toEqual({
      label: "Ada Lovelace",
      kind: "user",
      userId: "usr_01_demo_ada",
      tokenId: null,
    });
    expect(completedRow.duration).toEqual({
      label: "12.0s",
      milliseconds: 12_000,
      submittedAtIso: completedScan!.submittedAt,
      completedAtIso: completedScan!.completedAt,
    });
    expect(completedRow.topTechnologies).toEqual({
      visibleItems: ["WordPress", "WooCommerce", "PHP"],
      totalCount: 6,
      hiddenCount: 3,
      truncated: true,
      overflowLabel: "+3 more",
      searchTokens: ["WordPress", "WooCommerce", "PHP", "Jetpack", "MySQL", "Nginx"],
    });
    expect(completedRow.filters).toEqual({
      hiddenTargets: ["https://primary.example.test", "primary.example.test"],
    });
  });

  it("builds an in-flight row with an unavailable duration and non-truncated technologies", () => {
    const runningScan = mockScanList.items[1];

    expect(runningScan).toBeDefined();

    const runningRow: HistoryRow = buildHistoryRow(
      runningScan!,
      getMockScanListEnrichment(runningScan!.scanId),
    );

    expect(runningRow.status).toEqual({
      rawValue: "running",
      value: "running",
      label: "Running",
    });
    expect(runningRow.duration).toEqual({
      label: "--",
      milliseconds: null,
      submittedAtIso: runningScan!.submittedAt,
      completedAtIso: null,
    });
    expect(runningRow.topTechnologies).toEqual({
      visibleItems: ["Next.js", "PostgreSQL"],
      totalCount: 2,
      hiddenCount: 0,
      truncated: false,
      overflowLabel: null,
      searchTokens: ["Next.js", "PostgreSQL"],
    });
    expect(runningRow.filters.hiddenTargets).toEqual([
      "https://queue.example.com",
      "queue.example.com",
    ]);
  });

  it("builds page-facing rows for history consumers", () => {
    const rows = buildHistoryRows(mockScanList.items, getMockScanListEnrichment);

    expect(rows.map((row) => row.scanId)).toEqual(mockScanList.items.map((item) => item.scanId));
  });
});
