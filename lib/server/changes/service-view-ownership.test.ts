// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  compareScanResults: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    execute: mocks.execute,
    select: mocks.select,
  },
}));
vi.mock("./compare-scan-results.ts", () => ({
  collectChangedIpRecordAddresses: vi.fn(),
  compareScanResults: mocks.compareScanResults,
  SCAN_COMPARISON_ALGORITHM_VERSION: "7",
}));

import type { ActorContext } from "@/lib/session/actor-context";
import { getScanComparisonForView } from "./service.ts";

function createQueryChain<T>(result: T) {
  const chain = {
    from: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    where: vi.fn(() => chain),
    then: <TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

const actor = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@stackray.test",
    displayName: "Admin",
    image: null,
    role: "admin",
  },
  apiKeyAccessEnabled: false,
  requiresPasswordChange: false,
  source: "ui",
  apiKey: null,
} satisfies ActorContext;

describe("scan comparison page ownership", () => {
  it("queues a missing canonical comparison instead of computing it during a page read", async () => {
    const currentScan = {
      id: "scan_current",
      canonicalTargetId: "target_01",
      completedAt: new Date("2026-09-04T12:00:00.000Z"),
      submittedAt: new Date("2026-09-04T11:59:00.000Z"),
      normalizedTarget: "example.com",
      status: "completed",
    };
    const baselineScan = {
      ...currentScan,
      id: "scan_baseline",
      completedAt: new Date("2026-09-04T11:00:00.000Z"),
      submittedAt: new Date("2026-09-04T10:59:00.000Z"),
    };
    const selectResults = [
      [currentScan],
      [],
      [baselineScan],
      [],
      [],
      [],
      [],
    ];
    mocks.select.mockImplementation(() => createQueryChain(selectResults.shift() ?? []));
    mocks.execute.mockResolvedValue(undefined);

    const result = await getScanComparisonForView(actor, currentScan.id);

    expect(result.state).toBe("pending");
    expect(result.comparison).toBeNull();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.compareScanResults).not.toHaveBeenCalled();
  });
});
