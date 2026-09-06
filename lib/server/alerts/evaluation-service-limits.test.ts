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

import {
  alertEventSummarySchema,
  MAX_ALERT_EVENT_MATCHED_ITEM_IDS,
} from "./alert-payload.ts";
import { evaluateAlertPolicies } from "./evaluation-service.ts";

function createQueryChain<T>(result: T) {
  const promise = Promise.resolve(result);
  const chain = {
    for: vi.fn(() => chain),
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
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

describe("alert evaluation limits", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.enqueueGraphileJob.mockResolvedValue(undefined);
  });

  it.each([1_001, 2_000])(
    "creates an alert for a comparison with %i change items",
    async (itemCount) => {
      const items = Array.from({ length: itemCount }, (_, index) => ({
        id: `change_${index}`,
        alertEligible: true,
        changeType: "technology.changed",
      }));
      const itemQuery = createQueryChain(items);
      mocks.select
        .mockReturnValueOnce(createQueryChain([{
          comparison: {
            baselineScanId: "scan_baseline",
            changeCount: itemCount,
            comparisonScanId: "scan_current",
            id: "comparison_01",
          },
          scan: {
            canonicalTargetId: "target_01",
            normalizedTarget: "example.com",
            scheduleId: null,
          },
        }]))
        .mockReturnValueOnce(itemQuery)
        .mockReturnValueOnce(createQueryChain([{
          conditionsJson: { changeTypes: [], selectionMode: "all" },
          conditionsSchemaVersion: 2,
          cooldownSeconds: 0,
          coverage: "all_targets",
          id: "policy_01",
        }]))
        .mockReturnValueOnce(createQueryChain([{
          channelId: "channel_01",
          policyId: "policy_01",
        }]))
        .mockReturnValueOnce(createQueryChain([]))
        .mockReturnValueOnce(createQueryChain([]));

      let eventValues: Record<string, unknown> | undefined;
      const eventReturning = vi.fn().mockResolvedValue([{ id: "event_01" }]);
      const eventOnConflictDoNothing = vi.fn(() => ({ returning: eventReturning }));
      const eventInsertValues = vi.fn((values: Record<string, unknown>) => {
        eventValues = values;
        return { onConflictDoNothing: eventOnConflictDoNothing };
      });
      const deliveryReturning = vi.fn().mockResolvedValue([{
        channelId: "channel_01",
        id: "delivery_01",
      }]);
      const deliveryOnConflictDoNothing = vi.fn(() => ({ returning: deliveryReturning }));
      const deliveryInsertValues = vi.fn(() => ({ onConflictDoNothing: deliveryOnConflictDoNothing }));
      const transaction = {
        insert: vi.fn()
          .mockReturnValueOnce({ values: eventInsertValues })
          .mockReturnValueOnce({ values: deliveryInsertValues }),
        select: vi.fn(() => createQueryChain([{
          cooldownSeconds: 0,
          id: "policy_01",
        }])),
      };
      mocks.transaction.mockImplementation(async (callback) => callback(transaction));

      await expect(evaluateAlertPolicies("comparison_01")).resolves.toEqual({
        createdEvents: 1,
        evaluatedPolicies: 1,
        queuedDeliveries: 1,
        suppressedEvents: 0,
      });

      expect(itemQuery.limit).toHaveBeenCalledWith(2_001);
      expect(eventValues).toMatchObject({ matchedItemCount: itemCount });
      const summary = alertEventSummarySchema.parse(eventValues?.summaryJson);
      expect(summary.includedChanges).toBe(itemCount);
      expect(summary.matchedItemIds).toHaveLength(MAX_ALERT_EVENT_MATCHED_ITEM_IDS);
      expect(summary.matchedItemIds[0]).toBe("change_0");
      expect(summary.matchedItemIds.at(-1)).toBe("change_999");
    },
  );
});
