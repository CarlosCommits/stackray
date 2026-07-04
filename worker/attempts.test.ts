// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { scanEventEnvelopeSchema } from "../lib/contracts/events.ts";

const mocks = vi.hoisted(() => ({
  attemptUpdates: [] as Record<string, unknown>[],
  scanUpdates: [] as Record<string, unknown>[],
  insertedEvents: [] as Record<string, unknown>[],
}));

vi.mock("../lib/env/server.ts", () => ({
  env: {},
}));

vi.mock("./db.ts", () => ({
  db: {},
}));

import { scanAttempts, scans } from "../drizzle/schema.ts";
import { markAttemptInterruptedInTransaction } from "./attempts.ts";

function makeTx(previousInterruptedAttemptCount = 0) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ value: previousInterruptedAttemptCount }]),
      })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((value: Record<string, unknown>) => {
        if (table === scanAttempts) {
          mocks.attemptUpdates.push(value);
        }
        if (table === scans) {
          mocks.scanUpdates.push(value);
        }

        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => table === scans ? [{ id: "scan_01" }] : []),
          })),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (value: Record<string, unknown>) => {
        mocks.insertedEvents.push(value);
      }),
    })),
  };
}

describe("markAttemptInterruptedInTransaction", () => {
  beforeEach(() => {
    mocks.attemptUpdates.length = 0;
    mocks.scanUpdates.length = 0;
    mocks.insertedEvents.length = 0;
  });

  it("terminalizes the attempt with worker_interrupted, distinct from user cancellation", async () => {
    const tx = makeTx();

    await expect(markAttemptInterruptedInTransaction(tx as never, {
      scanId: "scan_01",
      attemptId: "attempt_01",
    })).resolves.toBe("requeued");

    expect(mocks.attemptUpdates).toEqual([
      expect.objectContaining({
        status: "cancelled",
        errorCode: "worker_interrupted",
        errorMessage: expect.stringContaining("recovery requeued the scan"),
        workerId: null,
      }),
    ]);
    expect(mocks.scanUpdates).toEqual([
      expect.objectContaining({
        status: "queued",
        completedAt: null,
        errorCode: null,
        errorMessage: null,
      }),
    ]);
  });

  it("emits a queued scan.status event that parses through the envelope schema", async () => {
    const tx = makeTx();

    await expect(markAttemptInterruptedInTransaction(tx as never, {
      scanId: "scan_01",
      attemptId: "attempt_01",
    })).resolves.toBe("requeued");

    expect(mocks.insertedEvents).toHaveLength(1);
    const event = mocks.insertedEvents[0];
    const parsed = scanEventEnvelopeSchema.parse({
      event: event.eventType,
      data: event.payload,
    });

    expect(parsed.data).toMatchObject({
      scanId: "scan_01",
      attemptId: "attempt_01",
      status: "queued",
      recoveryReason: "worker_interrupted",
    });
  });

  it("fails the scan when worker interruption recovery is exhausted", async () => {
    const tx = makeTx(3);

    await expect(markAttemptInterruptedInTransaction(tx as never, {
      scanId: "scan_01",
      attemptId: "attempt_01",
    })).resolves.toBe("failed");

    expect(mocks.scanUpdates).toEqual([
      expect.objectContaining({
        status: "failed",
        errorCode: "worker_interrupted_recovery_exhausted",
      }),
    ]);
    expect(mocks.insertedEvents).toHaveLength(1);

    const event = mocks.insertedEvents[0];
    const parsed = scanEventEnvelopeSchema.parse({
      event: event.eventType,
      data: event.payload,
    });

    expect(parsed).toMatchObject({
      event: "scan.failed",
      data: {
        scanId: "scan_01",
        status: "failed",
        errorCode: "worker_interrupted_recovery_exhausted",
      },
    });
  });
});
