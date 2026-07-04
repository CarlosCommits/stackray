// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { scanEventEnvelopeSchema } from "../lib/contracts/events.ts";
import { scanEvents } from "../drizzle/schema.ts";
import { DOWNSTREAM_RECOVERY_ATTEMPT_STATUSES } from "./downstream-recovery-types.ts";
import { registerDownstreamRecoveryTests } from "./recovery-downstream-cases.ts";

const mocks = vi.hoisted(() => ({
  dbSelectRows: vi.fn<() => unknown[]>(),
  enqueueGraphileJob: vi.fn(),
  removeGraphileJob: vi.fn(),
  markAttemptInterruptedInTransaction: vi.fn(),
  insertedEvents: [] as unknown[],
  txLockedRows: [] as unknown[][],
  updatedRows: [] as unknown[],
}));

function makeSelectChain(rows: unknown[]) {
  const rowsPromise = Promise.resolve(rows);
  const rowsResult = {
    then: rowsPromise.then.bind(rowsPromise),
    catch: rowsPromise.catch.bind(rowsPromise),
    finally: rowsPromise.finally.bind(rowsPromise),
    limit: vi.fn(() => ({
      for: vi.fn(async () => rows),
    })),
  };

  return {
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => rowsResult),
        })),
        where: vi.fn(() => rowsResult),
      })),
      where: vi.fn(() => rowsResult),
    })),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn((value: unknown) => {
      mocks.updatedRows.push(value);

      return {
        where: vi.fn(async () => undefined),
      };
    }),
  };
}

function makeInsertChain(table?: unknown) {
  return {
    values: vi.fn(async (value: unknown) => {
      if (table !== scanEvents) {
        return;
      }

      if (Array.isArray(value)) {
        mocks.insertedEvents.push(...value);
        return;
      }

      mocks.insertedEvents.push(value);
    }),
  };
}

vi.mock("../lib/env/server.ts", () => ({
  env: {},
}));

vi.mock("../lib/server/jobs/graphile.ts", () => ({
  enqueueGraphileJob: mocks.enqueueGraphileJob,
  removeGraphileJob: mocks.removeGraphileJob,
}));

vi.mock("./attempts.ts", () => ({
  markAttemptInterruptedInTransaction: (...args: unknown[]) => mocks.markAttemptInterruptedInTransaction(...args),
}));

vi.mock("./db.ts", () => ({
  db: {
    select: vi.fn(() => makeSelectChain(mocks.dbSelectRows())),
    transaction: vi.fn(async (callback: (tx: {
      select: () => ReturnType<typeof makeSelectChain>;
      update: () => ReturnType<typeof makeUpdateChain>;
      insert: () => ReturnType<typeof makeInsertChain>;
    }) => Promise<unknown>) => callback({
      select: () => makeSelectChain(mocks.txLockedRows.shift() ?? []),
      update: () => makeUpdateChain(),
      insert: (table?: unknown) => makeInsertChain(table),
    })),
  },
}));

import { recoverStaleHttpProbeJobs, recoverStaleScanPhaseJobs } from "./recovery.ts";

function resetRecoveryMocks() {
  mocks.dbSelectRows.mockReset();
  mocks.dbSelectRows.mockReturnValue([]);
  mocks.enqueueGraphileJob.mockReset();
  mocks.removeGraphileJob.mockReset();
  mocks.markAttemptInterruptedInTransaction.mockReset();
  mocks.insertedEvents.length = 0;
  mocks.txLockedRows = [];
  mocks.updatedRows.length = 0;
}

function parseInsertedScanEvents() {
  return mocks.insertedEvents.map((event) => {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw new Error("Inserted event must be an object.");
    }

    const row = Object.fromEntries(Object.entries(event));
    return scanEventEnvelopeSchema.parse({
      event: row.eventType,
      data: row.payload,
    });
  });
}

describe("recoverStaleHttpProbeJobs", () => {
  beforeEach(() => {
    resetRecoveryMocks();
    delete process.env.STACKRAY_GRAPHILE_JOB_FLAGS;
  });

  it("emits schema-valid scan.status events when requeueing a queued scan without an HTTP probe job", async () => {
    mocks.dbSelectRows
      .mockReturnValueOnce([{ scanId: "scan_01", submittedAt: new Date("2026-06-30T12:00:00.000Z") }])
      .mockReturnValueOnce([]);
    mocks.txLockedRows.push([
      { scanId: "scan_01", submittedAt: new Date("2026-06-30T12:00:00.000Z") },
    ]);

    await recoverStaleHttpProbeJobs();

    expect(parseInsertedScanEvents()).toEqual([
      expect.objectContaining({
        event: "scan.status",
        data: expect.objectContaining({
          scanId: "scan_01",
          status: "queued",
          attemptId: null,
          recoveryReason: "missing_http_probe_job_requeued",
        }),
      }),
    ]);
  });

  it("recovers stale HTTP probe rows whose attempt completed before the phase transition completed", async () => {
    mocks.dbSelectRows
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          phaseRunId: "phase_01",
          scanId: "scan_01",
          attemptId: "attempt_01",
          submittedAt: new Date("2026-06-30T12:00:00.000Z"),
        },
      ]);
    mocks.txLockedRows.push([
      {
        phaseRunId: "phase_01",
        scanId: "scan_01",
        attemptId: "attempt_01",
        resultId: "result_01",
        queuedAt: new Date("2026-06-30T12:00:00.000Z"),
        startedAt: new Date("2026-06-30T12:01:00.000Z"),
        submittedAt: new Date("2026-06-30T12:00:00.000Z"),
      },
    ]);

    await recoverStaleHttpProbeJobs();

    expect(mocks.markAttemptInterruptedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      {
        scanId: "scan_01",
        attemptId: "attempt_01",
      },
    );
    expect(mocks.enqueueGraphileJob).toHaveBeenCalledWith(
      expect.anything(),
      "http_probe",
      { scanId: "scan_01" },
      expect.objectContaining({ jobKeyMode: "replace" }),
    );
  });

  it("terminalizes a stale HTTP probe phase as non-failed before scan-level requeue", async () => {
    mocks.dbSelectRows
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          phaseRunId: "phase_01",
          scanId: "scan_01",
          attemptId: "attempt_01",
          submittedAt: new Date("2026-06-30T12:00:00.000Z"),
        },
      ]);
    mocks.txLockedRows.push([
      {
        phaseRunId: "phase_01",
        scanId: "scan_01",
        attemptId: "attempt_01",
        resultId: "result_01",
        queuedAt: new Date("2026-06-30T12:00:00.000Z"),
        startedAt: null,
        submittedAt: new Date("2026-06-30T12:00:00.000Z"),
      },
    ]);

    await recoverStaleHttpProbeJobs();

    const failedUpdates = mocks.updatedRows.filter((row) => {
      return typeof row === "object" && row !== null && (row as { status?: unknown }).status === "failed";
    });
    expect(failedUpdates).toEqual([]);

    expect(mocks.markAttemptInterruptedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      {
        scanId: "scan_01",
        attemptId: "attempt_01",
      },
    );

    expect(mocks.updatedRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: "skipped",
        workerId: null,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        completedAt: expect.any(Date),
        metaJson: { recoveryReason: "worker_interrupted" },
      }),
    ]));

    expect(mocks.enqueueGraphileJob).toHaveBeenCalledWith(
      expect.anything(),
      "http_probe",
      { scanId: "scan_01" },
      expect.objectContaining({
        jobKey: "scan:scan_01:http_probe",
        jobKeyMode: "replace",
      }),
    );

    expect(parseInsertedScanEvents()).toEqual([
      expect.objectContaining({
        event: "scan.phase",
        data: expect.objectContaining({
          scanId: "scan_01",
          attemptId: "attempt_01",
          resultId: "result_01",
          phase: "http_probe",
          status: "skipped",
          errorCode: null,
          errorMessage: null,
          queuedAt: expect.any(String),
          startedAt: null,
          completedAt: expect.any(String),
          at: expect.any(String),
        }),
      }),
    ]);

    const rawStatusPayloads = mocks.insertedEvents
      .map((event) => (event && typeof event === "object" && !Array.isArray(event)
        ? (event as { eventType?: unknown; payload?: unknown })
        : null))
      .filter((event): event is { eventType: unknown; payload: unknown } => event !== null)
      .filter((event) => event.eventType === "scan.status")
      .map((event) => event.payload);
    expect(rawStatusPayloads).toEqual([]);

    const allEventPayloads = mocks.insertedEvents
      .map((event) => (event && typeof event === "object" && !Array.isArray(event)
        ? (event as { eventType?: unknown; payload?: unknown })
        : null))
      .filter((event): event is { eventType: unknown; payload: unknown } => event !== null)
      .map((event) => event.payload);

    const workerShutdownPayloads = allEventPayloads.filter((payload) => {
      return typeof payload === "object" && payload !== null
        && "recoveryReason" in payload
        && (payload as { recoveryReason?: unknown }).recoveryReason === "worker_shutdown";
    });
    expect(workerShutdownPayloads).toEqual([]);

    const phaseFailedPayloads = allEventPayloads.filter((payload) => {
      return typeof payload === "object" && payload !== null
        && "errorCode" in payload
        && (payload as { errorCode?: unknown }).errorCode === "phase_failed";
    });
    expect(phaseFailedPayloads).toEqual([]);

    const failedScanStatusPayloads = allEventPayloads.filter((payload) => {
      return typeof payload === "object" && payload !== null
        && "status" in payload
        && (payload as { status?: unknown }).status === "failed";
    });
    expect(failedScanStatusPayloads).toEqual([]);
  });

  it("preserves configured Graphile job flags when requeueing stale HTTP probe work", async () => {
    process.env.STACKRAY_GRAPHILE_JOB_FLAGS = "stackray-smoke";
    mocks.dbSelectRows
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          phaseRunId: "phase_01",
          scanId: "scan_01",
          attemptId: "attempt_01",
          submittedAt: new Date("2026-06-30T12:00:00.000Z"),
        },
      ]);
    mocks.txLockedRows.push([
      {
        phaseRunId: "phase_01",
        scanId: "scan_01",
        attemptId: "attempt_01",
        resultId: "result_01",
        queuedAt: new Date("2026-06-30T12:00:00.000Z"),
        startedAt: null,
        submittedAt: new Date("2026-06-30T12:00:00.000Z"),
      },
    ]);

    await recoverStaleHttpProbeJobs();

    expect(mocks.enqueueGraphileJob).toHaveBeenCalledWith(
      expect.anything(),
      "http_probe",
      { scanId: "scan_01" },
      expect.objectContaining({
        flags: ["stackray-smoke"],
        jobKey: "scan:scan_01:http_probe",
        jobKeyMode: "replace",
      }),
    );
  });

  it("reconstructs downstream phase jobs when HTTP probe completed before handoff persisted", async () => {
    mocks.dbSelectRows
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          phaseRunId: "phase_http_probe",
          scanId: "scan_01",
          attemptId: "attempt_01",
          resultId: "result_01",
        },
      ]);
    mocks.txLockedRows.push([
      {
        scanId: "scan_01",
        attemptId: "attempt_01",
        resultId: "result_01",
      },
    ]);

    await recoverStaleHttpProbeJobs();

    expect(mocks.enqueueGraphileJob.mock.calls.map((call) => call[1])).toEqual([
      "subfinder",
      "headless",
      "finalize",
    ]);
    expect(mocks.enqueueGraphileJob).toHaveBeenCalledWith(
      expect.anything(),
      "headless",
      { scanId: "scan_01", attemptId: "attempt_01", resultId: "result_01" },
      expect.objectContaining({
        jobKey: "scan:scan_01:attempt:attempt_01:phase:headless",
        jobKeyMode: "replace",
      }),
    );
    expect(parseInsertedScanEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "scan.phase",
        data: expect.objectContaining({
          phase: "headless",
          status: "queued",
          resultId: "result_01",
        }),
      }),
      expect.objectContaining({
        event: "scan.phase",
        data: expect.objectContaining({
          phase: "finalize",
          status: "queued",
          resultId: null,
        }),
      }),
    ]));
  });
});

registerDownstreamRecoveryTests({
  mocks,
  parseInsertedScanEvents,
  recoverStaleScanPhaseJobs,
  resetRecoveryMocks,
});

describe("downstream recovery eligibility", () => {
  it("includes completed HTTP attempts because enrichment phases run after probe completion", () => {
    expect(DOWNSTREAM_RECOVERY_ATTEMPT_STATUSES).toContain("completed");
  });
});
