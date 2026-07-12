import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboardSnapshot } from "@/lib/queries/dashboard";
import {
  getScanDetailPageData,
  SCAN_DETAIL_INITIAL_SUBDOMAIN_PAGE_SIZE,
} from "@/lib/queries/scan-detail";
import { getTargetsPageData } from "@/lib/queries/targets";

const mocks = vi.hoisted(() => ({
  requireAppSession: vi.fn(),
  getDashboardRecentScansPage: vi.fn(),
  getDashboardStats: vi.fn(),
  getLatestScanEventId: vi.fn(),
  getScanRecord: vi.fn(),
  getScanDetail: vi.fn(),
  getAuthoritativeScanResult: vi.fn(),
  getTargetHistoryForScan: vi.fn(),
  getScanSubdomains: vi.fn(),
  getTargetResults: vi.fn(),
  getTargetFilterOptions: vi.fn(),
}));

vi.mock("@/lib/session/app-session", () => ({
  requireAppSession: mocks.requireAppSession,
}));

vi.mock("@/lib/server/scans/events-service", () => ({
  getLatestScanEventId: mocks.getLatestScanEventId,
}));

vi.mock("@/lib/server/scans/read-service", () => ({
  getDashboardRecentScansPage: mocks.getDashboardRecentScansPage,
  getDashboardStats: mocks.getDashboardStats,
  getScanRecord: mocks.getScanRecord,
  getScanDetail: mocks.getScanDetail,
  getAuthoritativeScanResult: mocks.getAuthoritativeScanResult,
  getTargetHistoryForScan: mocks.getTargetHistoryForScan,
  getScanSubdomains: mocks.getScanSubdomains,
}));

vi.mock("@/lib/server/targets/service", () => ({
  getTargetResults: mocks.getTargetResults,
  getTargetFilterOptions: mocks.getTargetFilterOptions,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

const actor = {
  user: {
    id: "user_performance",
    email: "performance@stackray.test",
    displayName: "Performance",
    image: null,
    role: "admin",
  },
  apiKeyAccessEnabled: true,
  requiresPasswordChange: false,
  source: "ui",
  apiKey: null,
} as const;

describe("server loader performance contracts", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.requireAppSession.mockResolvedValue(actor);
  });

  it("starts both bounded dashboard reads before either one resolves", async () => {
    const recentScans = createDeferred<{ items: []; nextCursor: string | null }>();
    const stats = createDeferred<[]>();
    mocks.getDashboardRecentScansPage.mockReturnValue(recentScans.promise);
    mocks.getDashboardStats.mockReturnValue(stats.promise);

    const resultPromise = getDashboardSnapshot();

    await vi.waitFor(() => {
      expect(mocks.getDashboardRecentScansPage).toHaveBeenCalledWith(actor, { limit: 16 });
      expect(mocks.getDashboardStats).toHaveBeenCalledWith(actor);
    });

    recentScans.resolve({ items: [], nextCursor: null });
    stats.resolve([]);

    await expect(resultPromise).resolves.toEqual({
      recentScans: [],
      recentScansNextCursor: null,
      stats: [],
    });
  });

  it("starts the six scan-detail reads together and preserves their query budget", async () => {
    const reads = [
      createDeferred<null>(),
      createDeferred<null>(),
      createDeferred<null>(),
      createDeferred<null>(),
      createDeferred<null>(),
      createDeferred<null>(),
    ];
    const readMocks = [
      mocks.getLatestScanEventId,
      mocks.getScanRecord,
      mocks.getScanDetail,
      mocks.getAuthoritativeScanResult,
      mocks.getTargetHistoryForScan,
      mocks.getScanSubdomains,
    ];

    readMocks.forEach((mock, index) => {
      mock.mockReturnValue(reads[index]!.promise);
    });

    const resultPromise = getScanDetailPageData(actor, "scan_performance");

    expect(mocks.getLatestScanEventId).toHaveBeenCalledWith(actor, "scan_performance");
    expect(mocks.getScanRecord).toHaveBeenCalledWith(actor, "scan_performance");
    expect(mocks.getScanDetail).toHaveBeenCalledWith(actor, "scan_performance");
    expect(mocks.getAuthoritativeScanResult).toHaveBeenCalledWith(actor, "scan_performance");
    expect(mocks.getTargetHistoryForScan).toHaveBeenCalledWith(actor, "scan_performance");
    expect(mocks.getScanSubdomains).toHaveBeenCalledWith(actor, "scan_performance", {
      pageSize: SCAN_DETAIL_INITIAL_SUBDOMAIN_PAGE_SIZE,
    });
    expect(readMocks.every((mock) => mock.mock.calls.length === 1)).toBe(true);

    reads.forEach((read) => read.resolve(null));

    await expect(resultPromise).resolves.toEqual({
      latestEventId: null,
      scanRecord: null,
      scanDetail: null,
      primaryResult: null,
      targetHistory: null,
      subdomains: null,
    });
  });

  it("keeps target filter inventory off the initial route request", async () => {
    const searchParams = new URLSearchParams("limit=16");
    mocks.getTargetResults.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const result = await getTargetsPageData(searchParams);

    expect(mocks.getTargetResults).toHaveBeenCalledOnce();
    expect(mocks.getTargetResults).toHaveBeenCalledWith(actor, searchParams);
    expect(mocks.getTargetFilterOptions).not.toHaveBeenCalled();
    expect(result.filterOptionsLoaded).toBe(false);
  });
});
