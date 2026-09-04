import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { ChangeInspector } from "@/components/changes/change-inspector";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ScanComparison } from "@/lib/contracts/changes";

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");
});

const comparison: ScanComparison = {
  id: "comparison-1",
  status: "completed",
  algorithmVersion: 1,
  currentScan: {
    id: "scan-current",
    target: "https://example.test",
    completedAt: "2026-07-18T15:00:00.000Z",
    faviconUrl: null,
  },
  baselineScan: {
    id: "scan-baseline",
    target: "https://example.test",
    completedAt: "2026-07-17T15:00:00.000Z",
  },
  baselineMode: "previous",
  counts: {
    total: 3,
    alertEligible: 3,
  },
  items: [
    {
      id: "status-change",
      category: "availability",
      changeType: "status.changed",
      fieldPath: "status.changed",
      summary: "HTTP status changed from 200 to 503",
      endpointIdentity: "https://example.test:443/",
      before: 200,
      after: 503,
      alertEligible: true,
    },
    {
      id: "header-change",
      category: "content",
      changeType: "response_headers.changed",
      fieldPath: "response_headers.changed",
      summary: "Response headers changed",
      endpointIdentity: "https://example.test:443/",
      before: {
        strictFingerprint: "old",
        names: ["etag"],
        valuesByName: { etag: 'W/"before"' },
        mode: "semantic",
      },
      after: {
        strictFingerprint: "new",
        names: ["etag", "cache-control"],
        valuesByName: { etag: 'W/"after"', "cache-control": "public, max-age=60" },
        mode: "semantic",
        added: ["cache-control"],
        removed: [],
        changed: ["etag"],
      },
      alertEligible: true,
    },
    {
      id: "dns-change",
      category: "infrastructure",
      changeType: "dns.a_changed",
      fieldPath: "dns.a_changed",
      summary: "IPv4 DNS records changed",
      endpointIdentity: "https://example.test:443/",
      before: { removed: ["192.0.2.1"] },
      after: { added: ["192.0.2.2"] },
      alertEligible: true,
    },
  ],
  errorMessage: null,
  createdAt: "2026-07-18T15:00:01.000Z",
};

describe("ChangeInspector", () => {
  it("opens the requested change without category navigation", () => {
    render(
      <TooltipProvider>
        <ChangeInspector comparison={comparison} initialItemId="header-change" />
      </TooltipProvider>,
    );

    expect(screen.queryByRole("heading", { name: "Availability" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Content" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Response headers changed" })).toBeVisible();
    expect(screen.getByText("Stored response-header values differ from the baseline. Only meaningful policy changes trigger alerts.")).toBeVisible();
    expect(screen.getByText("2 of 3")).toBeVisible();
    expect(screen.queryByText(/Compared with/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open scan details" })).not.toBeInTheDocument();
  });

  it("moves through changes with the inspector navigation controls", () => {
    render(
      <TooltipProvider>
        <ChangeInspector comparison={comparison} />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: "Previous change" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next change" }));

    expect(screen.getByRole("heading", { name: "Response headers changed" })).toBeVisible();
    expect(screen.getByText("2 of 3")).toBeVisible();
  });

  it("uses added and removed counts as the set-change subtitle", () => {
    render(
      <TooltipProvider>
        <ChangeInspector comparison={comparison} initialItemId="dns-change" />
      </TooltipProvider>,
    );

    expect(screen.getByText("1 added · 1 removed")).toBeVisible();
    expect(screen.queryByText(/Added 192\.0\.2\.2/)).not.toBeInTheDocument();
  });

  it.each([
    ["technology.changed", "Detected technologies changed"],
    ["cpe.changed", "Detected CPE identifiers changed"],
  ] as const)("uses count subtitles for %s", (changeType, summary) => {
    const setComparison: ScanComparison = {
      ...comparison,
      counts: { total: 1, alertEligible: 1 },
      items: [{
        id: "set-change",
        category: "technology",
        changeType,
        fieldPath: changeType,
        summary,
        endpointIdentity: "https://example.test:443/",
        before: { removed: ["old-value"] },
        after: { added: ["new-value", "another-value"] },
        alertEligible: true,
      }],
    };

    render(
      <TooltipProvider>
        <ChangeInspector comparison={setComparison} />
      </TooltipProvider>,
    );

    expect(screen.getByText("2 added · 1 removed")).toBeVisible();
  });

  it("renders a large standalone header icon without an icon surface", () => {
    const { container } = render(<ChangeInspector comparison={comparison} />);
    const icon = container.querySelector("header svg");

    expect(icon).toHaveClass("size-11", "sm:size-14");
    expect(icon?.parentElement).toHaveClass("flex");
    expect(icon?.parentElement).not.toHaveClass("rounded-lg");
    expect(screen.getByRole("heading", { name: "HTTP status changed" })).toHaveClass("focus-visible:ring-2");
  });
});
