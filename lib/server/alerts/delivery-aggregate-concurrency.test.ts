// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));

import { updateAlertEventAggregate } from "./delivery-service.ts";

type QueryResult<T> = T | (() => T);

function createQueryChain<T>(result: QueryResult<T>) {
  const resolveResult = () => typeof result === "function" ? (result as () => T)() : result;
  const chain = {
    for: vi.fn((mode: string) => {
      void mode;
      return chain;
    }),
    from: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    where: vi.fn(() => chain),
    then: <TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(resolveResult()).then(onfulfilled, onrejected),
  };

  return chain;
}

describe("alert event aggregation concurrency", () => {
  beforeEach(() => {
    mocks.transaction.mockReset();
  });

  it("finishes as delivered when concurrent aggregation starts before the last delivery finishes", async () => {
    const event: { state: string; completedAt: Date | null } = {
      state: "pending",
      completedAt: null,
    };
    const deliveries = [{ status: "delivered" }, { status: "delivering" }];
    const eventLocks: ReturnType<typeof createQueryChain>[] = [];

    function createTransaction() {
      let selectCount = 0;
      return {
        select: vi.fn(() => {
          selectCount += 1;
          if (selectCount === 1) {
            const query = createQueryChain(() => [{
              completedAt: event.completedAt,
              state: event.state,
            }]);
            eventLocks.push(query);
            return query;
          }
          return createQueryChain(() => deliveries.map((delivery) => ({ ...delivery })));
        }),
        update: vi.fn(() => ({
          set: vi.fn((values: { state: string; completedAt: Date | null }) => ({
            where: vi.fn(async () => {
              event.state = values.state;
              event.completedAt = values.completedAt;
            }),
          })),
        })),
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
      const transactionNumber = transactionArrivals;
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
        if (transactionNumber === 1) {
          deliveries[1]!.status = "delivered";
        }
        releaseCurrentTransaction?.();
      }
    });

    await Promise.all([
      updateAlertEventAggregate("event_01"),
      updateAlertEventAggregate("event_01"),
    ]);

    expect(event.state).toBe("delivered");
    expect(event.completedAt).toBeInstanceOf(Date);
    expect(eventLocks).toHaveLength(2);
    expect(eventLocks.every((query) => query.for.mock.calls.some(([mode]) => mode === "update"))).toBe(true);
  });

  it("does not reopen an event that already finished", async () => {
    const completedAt = new Date("2026-09-05T12:00:00.000Z");
    const eventQuery = createQueryChain([{ state: "delivered", completedAt }]);
    const transaction = {
      select: vi.fn(() => eventQuery),
      update: vi.fn(),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(transaction));

    await updateAlertEventAggregate("event_01");

    expect(eventQuery.for).toHaveBeenCalledWith("update");
    expect(transaction.select).toHaveBeenCalledTimes(1);
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
