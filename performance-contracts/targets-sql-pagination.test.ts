import { beforeEach, describe, expect, it, vi } from "vitest";

import { scans } from "@/lib/db/schema";
import { listCompletedResultSnapshots } from "@/lib/server/scans/read-service";
import { getTargetResults } from "@/lib/server/targets/service";

const selectMock = vi.hoisted(() => vi.fn());
const selectDistinctOnMock = vi.hoisted(() => vi.fn());

function createQueryChain<T>(result: T, asValue?: object) {
  const promise = Promise.resolve(result);
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    as: vi.fn(() => asValue ?? chain),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    [Symbol.toStringTag]: "Promise",
  };

  return chain;
}

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock,
    selectDistinctOn: selectDistinctOnMock,
  },
}));

vi.mock("@/lib/server/scans/read-service", () => ({
  listCompletedResultSnapshots: vi.fn(),
}));

const listCompletedResultSnapshotsMock = vi.mocked(listCompletedResultSnapshots);
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

describe("target SQL pagination performance contract", () => {
  beforeEach(() => {
    selectMock.mockReset();
    selectDistinctOnMock.mockReset();
    listCompletedResultSnapshotsMock.mockReset();
  });

  it("hydrates only limit plus one latest-target rows on the default path", async () => {
    const rankedColumns = {
      id: scans.id,
      normalizedTarget: scans.normalizedTarget,
      completedAt: scans.completedAt,
      targetRank: scans.requestSchemaVersion,
    };
    const rankingQuery = createQueryChain([], rankedColumns);
    const scanIds = Array.from({ length: 17 }, (_, index) => ({
      id: `scan_${index.toString().padStart(2, "0")}`,
    }));
    const pageQuery = createQueryChain(scanIds);
    selectMock
      .mockReturnValueOnce(rankingQuery)
      .mockReturnValueOnce(pageQuery);
    listCompletedResultSnapshotsMock.mockResolvedValue([]);

    const result = await getTargetResults(
      actor,
      new URLSearchParams("limit=16&cursor=32"),
    );

    expect(rankingQuery.as).toHaveBeenCalledWith("ranked_target_scans");
    expect(pageQuery.offset).toHaveBeenCalledWith(32);
    expect(pageQuery.limit).toHaveBeenCalledWith(17);
    expect(selectDistinctOnMock).not.toHaveBeenCalled();
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledOnce();
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(
      actor,
      scanIds.map((row) => row.id),
    );
    expect(result.nextCursor).toBe("48");
  });
});
