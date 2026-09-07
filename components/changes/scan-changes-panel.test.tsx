import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ScanChangesPanel } from "@/components/changes/scan-changes-panel";
import type { ScanComparisonResponse } from "@/lib/contracts/changes";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/scans/scan-current",
  useRouter: () => ({
    push: navigationMocks.push,
    refresh: navigationMocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams("section=changes"),
}));

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");
});

beforeEach(() => {
  navigationMocks.push.mockReset();
  navigationMocks.refresh.mockReset();
});

describe("ScanChangesPanel", () => {
  it("distinguishes a newly established baseline from an unchanged comparison", () => {
    render(
      <ScanChangesPanel
        currentScanId="scan-current"
        canonicalTargetId="target-1"
        response={{
          comparison: null,
          baselineOptions: [],
          state: "baseline_established",
          canManageBaseline: false,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Changes since baseline" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Baseline established" })).toBeVisible();
    expect(screen.queryByText("No changes detected")).not.toBeInTheDocument();
  });

  it("renders persisted evidence and navigates to an ad hoc baseline", () => {
    const response: ScanComparisonResponse = {
      comparison: {
        id: "comparison-1",
        status: "completed",
        algorithmVersion: 1,
        currentScan: {
          id: "scan-current",
          target: "https://example.test",
          completedAt: "2026-07-17T15:00:00.000Z",
          faviconUrl: null,
        },
        baselineScan: {
          id: "scan-baseline-1",
          target: "https://example.test",
          completedAt: "2026-07-16T15:00:00.000Z",
        },
        baselineMode: "previous",
        counts: {
          total: 1,
          alertEligible: 0,
        },
        items: [{
          id: "change-1",
          category: "content",
          changeType: "body_fingerprint.changed",
          fieldPath: "body_fingerprint.changed",
          summary: "Exact response body changed",
          endpointIdentity: "https://example.test:443/",
          before: "old-sha256",
          after: "new-sha256",
          alertEligible: false,
        }],
        errorMessage: null,
        createdAt: "2026-07-17T15:00:01.000Z",
      },
      baselineOptions: [
        {
          id: "scan-baseline-1",
          target: "https://example.test",
          completedAt: "2026-07-16T15:00:00.000Z",
          selected: true,
          pinned: false,
        },
        {
          id: "scan-baseline-2",
          target: "https://example.test",
          completedAt: "2026-07-15T15:00:00.000Z",
          selected: false,
          pinned: false,
        },
      ],
      state: "ready",
      canManageBaseline: false,
    };

    render(
      <ScanChangesPanel
        currentScanId="scan-current"
        canonicalTargetId="target-1"
        response={response}
      />,
    );

    expect(screen.getByText("Response body changed")).toBeVisible();
    expect(screen.getByText("old-sha256")).toBeVisible();
    expect(screen.getByText("new-sha256")).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "Compare against" }), {
      target: { value: "scan-baseline-2" },
    });

    expect(navigationMocks.push).toHaveBeenCalledWith(
      "/scans/scan-current?section=changes&baseline=scan-baseline-2",
    );
  });
});
