import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVisibleScansFilter: vi.fn(),
  select: vi.fn(),
}));

function createQueryChain<T>(result: T) {
  const promise = Promise.resolve(result);
  const chain = {
    from: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    where: vi.fn(() => chain),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    [Symbol.toStringTag]: "Promise",
  };

  return chain;
}

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("@/lib/server/scans/access", () => ({
  getVisibleScansFilter: mocks.getVisibleScansFilter,
}));

describe("getTargetHistoryForScan", () => {
  beforeEach(() => {
    mocks.getVisibleScansFilter.mockReset();
    mocks.select.mockReset();
    mocks.getVisibleScansFilter.mockReturnValue(undefined);
  });

  it("limits snapshot candidates to completed scans for the same target", async () => {
    const scanQuery = createQueryChain([{
      id: "scan_current",
      canonicalTargetId: "target_01",
      normalizedTarget: "example.com",
    }]);
    const candidateQuery = createQueryChain([]);
    mocks.select
      .mockReturnValueOnce(scanQuery)
      .mockReturnValueOnce(candidateQuery);

    const { getTargetHistoryForScan } = await import("@/lib/server/scans/read-service");
    const result = await getTargetHistoryForScan({
      user: { id: "user_01", role: "admin" },
      source: "ui",
      apiKey: null,
    } as never, "scan_current", 4);

    expect(candidateQuery.limit).toHaveBeenCalledWith(5);
    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      canonicalTargetId: "target_01",
      normalizedTarget: "example.com",
      items: [],
      totalCount: 0,
      hasMore: false,
    });
  });
});
