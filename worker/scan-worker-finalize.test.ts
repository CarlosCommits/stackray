// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  completeScanFinalizationMock,
  dbSelectMock,
  enqueuePhaseJobMock,
  finalizeNucleiRunAggregateMock,
  getClaimedScanForAttemptMock,
  getScanResultForPhaseMock,
  markAttemptCancelledMock,
  markPhaseCompletedMock,
  markPhaseFailedMock,
  markPhaseRunningMock,
  markPhaseSkippedMock,
  summarizeAttemptResultsMock,
} = vi.hoisted(() => ({
  completeScanFinalizationMock: vi.fn(),
  dbSelectMock: vi.fn(),
  enqueuePhaseJobMock: vi.fn(),
  finalizeNucleiRunAggregateMock: vi.fn(),
  getClaimedScanForAttemptMock: vi.fn(),
  getScanResultForPhaseMock: vi.fn(),
  markAttemptCancelledMock: vi.fn(),
  markPhaseCompletedMock: vi.fn(),
  markPhaseFailedMock: vi.fn(),
  markPhaseRunningMock: vi.fn(),
  markPhaseSkippedMock: vi.fn(),
  summarizeAttemptResultsMock: vi.fn(),
}));

vi.mock("./attempts.ts", () => ({
  completeScanFinalization: completeScanFinalizationMock,
  markAttemptCancelled: markAttemptCancelledMock,
  markAttemptInterruptedInTransaction: vi.fn(),
}));

vi.mock("./db.ts", () => ({
  db: {
    select: dbSelectMock,
  },
}));

vi.mock("./http-probe-phase.ts", () => ({
  summarizeAttemptResults: summarizeAttemptResultsMock,
}));

vi.mock("./nuclei-phase.ts", () => ({
  finalizeNucleiRunAggregate: finalizeNucleiRunAggregateMock,
}));

vi.mock("./phase-runs.ts", () => ({
  TERMINAL_PHASE_STATUSES: new Set(["completed", "failed", "cancelled", "skipped"]),
  markPhaseCompleted: markPhaseCompletedMock,
  markPhaseFailed: markPhaseFailedMock,
  markPhaseRunning: markPhaseRunningMock,
  markPhaseSkipped: markPhaseSkippedMock,
  upsertPhaseRun: vi.fn(),
}));

vi.mock("./queue.ts", () => ({
  enqueuePhaseJob: enqueuePhaseJobMock,
}));

vi.mock("./scan-claims.ts", () => ({
  getClaimedScanForAttempt: getClaimedScanForAttemptMock,
  getScanResultForPhase: getScanResultForPhaseMock,
}));

import { finalizeScanById } from "./scan-worker.ts";

describe("finalizeScanById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requeues finalize when the Graphile abort signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const completed = await finalizeScanById("scan_01", "attempt_01", controller.signal);

    expect(completed).toBe(false);
    expect(getClaimedScanForAttemptMock).not.toHaveBeenCalled();
    expect(markPhaseRunningMock).not.toHaveBeenCalled();
    expect(markPhaseCompletedMock).not.toHaveBeenCalled();
    expect(markPhaseSkippedMock).not.toHaveBeenCalled();
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(enqueuePhaseJobMock).toHaveBeenCalledWith(
      "finalize",
      { scanId: "scan_01", attemptId: "attempt_01" },
      { jobKeyMode: "replace" },
    );
  });

  it("atomically completes finalize and the scan after enrichment phases settle", async () => {
    const claimedScan = {
      scan: {
        id: "scan_01",
        status: "processing",
      },
      attempt: {
        id: "attempt_01",
      },
      target: {
        canonicalTargetId: null,
        inputTarget: "example.com",
        normalizedTarget: "example.com",
      },
    };
    const result = {
      id: "result_01",
      scanId: "scan_01",
      attemptId: "attempt_01",
    };

    getClaimedScanForAttemptMock.mockResolvedValue(claimedScan);
    markPhaseRunningMock.mockResolvedValue({ status: "running" });
    summarizeAttemptResultsMock.mockResolvedValue({ authoritativeResultId: "result_01" });
    getScanResultForPhaseMock.mockResolvedValue(result);
    dbSelectMock
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [
            { phase: "subfinder", status: "completed" },
            { phase: "headless", status: "completed" },
            { phase: "browser_fallback", status: "skipped" },
            { phase: "nuclei_dns", status: "completed" },
            { phase: "nuclei_http", status: "completed" },
            { phase: "ip_intel", status: "completed" },
            { phase: "finalize", status: "running" },
          ],
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ cancellationRequestedAt: null }],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [{ value: 1 }],
        }),
      });

    await expect(finalizeScanById("scan_01", "attempt_01")).resolves.toBe(true);

    expect(finalizeNucleiRunAggregateMock).toHaveBeenCalledWith(claimedScan, result, expect.any(Array));
    expect(completeScanFinalizationMock).toHaveBeenCalledWith(claimedScan, {
      resultId: "result_01",
      resultCount: 1,
    });
    expect(markPhaseCompletedMock).not.toHaveBeenCalledWith(
      "scan_01",
      "attempt_01",
      "finalize",
      expect.anything(),
      expect.anything(),
    );
  });
});
