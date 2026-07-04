// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClaimedScan } from "./scan-claims.ts";

const {
  claimNextQueuedScanMock,
  claimQueuedScanByIdMock,
  dbSelectMock,
  dbTransactionMock,
  enqueueGraphileJobMock,
  enqueuePhaseJobMock,
  enrichAttemptWithSubfinderMock,
  getClaimedScanForAttemptMock,
  getScanResultForPhaseMock,
  markAttemptCancelledMock,
  markAttemptFailedMock,
  markAttemptInterruptedInTransactionMock,
  markPhaseCompletedMock,
  markPhaseFailedMock,
  markPhaseRunningMock,
  markPhaseSkippedMock,
  markScanCompletedMock,
  runClaimedHttpProbePhaseMock,
  summarizeAttemptResultsMock,
  upsertPhaseRunMock,
} = vi.hoisted(() => ({
  claimNextQueuedScanMock: vi.fn(),
  claimQueuedScanByIdMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbTransactionMock: vi.fn(),
  enqueueGraphileJobMock: vi.fn(),
  enqueuePhaseJobMock: vi.fn(),
  enrichAttemptWithSubfinderMock: vi.fn(),
  getClaimedScanForAttemptMock: vi.fn(),
  getScanResultForPhaseMock: vi.fn(),
  markAttemptCancelledMock: vi.fn(),
  markAttemptFailedMock: vi.fn(),
  markAttemptInterruptedInTransactionMock: vi.fn(),
  markPhaseCompletedMock: vi.fn(),
  markPhaseFailedMock: vi.fn(),
  markPhaseRunningMock: vi.fn(),
  markPhaseSkippedMock: vi.fn(),
  markScanCompletedMock: vi.fn(),
  runClaimedHttpProbePhaseMock: vi.fn(),
  summarizeAttemptResultsMock: vi.fn(),
  upsertPhaseRunMock: vi.fn(),
}));

vi.mock("./attempts.ts", () => ({
  markAttemptCancelled: markAttemptCancelledMock,
  markAttemptFailed: markAttemptFailedMock,
  markAttemptInterruptedInTransaction: markAttemptInterruptedInTransactionMock,
  markScanCompleted: markScanCompletedMock,
}));

vi.mock("./db.ts", () => ({
  db: {
    select: dbSelectMock,
    transaction: dbTransactionMock,
  },
}));

vi.mock("../lib/server/jobs/graphile.ts", () => ({
  enqueueGraphileJob: enqueueGraphileJobMock,
}));

vi.mock("./http-probe-phase.ts", () => ({
  runClaimedHttpProbePhase: runClaimedHttpProbePhaseMock,
  summarizeAttemptResults: summarizeAttemptResultsMock,
}));

vi.mock("./phase-runs.ts", () => ({
  TERMINAL_PHASE_STATUSES: new Set(["completed", "failed", "cancelled", "skipped"]),
  markPhaseCompleted: markPhaseCompletedMock,
  markPhaseFailed: markPhaseFailedMock,
  markPhaseRunning: markPhaseRunningMock,
  markPhaseSkipped: markPhaseSkippedMock,
  upsertPhaseRun: upsertPhaseRunMock,
}));

vi.mock("./queue.ts", () => ({
  enqueuePhaseJob: enqueuePhaseJobMock,
  getHttpProbeScanJobKey: (scanId: string) => `scan:${scanId}:http_probe`,
}));

vi.mock("./scan-claims.ts", () => ({
  claimNextQueuedScan: claimNextQueuedScanMock,
  claimQueuedScanById: claimQueuedScanByIdMock,
  getClaimedScanForAttempt: getClaimedScanForAttemptMock,
  getScanResultForPhase: getScanResultForPhaseMock,
}));

vi.mock("./subfinder-phase.ts", () => ({
  enrichAttemptWithSubfinder: enrichAttemptWithSubfinderMock,
}));

import { runScanById, runSubfinderPhaseById } from "./scan-worker.ts";

function makeClaimedScan(): ClaimedScan {
  return {
    scan: {
      id: "scan_01",
    },
    attempt: {
      id: "attempt_01",
    },
    target: {
      canonicalTargetId: null,
      inputTarget: "vercel.com",
      normalizedTarget: "vercel.com",
    },
  } as ClaimedScan;
}

function mockHttpProbeRecoveryTransaction() {
  dbTransactionMock.mockImplementation(async (callback) => callback({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            for: async () => [{
              resultId: null,
              queuedAt: new Date("2026-06-30T12:00:00.000Z"),
              startedAt: new Date("2026-06-30T12:01:00.000Z"),
            }],
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
    insert: () => ({
      values: async () => undefined,
    }),
  }));
}

function mockDbSelectReturningEmpty() {
  dbSelectMock.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [],
      }),
    }),
  });
}

describe("runSubfinderPhaseById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelectReturningEmpty();
    getClaimedScanForAttemptMock.mockResolvedValue(makeClaimedScan());
  });

  it("requeues subfinder when worker shutdown aborts discovery", async () => {
    enrichAttemptWithSubfinderMock.mockResolvedValue({ status: "aborted" });

    const completed = await runSubfinderPhaseById("scan_01", "attempt_01");

    expect(completed).toBe(false);
    expect(markPhaseRunningMock).toHaveBeenCalledWith("scan_01", "attempt_01", "subfinder");
    expect(markAttemptFailedMock).not.toHaveBeenCalled();
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      attemptId: "attempt_01",
      metaJson: { recoveryReason: "worker_interrupted", recoveryCount: 1 },
      phase: "subfinder",
      scanId: "scan_01",
      status: "queued",
    });
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      1,
      "subfinder",
      { attemptId: "attempt_01", scanId: "scan_01" },
      { jobKeyMode: "replace" },
    );
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      2,
      "finalize",
      { attemptId: "attempt_01", scanId: "scan_01" },
      { jobKeyMode: "replace" },
    );
  });
});

describe("runScanById", () => {
  afterEach(() => {
    delete process.env.STACKRAY_GRAPHILE_JOB_FLAGS;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STACKRAY_GRAPHILE_JOB_FLAGS;
  });

  it("preserves configured Graphile job flags when requeueing an aborted HTTP probe", async () => {
    process.env.STACKRAY_GRAPHILE_JOB_FLAGS = "stackray-smoke";
    const submittedAt = new Date("2026-06-30T12:00:00.000Z");
    const claimedScan = makeClaimedScan();
    mockHttpProbeRecoveryTransaction();
    claimQueuedScanByIdMock.mockResolvedValue({
      ...claimedScan,
      scan: {
        ...claimedScan.scan,
        submittedAt,
      },
    });
    runClaimedHttpProbePhaseMock.mockImplementation(async (activeClaimedScan, dependencies) => {
      await dependencies.recoverInterruptedHttpProbe(activeClaimedScan);
      return { status: "aborted" };
    });

    await expect(runScanById("scan_01")).resolves.toBe(true);

    expect(enqueueGraphileJobMock).toHaveBeenCalledWith(
      expect.anything(),
      "http_probe",
      { scanId: "scan_01" },
      expect.objectContaining({
        flags: ["stackray-smoke"],
        jobKey: "scan:scan_01:http_probe",
        jobKeyMode: "replace",
        runAt: submittedAt,
      }),
    );
  });
});
