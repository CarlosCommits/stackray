// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { scanEventEnvelopeSchema } from "../lib/contracts/events.ts";

const mocks = vi.hoisted(() => ({
  attemptUpdates: [] as Record<string, unknown>[],
  dbTransaction: vi.fn(),
  scanUpdates: [] as Record<string, unknown>[],
  phaseUpdates: [] as Record<string, unknown>[],
  insertedEvents: [] as Record<string, unknown>[],
  operations: [] as string[],
  attemptUpdateReturningRows: [] as Record<string, unknown>[],
  phaseUpdateReturningRows: [] as Record<string, unknown>[],
}));

vi.mock("../lib/env/server.ts", () => ({
  env: {},
}));

vi.mock("./db.ts", () => ({
  db: {
    transaction: mocks.dbTransaction,
  },
}));

import { scanAttempts, scanPhaseRuns, scans } from "../drizzle/schema.ts";
import { completeAttemptInTransaction, completeScanFinalization, markAttemptInterruptedInTransaction } from "./attempts.ts";

function makeTx(previousInterruptedAttemptCount = 0) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ value: previousInterruptedAttemptCount, resultCount: 2, forbiddenResultCount: 1 }]),
      })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((value: Record<string, unknown>) => {
        if (table === scanAttempts) {
          mocks.attemptUpdates.push(value);
        }
        if (table === scans) {
          mocks.scanUpdates.push(value);
          mocks.operations.push("update:scan");
        }
        if (table === scanPhaseRuns) {
          mocks.phaseUpdates.push(value);
          mocks.operations.push("update:phase");
        }

        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (table === scans) {
                return [{ id: "scan_01" }];
              }

              if (table === scanAttempts) {
                return mocks.attemptUpdateReturningRows;
              }
              if (table === scanPhaseRuns) {
                return mocks.phaseUpdateReturningRows;
              }

              return [];
            }),
          })),
        };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (value: Record<string, unknown>) => {
        mocks.insertedEvents.push(value);
        mocks.operations.push(`insert:${value.eventType as string}`);
      }),
    })),
  };
}

describe("markAttemptInterruptedInTransaction", () => {
  beforeEach(() => {
    mocks.attemptUpdates.length = 0;
    mocks.scanUpdates.length = 0;
    mocks.phaseUpdates.length = 0;
    mocks.insertedEvents.length = 0;
    mocks.operations.length = 0;
    mocks.attemptUpdateReturningRows = [];
    mocks.phaseUpdateReturningRows = [];
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

describe("completeAttemptInTransaction", () => {
  beforeEach(() => {
    mocks.attemptUpdates.length = 0;
    mocks.scanUpdates.length = 0;
    mocks.phaseUpdates.length = 0;
    mocks.insertedEvents.length = 0;
    mocks.operations.length = 0;
    mocks.attemptUpdateReturningRows = [];
    mocks.phaseUpdateReturningRows = [];
    vi.restoreAllMocks();
  });

  it("logs completion only when the guarded update completes an attempt", async () => {
    const tx = makeTx();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const claimedScan = {
      scan: { id: "scan_01" },
      attempt: {
        id: "attempt_01",
        attemptNumber: 1,
        metaJson: { requestProfile: "baseline", fallbackReason: null },
      },
    };

    await completeAttemptInTransaction(tx as never, claimedScan, {});

    expect(info).not.toHaveBeenCalled();

    mocks.attemptUpdateReturningRows = [{ id: "attempt_01" }];
    await completeAttemptInTransaction(tx as never, claimedScan, {});

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.[0]).toContain("scan_attempt_completed");
  });
});

describe("completeScanFinalization", () => {
  beforeEach(() => {
    mocks.attemptUpdates.length = 0;
    mocks.scanUpdates.length = 0;
    mocks.phaseUpdates.length = 0;
    mocks.insertedEvents.length = 0;
    mocks.operations.length = 0;
    mocks.attemptUpdateReturningRows = [];
    mocks.phaseUpdateReturningRows = [{
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "finalize",
      status: "completed",
      errorCode: null,
      errorMessage: null,
      metaJson: { resultCount: 2 },
      queuedAt: new Date("2026-07-04T16:00:00.000Z"),
      startedAt: new Date("2026-07-04T16:00:05.000Z"),
      completedAt: new Date("2026-07-04T16:00:10.000Z"),
    }];
    mocks.dbTransaction.mockImplementation(async (callback) => callback(makeTx()));
  });

  it("completes the finalize phase and scan in one transaction with phase event first", async () => {
    await completeScanFinalization({
      scan: { id: "scan_01" },
      attempt: { id: "attempt_01", attemptNumber: 1, metaJson: {} },
    }, {
      resultId: "result_01",
      resultCount: 2,
    });

    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.phaseUpdates).toEqual([
      expect.objectContaining({
        resultId: "result_01",
        status: "completed",
        workerId: null,
        errorCode: null,
        errorMessage: null,
        metaJson: { resultCount: 2 },
      }),
    ]);
    expect(mocks.scanUpdates).toEqual([
      expect.objectContaining({
        status: "completed",
      }),
    ]);
    expect(mocks.operations).toEqual([
      "update:phase",
      "insert:scan.phase",
      "update:scan",
      "insert:scan.complete",
    ]);

    expect(mocks.insertedEvents).toHaveLength(2);
    expect(scanEventEnvelopeSchema.parse({
      event: mocks.insertedEvents[0]?.eventType,
      data: mocks.insertedEvents[0]?.payload,
    })).toMatchObject({
      event: "scan.phase",
      data: {
        scanId: "scan_01",
        attemptId: "attempt_01",
        resultId: "result_01",
        phase: "finalize",
        status: "completed",
        meta: { resultCount: 2 },
      },
    });
    expect(scanEventEnvelopeSchema.parse({
      event: mocks.insertedEvents[1]?.eventType,
      data: mocks.insertedEvents[1]?.payload,
    })).toMatchObject({
      event: "scan.complete",
      data: {
        scanId: "scan_01",
        status: "completed",
        resultCount: 2,
      },
    });
  });

  it("refuses to complete the scan when the finalize phase cannot be completed", async () => {
    mocks.phaseUpdateReturningRows = [];

    await expect(completeScanFinalization({
      scan: { id: "scan_01" },
      attempt: { id: "attempt_01", attemptNumber: 1, metaJson: {} },
    }, {
      resultId: null,
      resultCount: 0,
    })).rejects.toThrow("Finalize phase could not be completed");

    expect(mocks.scanUpdates).toEqual([]);
    expect(mocks.insertedEvents).toEqual([]);
  });
});
