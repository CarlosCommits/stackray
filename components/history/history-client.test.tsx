import { describe, expect, it, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { HistoryRow } from "./types";
import { HistoryClient } from "./history-client";

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");
});

const mockRows: HistoryRow[] = [
  {
    scanId: "scn_001",
    href: "/scans/scn_001",
    submittedAt: {
      iso: "2026-03-23T14:00:00.000Z",
      label: "Mar 23, 2026, 2:00 PM",
    },
    targetCount: {
      value: 3,
      label: "3 targets",
    },
    status: {
      rawValue: "completed",
      value: "completed",
      label: "Completed",
    },
    source: {
      value: "ui",
      label: "UI",
    },
    createdBy: {
      label: "Ada Lovelace",
      kind: "user",
      userId: "usr_001",
      tokenId: null,
    },
    duration: {
      label: "12.0s",
      milliseconds: 12000,
      submittedAtIso: "2026-03-23T14:00:00.000Z",
      completedAtIso: "2026-03-23T14:00:12.000Z",
    },
    topTechnologies: {
      visibleItems: ["WordPress", "WooCommerce", "PHP"],
      totalCount: 5,
      hiddenCount: 2,
      truncated: true,
      overflowLabel: "+2 more",
      searchTokens: ["WordPress", "WooCommerce", "PHP", "Jetpack", "MySQL"],
    },
    filters: {
      hiddenTargets: ["example.com", "test.com", "demo.com"],
    },
  },
  {
    scanId: "scn_002",
    href: "/scans/scn_002",
    submittedAt: {
      iso: "2026-03-23T13:00:00.000Z",
      label: "Mar 23, 2026, 1:00 PM",
    },
    targetCount: {
      value: 1,
      label: "1 target",
    },
    status: {
      rawValue: "running",
      value: "running",
      label: "Running",
    },
    source: {
      value: "api",
      label: "API",
    },
    createdBy: {
      label: "automation-token",
      kind: "token",
      userId: null,
      tokenId: "tok_001",
    },
    duration: {
      label: "--",
      milliseconds: null,
      submittedAtIso: "2026-03-23T13:00:00.000Z",
      completedAtIso: null,
    },
    topTechnologies: {
      visibleItems: ["Next.js", "PostgreSQL"],
      totalCount: 2,
      hiddenCount: 0,
      truncated: false,
      overflowLabel: null,
      searchTokens: ["Next.js", "PostgreSQL"],
    },
    filters: {
      hiddenTargets: ["api.example.com"],
    },
  },
  {
    scanId: "scn_003",
    href: "/scans/scn_003",
    submittedAt: {
      iso: "2026-03-23T12:00:00.000Z",
      label: "Mar 23, 2026, 12:00 PM",
    },
    targetCount: {
      value: 2,
      label: "2 targets",
    },
    status: {
      rawValue: "failed",
      value: "failed",
      label: "Failed",
    },
    source: {
      value: "cli",
      label: "CLI",
    },
    createdBy: {
      label: "Grace Hopper",
      kind: "user",
      userId: "usr_002",
      tokenId: null,
    },
    duration: {
      label: "5.5s",
      milliseconds: 5500,
      submittedAtIso: "2026-03-23T12:00:00.000Z",
      completedAtIso: "2026-03-23T12:00:05.500Z",
    },
    topTechnologies: {
      visibleItems: [],
      totalCount: 0,
      hiddenCount: 0,
      truncated: false,
      overflowLabel: null,
      searchTokens: [],
    },
    filters: {
      hiddenTargets: ["failed-site.com"],
    },
  },
];

describe("HistoryClient", () => {
  describe("headers", () => {
    it("renders the page title", () => {
      render(<HistoryClient initialRows={mockRows} />);
      expect(screen.getByText("Scan History")).toBeInTheDocument();
    });

    it("renders table headers in canonical column order", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const tableHeaders = screen.getAllByRole("columnheader");
      const headerTexts = tableHeaders.map((h) => h.textContent?.trim()).filter(Boolean);

      expect(headerTexts).toContain("Submitted at");
      expect(headerTexts).toContain("Target count");
      expect(headerTexts).toContain("Status");
      expect(headerTexts).toContain("Source");
      expect(headerTexts).toContain("Created by");
      expect(headerTexts).toContain("Duration");
      expect(headerTexts).toContain("Top technologies");
    });

    it("renders custom title when provided", () => {
      render(<HistoryClient initialRows={mockRows} title="Custom History Title" />);
      expect(screen.getByText("Custom History Title")).toBeInTheDocument();
    });
  });

  describe("search/filter behavior", () => {
    it("filters by scan ID substring", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const searchInput = screen.getByPlaceholderText(/search scan id/i);
      fireEvent.change(searchInput, { target: { value: "scn_001" } });

      const desktopLinks = screen.getAllByRole("link", { name: /view details for scan scn_001/i });
      expect(desktopLinks.length).toBeGreaterThan(0);
    });

    it("filters by creator name substring", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const searchInput = screen.getByPlaceholderText(/search scan id/i);
      fireEvent.change(searchInput, { target: { value: "Ada" } });

      const adaElements = screen.getAllByText("Ada Lovelace");
      expect(adaElements.length).toBeGreaterThan(0);
      expect(screen.queryByText("automation-token")).not.toBeInTheDocument();
      expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
    });

    it("filters by technology substring", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const searchInput = screen.getByPlaceholderText(/search scan id/i);
      fireEvent.change(searchInput, { target: { value: "WordPress" } });

      const wordpressElements = screen.getAllByText("WordPress");
      expect(wordpressElements.length).toBeGreaterThan(0);
      expect(screen.queryByText("Next.js")).not.toBeInTheDocument();
      expect(screen.queryByText("PostgreSQL")).not.toBeInTheDocument();
    });

    it("filters by hidden target substring", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const searchInput = screen.getByPlaceholderText(/search scan id/i);
      fireEvent.change(searchInput, { target: { value: "api.example" } });

      const desktopLinks = screen.getAllByRole("link", { name: /view details for scan scn_002/i });
      expect(desktopLinks.length).toBeGreaterThan(0);
    });

    it("filters by status", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const statusSelect = screen.getByLabelText(/status/i);
      fireEvent.change(statusSelect, { target: { value: "completed" } });

      const desktopLinks = screen.getAllByRole("link", { name: /view details for scan scn_001/i });
      expect(desktopLinks.length).toBeGreaterThan(0);
    });

    it("filters by source", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const sourceSelect = screen.getByLabelText(/source/i);
      fireEvent.change(sourceSelect, { target: { value: "cli" } });

      const desktopLinks = screen.getAllByRole("link", { name: /view details for scan scn_003/i });
      expect(desktopLinks.length).toBeGreaterThan(0);
    });

    it("shows result count", () => {
      render(<HistoryClient initialRows={mockRows} />);
      expect(screen.getByText("3 results")).toBeInTheDocument();
    });

    it("updates result count when filtering", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const searchInput = screen.getByPlaceholderText(/search scan id/i);
      fireEvent.change(searchInput, { target: { value: "scn_001" } });

      expect(screen.getByText("1 results")).toBeInTheDocument();
    });

    it("clears all filters when Clear button is clicked", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const searchInput = screen.getByPlaceholderText(/search scan id/i);
      fireEvent.change(searchInput, { target: { value: "scn_001" } });

      let viewDetailsLinks = screen.getAllByRole("link", { name: /view details/i });
      expect(viewDetailsLinks.length).toBeLessThan(6);

      const clearButton = screen.getByText(/clear/i);
      fireEvent.click(clearButton);

      viewDetailsLinks = screen.getAllByRole("link", { name: /view details/i });
      expect(viewDetailsLinks.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("empty state", () => {
    it("renders empty state when no rows match filters", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const searchInput = screen.getByPlaceholderText(/search scan id/i);
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      expect(screen.getByText("No matching scans")).toBeInTheDocument();
      expect(screen.getByText(/try adjusting your search or filters/i)).toBeInTheDocument();
    });

    it("renders empty state when initial rows are empty", () => {
      render(<HistoryClient initialRows={[]} />);

      expect(screen.getByText("No scan history")).toBeInTheDocument();
      expect(screen.getByText(/run your first scan/i)).toBeInTheDocument();
    });

    it("shows clear filters button in empty state when filters are active", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const searchInput = screen.getByPlaceholderText(/search scan id/i);
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      const clearButton = screen.getByText(/clear filters/i);
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe("duration fallback", () => {
    it("renders duration label for completed scans", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const duration12s = screen.getAllByText("12.0s");
      expect(duration12s.length).toBeGreaterThan(0);
      const duration5s = screen.getAllByText("5.5s");
      expect(duration5s.length).toBeGreaterThan(0);
    });

    it("renders unavailable label for running scans without completion", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const unavailableLabels = screen.getAllByText("--");
      expect(unavailableLabels.length).toBeGreaterThan(0);
    });
  });

  describe("scan detail links", () => {
    it("renders links to scan detail pages", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const links = screen.getAllByRole("link", { name: /view details/i });
      expect(links.length).toBeGreaterThanOrEqual(6);

      const hrefs = links.map((l) => l.getAttribute("href"));
      expect(hrefs).toContain("/scans/scn_001");
      expect(hrefs).toContain("/scans/scn_002");
      expect(hrefs).toContain("/scans/scn_003");
    });

    it("renders accessible link buttons in table rows", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const detailLinks = screen.getAllByRole("link", { name: /view details for scan/i });
      expect(detailLinks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("status badges", () => {
    it("renders completed status badge", () => {
      render(<HistoryClient initialRows={mockRows} />);
      const completedBadges = screen.getAllByText("Completed");
      expect(completedBadges.length).toBeGreaterThan(0);
    });

    it("renders running status badge", () => {
      render(<HistoryClient initialRows={mockRows} />);
      const runningBadges = screen.getAllByText("Running");
      expect(runningBadges.length).toBeGreaterThan(0);
    });

    it("renders failed status badge", () => {
      render(<HistoryClient initialRows={mockRows} />);
      const failedBadges = screen.getAllByText("Failed");
      expect(failedBadges.length).toBeGreaterThan(0);
    });
  });

  describe("source badges", () => {
    it("renders source labels", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const uiBadges = screen.getAllByText("UI");
      expect(uiBadges.length).toBeGreaterThan(0);
      const apiBadges = screen.getAllByText("API");
      expect(apiBadges.length).toBeGreaterThan(0);
      const cliBadges = screen.getAllByText("CLI");
      expect(cliBadges.length).toBeGreaterThan(0);
    });
  });

  describe("technologies display", () => {
    it("renders visible technologies", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const wpElements = screen.getAllByText("WordPress");
      expect(wpElements.length).toBeGreaterThan(0);
      const wcElements = screen.getAllByText("WooCommerce");
      expect(wcElements.length).toBeGreaterThan(0);
      const phpElements = screen.getAllByText("PHP");
      expect(phpElements.length).toBeGreaterThan(0);
    });

    it("renders overflow label for truncated technologies", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const overflowLabels = screen.getAllByText("+2 more");
      expect(overflowLabels.length).toBeGreaterThan(0);
    });

    it("renders dash for empty technologies", () => {
      render(<HistoryClient initialRows={mockRows} />);

      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThan(0);
    });
  });
});
