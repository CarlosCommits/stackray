// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClaimedScan } from "./scan-claims.ts";
import type { ScanResult as ScanResultRow } from "../drizzle/schema.ts";

const {
  buildBrowserFallbackDecisionMock,
  buildBrowserFallbackPhaseMetaMock,
  dbSelectMock,
  enrichResultWithBrowserFallbackMock,
  enrichResultWithHeadlessMock,
  enqueuePhaseJobMock,
  getClaimedScanForAttemptMock,
  getScanResultForPhaseMock,
  markPhaseCompletedMock,
  markPhaseFailedMock,
  markPhaseRunningMock,
  markPhaseSkippedMock,
  upsertPhaseRunMock,
} = vi.hoisted(() => ({
  buildBrowserFallbackDecisionMock: vi.fn(),
  buildBrowserFallbackPhaseMetaMock: vi.fn(() => ({})),
  dbSelectMock: vi.fn(),
  enrichResultWithBrowserFallbackMock: vi.fn(),
  enrichResultWithHeadlessMock: vi.fn(),
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

vi.mock("./headless-enrichment.ts", () => ({
  enrichResultWithHeadless: enrichResultWithHeadlessMock,
  shouldCaptureHomepageScreenshot: vi.fn(() => false),
}));

vi.mock("./browser-fallback.ts", () => ({
  buildBrowserFallbackDecision: buildBrowserFallbackDecisionMock,
  buildBrowserFallbackDecisionOptionsFromMeta: vi.fn(() => ({})),
  buildBrowserFallbackPhaseMeta: buildBrowserFallbackPhaseMetaMock,
  enrichResultWithBrowserFallback: enrichResultWithBrowserFallbackMock,
}));

vi.mock("../lib/server/storage/screenshots.ts", () => ({
  screenshotStorageEnabled: vi.fn(() => false),
}));

import { runHeadlessPhaseById, runBrowserFallbackPhaseById } from "./scan-worker.ts";

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
    finalUrl: "https://vercel.com/",
    url: "https://vercel.com",
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

describe("runHeadlessPhaseById abort handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markPhaseRunningMock.mockReset();
    getClaimedScanForAttemptMock.mockResolvedValue(makeClaimedScan());
    getScanResultForPhaseMock.mockResolvedValue(makeScanResult());
    mockDbSelectReturningEmpty();
    buildBrowserFallbackPhaseMetaMock.mockReturnValue({});
  });

  it("requeues the headless phase with worker_interrupted when the worker signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const completed = await runHeadlessPhaseById("scan_01", "attempt_01", "result_01", controller.signal);

    expect(completed).toBe(false);
    expect(markPhaseRunningMock).not.toHaveBeenCalled();
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "headless",
      status: "queued",
      metaJson: { recoveryReason: "worker_interrupted", recoveryCount: 1 },
    });
    const upsertCalls = upsertPhaseRunMock.mock.calls.map(([call]) => call);
    for (const call of upsertCalls) {
      expect(call).not.toMatchObject({ errorCode: "phase_failed" });
      expect(call).not.toMatchObject({ status: "failed" });
    }
    expect(enrichResultWithHeadlessMock).not.toHaveBeenCalled();
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      1,
      "headless",
      { scanId: "scan_01", attemptId: "attempt_01", resultId: "result_01" },
      { jobKeyMode: "replace" },
    );
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      2,
      "finalize",
      { scanId: "scan_01", attemptId: "attempt_01" },
      { jobKeyMode: "replace" },
    );
    const enqueuedPhaseNames = enqueuePhaseJobMock.mock.calls.map(([phaseName]) => phaseName);
    expect(enqueuedPhaseNames).not.toContain("browser_fallback");
    expect(enqueuedPhaseNames).not.toContain("ip_intel");
    expect(enqueuedPhaseNames).not.toContain("nuclei_dns");
  });

  it("requeues the headless phase with worker_interrupted when the worker signal aborts during enrichment", async () => {
    const controller = new AbortController();
    enrichResultWithHeadlessMock.mockImplementation(async () => {
      controller.abort();
      throw new Error("Headless run was aborted.");
    });

    const completed = await runHeadlessPhaseById("scan_01", "attempt_01", "result_01", controller.signal);

    expect(completed).toBe(false);
    expect(markPhaseRunningMock).toHaveBeenCalledWith("scan_01", "attempt_01", "headless", "result_01");
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "headless",
      status: "queued",
      metaJson: { recoveryReason: "worker_interrupted", recoveryCount: 1 },
    });
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      1,
      "headless",
      { scanId: "scan_01", attemptId: "attempt_01", resultId: "result_01" },
      { jobKeyMode: "replace" },
    );
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      2,
      "finalize",
      { scanId: "scan_01", attemptId: "attempt_01" },
      { jobKeyMode: "replace" },
    );
    const enqueuedPhaseNames = enqueuePhaseJobMock.mock.calls.map(([phaseName]) => phaseName);
    expect(enqueuedPhaseNames).not.toContain("browser_fallback");
    expect(enqueuedPhaseNames).not.toContain("ip_intel");
    expect(enqueuedPhaseNames).not.toContain("nuclei_dns");
  });

  it("does not run headless enrichment when the phase is already terminal", async () => {
    markPhaseRunningMock.mockResolvedValue({
      status: "failed",
    });

    const completed = await runHeadlessPhaseById("scan_01", "attempt_01", "result_01");

    expect(completed).toBe(false);
    expect(markPhaseRunningMock).toHaveBeenCalledWith("scan_01", "attempt_01", "headless", "result_01");
    expect(enrichResultWithHeadlessMock).not.toHaveBeenCalled();
    expect(enqueuePhaseJobMock).not.toHaveBeenCalled();
  });
});

describe("runBrowserFallbackPhaseById abort handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markPhaseRunningMock.mockReset();
    getClaimedScanForAttemptMock.mockResolvedValue(makeClaimedScan());
    getScanResultForPhaseMock.mockResolvedValue(makeScanResult());
    mockDbSelectReturningEmpty();
    buildBrowserFallbackDecisionMock.mockReturnValue({
      shouldRun: true,
      confidence: "confirmed",
      provider: "akamai",
      reason: "akamai_block_confirmed",
      signals: [],
    });
    buildBrowserFallbackPhaseMetaMock.mockReturnValue({});
  });

  it("requeues the browser_fallback phase with worker_interrupted when the worker signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const recovered = await runBrowserFallbackPhaseById("scan_01", "attempt_01", "result_01", controller.signal);

    expect(recovered).toBe(false);
    expect(markPhaseRunningMock).not.toHaveBeenCalled();
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "browser_fallback",
      status: "queued",
      metaJson: { recoveryReason: "worker_interrupted", recoveryCount: 1 },
    });
    const upsertCalls = upsertPhaseRunMock.mock.calls.map(([call]) => call);
    for (const call of upsertCalls) {
      expect(call).not.toMatchObject({ errorCode: "phase_failed" });
      expect(call).not.toMatchObject({ status: "failed" });
    }
    expect(enrichResultWithBrowserFallbackMock).not.toHaveBeenCalled();
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      1,
      "browser_fallback",
      { scanId: "scan_01", attemptId: "attempt_01", resultId: "result_01" },
      { jobKeyMode: "replace" },
    );
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      2,
      "finalize",
      { scanId: "scan_01", attemptId: "attempt_01" },
      { jobKeyMode: "replace" },
    );
    const enqueuedPhaseNames = enqueuePhaseJobMock.mock.calls.map(([phaseName]) => phaseName);
    expect(enqueuedPhaseNames).not.toContain("ip_intel");
    expect(enqueuedPhaseNames).not.toContain("nuclei_dns");
  });

  it("requeues the browser_fallback phase with worker_interrupted when the worker signal aborts during enrichment", async () => {
    const controller = new AbortController();
    enrichResultWithBrowserFallbackMock.mockImplementation(async () => {
      controller.abort();
      throw new Error("Browser fallback was aborted.");
    });

    const recovered = await runBrowserFallbackPhaseById("scan_01", "attempt_01", "result_01", controller.signal);

    expect(recovered).toBe(false);
    expect(markPhaseRunningMock).toHaveBeenCalledWith("scan_01", "attempt_01", "browser_fallback", "result_01", {});
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "browser_fallback",
      status: "queued",
      metaJson: { recoveryReason: "worker_interrupted", recoveryCount: 1 },
    });
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      1,
      "browser_fallback",
      { scanId: "scan_01", attemptId: "attempt_01", resultId: "result_01" },
      { jobKeyMode: "replace" },
    );
    expect(enqueuePhaseJobMock).toHaveBeenNthCalledWith(
      2,
      "finalize",
      { scanId: "scan_01", attemptId: "attempt_01" },
      { jobKeyMode: "replace" },
    );
    const enqueuedPhaseNames = enqueuePhaseJobMock.mock.calls.map(([phaseName]) => phaseName);
    expect(enqueuedPhaseNames).not.toContain("ip_intel");
    expect(enqueuedPhaseNames).not.toContain("nuclei_dns");
  });
});
