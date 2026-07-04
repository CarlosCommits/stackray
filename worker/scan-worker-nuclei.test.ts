// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClaimedScan } from "./scan-claims.ts";
import type { ScanResult as ScanResultRow } from "../drizzle/schema.ts";

const {
  dbSelectMock,
  enrichResultWithNucleiPhaseGroupMock,
  enqueuePhaseJobMock,
  getClaimedScanForAttemptMock,
  getScanResultForPhaseMock,
  markPhaseCompletedMock,
  markPhaseFailedMock,
  markPhaseRunningMock,
  markPhaseSkippedMock,
  upsertPhaseRunMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  enrichResultWithNucleiPhaseGroupMock: vi.fn(),
  enqueuePhaseJobMock: vi.fn(),
  getClaimedScanForAttemptMock: vi.fn(),
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
  getClaimedScanForAttempt: getClaimedScanForAttemptMock,
  getScanResultForPhase: getScanResultForPhaseMock,
}));

vi.mock("./nuclei-phase.ts", () => ({
  enrichResultWithNucleiPhaseGroup: enrichResultWithNucleiPhaseGroupMock,
}));

import { runNucleiDnsPhaseById, runNucleiHttpPhaseById } from "./scan-worker.ts";

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

function makeScanResult(): ScanResultRow {
  return {
    id: "result_01",
    attemptId: "attempt_01",
  } as ScanResultRow;
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

describe("runNucleiDnsPhaseById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaimedScanForAttemptMock.mockResolvedValue(makeClaimedScan());
    getScanResultForPhaseMock.mockResolvedValue(makeScanResult());
    mockDbSelectReturningEmpty();
  });

  it("requeues the nuclei DNS phase when worker shutdown aborts enrichment", async () => {
    enrichResultWithNucleiPhaseGroupMock.mockResolvedValue({
      status: "aborted",
      matchCount: 0,
      technologyCount: 0,
      errorMessage: "nuclei enrichment was interrupted by worker shutdown.",
    });

    const completed = await runNucleiDnsPhaseById("scan_01", "attempt_01", "result_01");

    expect(completed).toBe(false);
    expect(markPhaseRunningMock).toHaveBeenCalledWith("scan_01", "attempt_01", "nuclei_dns", "result_01");
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "nuclei_dns",
      status: "queued",
      metaJson: { recoveryReason: "worker_interrupted", recoveryCount: 1 },
    });
    const upsertCalls = upsertPhaseRunMock.mock.calls.map(([call]) => call);
    for (const call of upsertCalls) {
      expect(call).not.toMatchObject({ errorCode: "nuclei_failed" });
    }
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      1,
      "nuclei_dns",
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
});

describe("runNucleiHttpPhaseById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaimedScanForAttemptMock.mockResolvedValue(makeClaimedScan());
    getScanResultForPhaseMock.mockResolvedValue(makeScanResult());
    mockDbSelectReturningEmpty();
  });

  it("requeues the nuclei HTTP phase when worker shutdown aborts enrichment", async () => {
    enrichResultWithNucleiPhaseGroupMock.mockResolvedValue({
      status: "aborted",
      matchCount: 0,
      technologyCount: 0,
      errorMessage: "nuclei enrichment was interrupted by worker shutdown.",
    });

    const completed = await runNucleiHttpPhaseById("scan_01", "attempt_01", "result_01");

    expect(completed).toBe(false);
    expect(markPhaseRunningMock).toHaveBeenCalledWith("scan_01", "attempt_01", "nuclei_http", "result_01");
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "nuclei_http",
      status: "queued",
      metaJson: { recoveryReason: "worker_interrupted", recoveryCount: 1 },
    });
    const upsertCalls = upsertPhaseRunMock.mock.calls.map(([call]) => call);
    for (const call of upsertCalls) {
      expect(call).not.toMatchObject({ errorCode: "nuclei_failed" });
    }
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      1,
      "nuclei_http",
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
});
