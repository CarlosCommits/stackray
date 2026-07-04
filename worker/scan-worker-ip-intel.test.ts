// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbSelectMock,
  enqueuePhaseJobMock,
  getScanResultForPhaseMock,
  markPhaseCompletedMock,
  markPhaseFailedMock,
  markPhaseRunningMock,
  markPhaseSkippedMock,
  upsertPhaseRunMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  enqueuePhaseJobMock: vi.fn(),
  getScanResultForPhaseMock: vi.fn(),
  markPhaseCompletedMock: vi.fn(),
  markPhaseFailedMock: vi.fn(),
  markPhaseRunningMock: vi.fn(),
  markPhaseSkippedMock: vi.fn(),
  upsertPhaseRunMock: vi.fn(),
}));

vi.mock("./db.ts", () => ({
  db: {
    select: dbSelectMock,
  },
}));

vi.mock("./phase-runs.ts", () => ({
  markPhaseCompleted: markPhaseCompletedMock,
  markPhaseFailed: markPhaseFailedMock,
  markPhaseRunning: markPhaseRunningMock,
  markPhaseSkipped: markPhaseSkippedMock,
  upsertPhaseRun: upsertPhaseRunMock,
}));

vi.mock("./queue.ts", () => ({
  enqueuePhaseJob: enqueuePhaseJobMock,
}));

vi.mock("./scan-claims.ts", () => ({
  getClaimedScanForAttempt: vi.fn(),
  getScanResultForPhase: getScanResultForPhaseMock,
}));

vi.mock("./ip-enrichment.ts", () => ({
  enrichIpAddress: vi.fn(),
}));

import { runIpIntelPhaseById } from "./scan-worker.ts";

describe("runIpIntelPhaseById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectMock.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });
  });

  it("requeues ip intel when the Graphile abort signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const completed = await runIpIntelPhaseById("scan_01", "attempt_01", "result_01", controller.signal);

    expect(completed).toBe(false);
    expect(getScanResultForPhaseMock).not.toHaveBeenCalled();
    expect(markPhaseRunningMock).not.toHaveBeenCalled();
    expect(markPhaseCompletedMock).not.toHaveBeenCalled();
    expect(markPhaseSkippedMock).not.toHaveBeenCalled();
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "ip_intel",
      status: "queued",
      metaJson: { recoveryReason: "worker_interrupted", recoveryCount: 1 },
    });
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      1,
      "ip_intel",
      { scanId: "scan_01", attemptId: "attempt_01", resultId: "result_01" },
      { jobKeyMode: "replace" },
    );
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      2,
      "finalize",
      { scanId: "scan_01", attemptId: "attempt_01" },
      { jobKeyMode: "replace" },
    );
  });

  it("fails ip intel instead of requeueing when worker interruption recovery is exhausted", async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{
            status: "running",
            metaJson: { recoveryCount: 3 },
          }],
        }),
      }),
    });
    const controller = new AbortController();
    controller.abort();

    const completed = await runIpIntelPhaseById("scan_01", "attempt_01", "result_01", controller.signal);

    expect(completed).toBe(false);
    expect(upsertPhaseRunMock).not.toHaveBeenCalled();
    expect(enqueuePhaseJobMock).toHaveBeenCalledTimes(1);
    expect(enqueuePhaseJobMock).toHaveBeenCalledWith(
      "finalize",
      { scanId: "scan_01", attemptId: "attempt_01" },
      { jobKeyMode: "replace" },
    );
    expect(markPhaseFailedMock).toHaveBeenCalledWith(
      "scan_01",
      "attempt_01",
      "ip_intel",
      expect.any(Error),
      "result_01",
      { recoveryReason: "worker_interrupted", recoveryCount: 3 },
    );
  });
});
