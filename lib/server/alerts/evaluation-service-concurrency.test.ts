// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueGraphileJob: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/server/jobs/graphile", () => ({
  enqueueGraphileJob: mocks.enqueueGraphileJob,
}));

import { evaluateAlertPolicies } from "./evaluation-service.ts";

type QueryResult<T> = T | (() => T);

function createQueryChain<T>(result: QueryResult<T>) {
  const resolveResult = () => typeof result === "function" ? (result as () => T)() : result;
  const chain = {
    for: vi.fn((mode: string) => {
      void mode;
      return chain;
    }),
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
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

describe("alert evaluation concurrency", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.enqueueGraphileJob.mockResolvedValue(undefined);
  });

  it("suppresses the second concurrent comparison inside the policy cooldown", async () => {
    const item = { id: "change_01", alertEligible: true, changeType: "technology.changed" };
    const policy = {
      conditionsJson: { changeTypes: [], selectionMode: "all" },
      conditionsSchemaVersion: 2,
      cooldownSeconds: 300,
      coverage: "all_targets",
      id: "policy_01",
    };
    const comparisonContext = (comparisonId: string, scanId: string) => ({
      comparison: {
        baselineScanId: "scan_baseline",
        changeCount: 1,
        comparisonScanId: scanId,
        id: comparisonId,
      },
      scan: {
        canonicalTargetId: "target_01",
        id: scanId,
        normalizedTarget: "example.com",
        scheduleId: null,
      },
    });
    const selectResults = [
      [comparisonContext("comparison_01", "scan_01")],
      [comparisonContext("comparison_02", "scan_02")],
      [item],
      [policy],
      [item],
      [policy],
      [{ channelId: "channel_01", policyId: policy.id }],
      [],
      [],
      [{ channelId: "channel_01", policyId: policy.id }],
      [],
      [],
    ];
    mocks.select.mockImplementation(() => {
      const result = selectResults.shift();
      if (result === undefined) {
        throw new Error("Unexpected select query in cooldown concurrency test.");
      }
      return createQueryChain(result);
    });

    const events: Array<{ id: string; state: string }> = [];
    const policyLocks: ReturnType<typeof createQueryChain>[] = [];
    let eventSequence = 0;
    function createTransaction() {
      let selectCount = 0;
      let insertCount = 0;
      return {
        insert: vi.fn(() => {
          insertCount += 1;
          return {
            values: vi.fn((values: Record<string, unknown> | Record<string, unknown>[]) => ({
              onConflictDoNothing: vi.fn(() => ({
                returning: vi.fn(async () => {
                  if (insertCount === 1) {
                    eventSequence += 1;
                    const event = {
                      id: `event_0${eventSequence}`,
                      state: String((values as Record<string, unknown>).state),
                    };
                    events.push(event);
                    return [{ id: event.id }];
                  }
                  return [{ channelId: "channel_01", id: `delivery_0${eventSequence}` }];
                }),
              })),
            })),
          };
        }),
        select: vi.fn(() => {
          selectCount += 1;
          if (selectCount === 1) {
            const query = createQueryChain([{
              cooldownSeconds: policy.cooldownSeconds,
              id: policy.id,
            }]);
            policyLocks.push(query);
            return query;
          }
          return createQueryChain(() => events.some((event) => event.state !== "suppressed")
            ? [{ id: events[0]?.id }]
            : []);
        }),
      };
    }

    let transactionArrivals = 0;
    let releaseTransactions: (() => void) | undefined;
    const bothTransactionsStarted = new Promise<void>((resolve) => {
      releaseTransactions = resolve;
    });
    let transactionTail = Promise.resolve();
    mocks.transaction.mockImplementation(async (callback) => {
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
        return await callback(createTransaction());
      } finally {
        releaseCurrentTransaction?.();
      }
    });

    const results = await Promise.all([
      evaluateAlertPolicies("comparison_01"),
      evaluateAlertPolicies("comparison_02"),
    ]);

    expect(results).toEqual([
      { createdEvents: 1, evaluatedPolicies: 1, queuedDeliveries: 1, suppressedEvents: 0 },
      { createdEvents: 1, evaluatedPolicies: 1, queuedDeliveries: 0, suppressedEvents: 1 },
    ]);
    expect(events.map((event) => event.state)).toEqual(["pending", "suppressed"]);
    expect(policyLocks).toHaveLength(2);
    expect(policyLocks.every((query) => query.for.mock.calls.some(([mode]) => mode === "update"))).toBe(true);
    expect(mocks.enqueueGraphileJob).toHaveBeenCalledTimes(1);
  });
});
