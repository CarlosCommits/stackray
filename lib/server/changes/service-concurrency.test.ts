import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collectChangedIpRecordAddresses: vi.fn(),
  compareScanResults: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
    transaction: mocks.transaction,
    update: mocks.update,
  },
}));

vi.mock("./compare-scan-results.ts", () => ({
  collectChangedIpRecordAddresses: mocks.collectChangedIpRecordAddresses,
  compareScanResults: mocks.compareScanResults,
  SCAN_COMPARISON_ALGORITHM_VERSION: "7",
}));

import { computeScanChanges } from "./service.ts";

type QueryResult<T> = T | (() => T);

function createQueryChain<T>(result: QueryResult<T>) {
  const resolveResult = () => typeof result === "function" ? (result as () => T)() : result;
  const chain = {
    for: vi.fn(() => chain),
    from: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    where: vi.fn(() => chain),
    then: <TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(resolveResult()).then(onfulfilled, onrejected),
  };

  return chain;
}

describe("computeScanChanges concurrency", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
  });

  it("keeps the first completed canonical comparison after baseline settings change", async () => {
    const currentScan = {
      id: "scan_current",
      canonicalTargetId: "target_01",
      completedAt: new Date("2026-09-04T12:00:00.000Z"),
      normalizedTarget: "example.com",
      status: "completed",
    };
    const canonicalComparison = {
      id: "comparison_original",
      baselineMode: "previous",
      baselineScanId: "scan_previous",
    };
    const selectResults = [[currentScan], [canonicalComparison]];
    mocks.select.mockImplementation(() => createQueryChain(selectResults.shift() ?? []));

    await expect(computeScanChanges(currentScan.id)).resolves.toBe(canonicalComparison.id);

    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.compareScanResults).not.toHaveBeenCalled();
  });

  it("uses the baseline setting that was active when the scan completed", async () => {
    const currentScan = {
      id: "scan_current",
      canonicalTargetId: "target_01",
      completedAt: new Date("2026-09-04T12:00:00.000Z"),
      normalizedTarget: "example.com",
      status: "completed",
    };
    const previousScan = {
      ...currentScan,
      id: "scan_previous",
      completedAt: new Date("2026-09-04T11:30:00.000Z"),
    };
    const pinnedScan = {
      ...currentScan,
      id: "scan_pinned",
      completedAt: new Date("2026-09-04T10:00:00.000Z"),
    };
    const selectResults = [
      [currentScan],
      [],
      [previousScan, pinnedScan],
      [{ baselineMode: "previous", pinnedBaselineScanId: null, updatedAt: new Date("2026-09-04T13:00:00.000Z") }],
      [{ previousMode: "pinned", previousPinnedScanId: pinnedScan.id }],
      [pinnedScan],
      [],
      [{ id: "attempt_pinned" }],
      [{ id: "attempt_current" }],
      [],
      [],
    ];
    mocks.select.mockImplementation(() => createQueryChain(selectResults.shift() ?? []));
    const comparison = { id: "comparison_historical", status: "pending", baselineMode: "pinned" };
    let comparisonValues: Record<string, unknown> | undefined;
    mocks.insert.mockImplementation(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        comparisonValues = values;
        return {
          onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([comparison]) })),
        };
      }),
    }));
    mocks.collectChangedIpRecordAddresses.mockReturnValue([]);
    mocks.compareScanResults.mockReturnValue({
      algorithmVersion: "7",
      comparedEndpointCount: 0,
      items: [],
      omittedChangeCount: 0,
      skippedResultCount: 0,
      totalChangeCount: 0,
      truncated: false,
    });
    const tx = {
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      insert: vi.fn(),
      select: vi.fn(() => createQueryChain([{ status: "pending" }])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(computeScanChanges(currentScan.id)).resolves.toBe(comparison.id);

    expect(comparisonValues).toMatchObject({
      baselineScanId: pinnedScan.id,
      baselineMode: "pinned",
    });
  });

  it("lets only the first concurrent writer replace comparison items", async () => {
    const completedAt = new Date("2026-09-04T12:00:00.000Z");
    const baselineCompletedAt = new Date("2026-09-04T11:00:00.000Z");
    const currentScan = {
      id: "scan_current",
      canonicalTargetId: "target_01",
      completedAt,
      normalizedTarget: "example.com",
      status: "completed",
    };
    const baselineScan = {
      ...currentScan,
      id: "scan_baseline",
      completedAt: baselineCompletedAt,
    };
    const comparison = {
      id: "comparison_01",
      baselineMode: "previous",
      status: "pending",
    };
    const selectResults = [
      [currentScan],
      [currentScan],
      [],
      [],
      [baselineScan],
      [baselineScan],
      [],
      [],
      [],
      [],
      [],
      [],
      [{ id: "attempt_baseline" }],
      [{ id: "attempt_current" }],
      [{ id: "attempt_baseline" }],
      [{ id: "attempt_current" }],
      [],
      [],
      [],
      [],
    ];
    mocks.select.mockImplementation(() => {
      const result = selectResults.shift();
      if (result === undefined) {
        throw new Error("Unexpected select query in concurrency test.");
      }
      return createQueryChain(result);
    });

    const conflictConfigs: Array<{ setWhere?: unknown }> = [];
    const returning = vi.fn().mockResolvedValue([comparison]);
    const onConflictDoUpdate = vi.fn((config: { setWhere?: unknown }) => {
      conflictConfigs.push(config);
      return { returning };
    });
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    mocks.insert.mockImplementation(() => ({ values }));

    mocks.collectChangedIpRecordAddresses.mockReturnValue([]);
    mocks.compareScanResults.mockReturnValue({
      algorithmVersion: "7",
      comparedEndpointCount: 1,
      items: [{
        after: "after",
        alertEligible: true,
        algorithmVersion: "7",
        before: "before",
        category: "content",
        confidence: "high",
        endpointKey: "https://example.com/",
        type: "body_fingerprint.changed",
      }],
      omittedChangeCount: 0,
      skippedResultCount: 0,
      totalChangeCount: 1,
      truncated: false,
    });

    const state = { status: "pending" };
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteItems = vi.fn(() => ({ where: deleteWhere }));
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insertItems = vi.fn(() => ({ values: insertValues }));
    const updateWhere = vi.fn().mockImplementation(async () => undefined);
    const updateSet = vi.fn((next: { status?: string }) => {
      if (next.status) {
        state.status = next.status;
      }
      return { where: updateWhere };
    });
    const updateComparison = vi.fn(() => ({ set: updateSet }));
    const tx = {
      delete: deleteItems,
      insert: insertItems,
      select: vi.fn(() => createQueryChain(() => [{ status: state.status }])),
      update: updateComparison,
    };

    let transactionArrivals = 0;
    let releaseTransactions: (() => void) | undefined;
    const bothTransactionsStarted = new Promise<void>((resolve) => {
      releaseTransactions = resolve;
    });
    let transactionTail = Promise.resolve();
    mocks.transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<void>) => {
      transactionArrivals += 1;
      if (transactionArrivals === 2) {
        releaseTransactions?.();
      }
      await bothTransactionsStarted;

      const previousTransaction = transactionTail;
      let releaseCurrentTransaction: (() => void) | undefined;
      transactionTail = new Promise<void>((resolve) => {
        releaseCurrentTransaction = resolve;
      });
      await previousTransaction;

      try {
        return await callback(tx);
      } finally {
        releaseCurrentTransaction?.();
      }
    });

    const results = await Promise.all([
      computeScanChanges(currentScan.id),
      computeScanChanges(currentScan.id),
    ]);

    expect(results).toEqual([comparison.id, comparison.id]);
    expect(conflictConfigs).toHaveLength(2);
    expect(conflictConfigs.every((config) => config.setWhere !== undefined)).toBe(true);
    expect(deleteItems).toHaveBeenCalledTimes(1);
    expect(insertItems).toHaveBeenCalledTimes(1);
    expect(updateComparison).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("completed");
  });
});
