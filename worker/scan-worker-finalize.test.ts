// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enqueuePhaseJobMock,
  getClaimedScanForAttemptMock,
  markPhaseCompletedMock,
  markPhaseFailedMock,
  markPhaseRunningMock,
  markPhaseSkippedMock,
} = vi.hoisted(() => ({
  enqueuePhaseJobMock: vi.fn(),
  getClaimedScanForAttemptMock: vi.fn(),
  markPhaseCompletedMock: vi.fn(),
  markPhaseFailedMock: vi.fn(),
  markPhaseRunningMock: vi.fn(),
  markPhaseSkippedMock: vi.fn(),
}));

vi.mock("./phase-runs.ts", () => ({
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
  getScanResultForPhase: vi.fn(),
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
});
