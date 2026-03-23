import { mockSavedSearches, mockScanList, mockSearchResults } from "@/lib/mocks/scans";

export async function getDashboardSnapshot() {
  return {
    savedSearches: mockSavedSearches,
    recentScans: mockScanList.items,
    spotlightResults: mockSearchResults.items.slice(0, 3),
    stats: [
      { label: "Aggregate Scans", value: "12,842", delta: "+12.4%" },
      { label: "Targets Identified", value: "4,910", delta: "24h" },
      { label: "Technology Index", value: "842", delta: "Latest: Astro v4.5.1" },
      { label: "API Latency", value: "12ms", delta: "99.9% stable" },
    ],
  };
}
