import { describe, expect, it } from "vitest";

import { mockScanDetail, mockScanEvents, mockScanList, mockScanResults, mockSearchResults } from "@/lib/mocks/scans";

describe("scan mocks", () => {
  it("provides list items for history surfaces", () => {
    expect(mockScanList.items.length).toBeGreaterThan(0);
    expect(mockScanList.items[0]?.scanId).toMatch(/^scn_/);
  });

  it("provides scan detail with at least one target", () => {
    expect(mockScanDetail.targets.length).toBeGreaterThan(0);
    expect(mockScanDetail.progress.totalTargets).toBeGreaterThan(0);
  });

  it("provides results and search rows for UI composition", () => {
    expect(mockScanResults.items.length).toBeGreaterThan(0);
    expect(mockSearchResults.items.length).toBeGreaterThan(0);
  });

  it("provides a valid event sequence", () => {
    expect(mockScanEvents[0]?.event).toBe("scan.status");
    expect(mockScanEvents.at(-1)?.event).toBe("scan.complete");
  });
});
