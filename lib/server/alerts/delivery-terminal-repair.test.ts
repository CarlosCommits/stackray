// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
  },
}));

import { deliverAlert } from "./delivery-service.ts";

function createQueryChain<T>(result: T) {
  const chain = {
    for: vi.fn(() => chain),
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    where: vi.fn(() => chain),
    then: <TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

describe("terminal alert delivery retries", () => {
  beforeEach(() => {
    mocks.select.mockReset();
    mocks.transaction.mockReset();
  });

  it("repairs the parent event aggregate before returning", async () => {
    mocks.select.mockReturnValue(createQueryChain([{
      delivery: { status: "delivered" },
      event: { id: "event_01" },
    }]));
    const aggregateUpdate = vi.fn().mockResolvedValue(undefined);
    let transactionSelectCount = 0;
    mocks.transaction.mockImplementation(async (callback) => callback({
      select: vi.fn(() => {
        transactionSelectCount += 1;
        return createQueryChain(transactionSelectCount === 1
          ? [{ state: "delivering", completedAt: null }]
          : [{ status: "delivered" }]);
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: aggregateUpdate })),
      })),
    }));

    await deliverAlert("delivery_01");

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(aggregateUpdate).toHaveBeenCalledTimes(1);
  });
});
