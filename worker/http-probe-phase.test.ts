// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createFallbackAttemptMock,
  dbSelectMock,
  markAttemptCancelledMock,
  markAttemptCompletedMock,
  markAttemptFailedMock,
  markPhaseCompletedMock,
  markPhaseFailedMock,
  markPhaseRunningMock,
  markPhaseSkippedMock,
  markScanFailedAfterAttemptCompletionMock,
  markScanProcessingMock,
  runHttpxCliMock,
  upsertPhaseRunMock,
} = vi.hoisted(() => ({
  createFallbackAttemptMock: vi.fn(),
  dbSelectMock: vi.fn(),
  markAttemptCancelledMock: vi.fn(),
  markAttemptCompletedMock: vi.fn(),
  markAttemptFailedMock: vi.fn(),
  markPhaseCompletedMock: vi.fn(),
  markPhaseFailedMock: vi.fn(),
  markPhaseRunningMock: vi.fn(),
  markPhaseSkippedMock: vi.fn(),
  markScanFailedAfterAttemptCompletionMock: vi.fn(),
  markScanProcessingMock: vi.fn(),
  runHttpxCliMock: vi.fn(),
  upsertPhaseRunMock: vi.fn(),
}));

vi.mock("./httpx.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./httpx.ts")>();

  return {
    ...actual,
    runHttpxCli: runHttpxCliMock,
  };
});

vi.mock("./attempts.ts", () => ({
  buildAttemptMeta: (
    requestProfile: "baseline" | "browser_headers",
    fallbackReason: string | null,
    resultCount = 0,
    forbiddenResultCount = 0,
  ) => ({
    requestProfile,
    fallbackReason,
    resultCount,
    forbiddenResultCount,
  }),
  markAttemptCancelled: markAttemptCancelledMock,
  markAttemptCompleted: markAttemptCompletedMock,
  markAttemptFailed: markAttemptFailedMock,
  markScanFailedAfterAttemptCompletion: markScanFailedAfterAttemptCompletionMock,
  markScanProcessing: markScanProcessingMock,
}));

vi.mock("./phase-runs.ts", () => ({
  markPhaseCompleted: markPhaseCompletedMock,
  markPhaseFailed: markPhaseFailedMock,
  markPhaseRunning: markPhaseRunningMock,
  markPhaseSkipped: markPhaseSkippedMock,
  upsertPhaseRun: upsertPhaseRunMock,
}));

vi.mock("./scan-claims.ts", () => ({
  createFallbackAttempt: createFallbackAttemptMock,
}));

vi.mock("./db.ts", () => ({
  db: {
    select: dbSelectMock,
  },
}));

import { runClaimedHttpProbePhase } from "./http-probe-phase.ts";

type ClaimedScan = Parameters<typeof runClaimedHttpProbePhase>[0];

function makeClaimedScan({
  attemptId,
  attemptNumber,
  requestProfile,
}: {
  attemptId: string;
  attemptNumber: number;
  requestProfile?: "baseline" | "browser_headers";
}): ClaimedScan {
  return {
    scan: {
      id: "scan_01",
      normalizedTarget: "example.com",
      optionsJson: {},
    },
    attempt: {
      id: attemptId,
      attemptNumber,
      metaJson: requestProfile ? { requestProfile } : {},
    },
    target: {
      inputTarget: "example.com",
      normalizedTarget: "example.com",
      canonicalTargetId: null,
    },
  } as ClaimedScan;
}

function makeResult({
  id,
  statusCode,
}: {
  id: string;
  statusCode: number;
}) {
  return {
    id,
    input: "example.com",
    url: "https://example.com",
    finalUrl: "https://example.com",
    statusCode,
    title: "Example",
    contentType: "text/html",
    observedAt: new Date("2026-06-28T12:00:00.000Z"),
  };
}

function mockSelectRows(rowsByCall: unknown[][]) {
  let callIndex = 0;

  dbSelectMock.mockImplementation(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        const rows = rowsByCall[callIndex] ?? [];
        callIndex += 1;
        const rowsPromise = Promise.resolve(rows);

        return {
          then: rowsPromise.then.bind(rowsPromise),
          catch: rowsPromise.catch.bind(rowsPromise),
          finally: rowsPromise.finally.bind(rowsPromise),
          limit: vi.fn(async () => rows),
        };
      }),
    })),
  }));
}

describe("runClaimedHttpProbePhase", () => {
  beforeEach(() => {
    createFallbackAttemptMock.mockReset();
    dbSelectMock.mockReset();
    markAttemptCancelledMock.mockReset();
    markAttemptCompletedMock.mockReset();
    markAttemptFailedMock.mockReset();
    markPhaseCompletedMock.mockReset();
    markPhaseFailedMock.mockReset();
    markPhaseRunningMock.mockReset();
    markPhaseSkippedMock.mockReset();
    markScanFailedAfterAttemptCompletionMock.mockReset();
    markScanProcessingMock.mockReset();
    runHttpxCliMock.mockReset();
    upsertPhaseRunMock.mockReset();
  });

  it("creates a browser-header fallback attempt, skips the superseded attempt, then queues enrichment", async () => {
    const firstAttempt = makeClaimedScan({ attemptId: "attempt_01", attemptNumber: 1 });
    const secondAttempt = makeClaimedScan({
      attemptId: "attempt_02",
      attemptNumber: 2,
      requestProfile: "browser_headers",
    });
    const blockedResult = makeResult({ id: "result_blocked", statusCode: 403 });
    const recoveredResult = makeResult({ id: "result_recovered", statusCode: 200 });
    const dependencies = {
      isCancellationRequested: vi.fn(async () => false),
      persistHttpxResult: vi.fn(async () => undefined),
      createNoJsonHttpProbePlaceholderResult: vi.fn(),
      queueEnrichmentPhaseJobs: vi.fn(),
      recoverInterruptedHttpProbe: vi.fn(),
    };

    runHttpxCliMock.mockImplementation(async ({ onJsonLine }) => {
      await onJsonLine({ url: "https://example.com" });
      return { status: "completed", exitCode: 0, stderr: "" };
    });
    createFallbackAttemptMock.mockResolvedValue(secondAttempt);
    mockSelectRows([
      [blockedResult],
      [recoveredResult],
      [recoveredResult],
    ]);

    await runClaimedHttpProbePhase(firstAttempt, dependencies);

    expect(runHttpxCliMock).toHaveBeenCalledTimes(2);
    expect(dependencies.persistHttpxResult).toHaveBeenCalledTimes(2);
    expect(createFallbackAttemptMock).toHaveBeenCalledWith(
      firstAttempt,
      "browser_headers",
      "Received authoritative 403 after Baseline.",
    );
    expect(markPhaseSkippedMock).toHaveBeenCalledWith(
      "scan_01",
      "attempt_01",
      "http_probe",
      "A fallback HTTP probe attempt superseded this attempt.",
    );
    expect(markPhaseRunningMock).toHaveBeenNthCalledWith(1, "scan_01", "attempt_01", "http_probe");
    expect(markPhaseRunningMock).toHaveBeenNthCalledWith(2, "scan_01", "attempt_02", "http_probe");
    expect(markScanProcessingMock).toHaveBeenCalledWith(secondAttempt);
    expect(markPhaseCompletedMock).toHaveBeenCalledWith(
      "scan_01",
      "attempt_02",
      "http_probe",
      "result_recovered",
      {
        resultCount: 1,
        selectedResultId: "result_recovered",
        selectedResultStatusCode: 200,
        provisionalResultKind: null,
      },
    );
    expect(dependencies.queueEnrichmentPhaseJobs).toHaveBeenCalledWith(secondAttempt, recoveredResult, {
      requestProfile: "browser_headers",
      fallbackReason: "blocked_after_baseline",
      resultCount: 1,
      forbiddenResultCount: 0,
    });
    expect(markAttemptCompletedMock).toHaveBeenNthCalledWith(1, firstAttempt, {
      requestProfile: "baseline",
      fallbackReason: null,
      resultCount: 1,
      forbiddenResultCount: 1,
    });
    expect(markAttemptCompletedMock).toHaveBeenCalledTimes(1);
    expect(markAttemptCompletedMock.mock.invocationCallOrder[0]).toBeLessThan(
      createFallbackAttemptMock.mock.invocationCallOrder[0],
    );
  });

  it("cancels after result selection before marking the scan processing or queueing enrichment", async () => {
    const claimedScan = makeClaimedScan({ attemptId: "attempt_01", attemptNumber: 1 });
    const result = makeResult({ id: "result_01", statusCode: 200 });
    const dependencies = {
      isCancellationRequested: vi.fn(async () => true),
      persistHttpxResult: vi.fn(async () => undefined),
      createNoJsonHttpProbePlaceholderResult: vi.fn(),
      queueEnrichmentPhaseJobs: vi.fn(),
      recoverInterruptedHttpProbe: vi.fn(),
    };

    runHttpxCliMock.mockResolvedValue({ status: "completed", exitCode: 0, stderr: "" });
    mockSelectRows([
      [result],
      [result],
    ]);

    await runClaimedHttpProbePhase(claimedScan, dependencies);

    expect(markAttemptCompletedMock).not.toHaveBeenCalled();
    expect(markAttemptCancelledMock).toHaveBeenCalledWith(claimedScan);
    expect(upsertPhaseRunMock).toHaveBeenCalledWith({
      scanId: "scan_01",
      attemptId: "attempt_01",
      phase: "http_probe",
      status: "cancelled",
      errorMessage: "Scan was cancelled.",
    });
    expect(markScanProcessingMock).not.toHaveBeenCalled();
    expect(markPhaseCompletedMock).not.toHaveBeenCalled();
    expect(dependencies.queueEnrichmentPhaseJobs).not.toHaveBeenCalled();
  });

  it("treats a worker-shutdown abort as recoverable, marking the old phase terminal non-failed with worker_interrupted", async () => {
    const claimedScan = makeClaimedScan({ attemptId: "attempt_01", attemptNumber: 1 });
    const dependencies = {
      isCancellationRequested: vi.fn(async () => false),
      persistHttpxResult: vi.fn(async () => undefined),
      createNoJsonHttpProbePlaceholderResult: vi.fn(),
      queueEnrichmentPhaseJobs: vi.fn(),
      recoverInterruptedHttpProbe: vi.fn(),
    };

    runHttpxCliMock.mockResolvedValue({ status: "aborted", exitCode: null, stderr: "" });

    const result = await runClaimedHttpProbePhase(claimedScan, dependencies);

    expect(result).toEqual({ status: "aborted" });
    expect(markAttemptFailedMock).not.toHaveBeenCalled();
    expect(markPhaseFailedMock).not.toHaveBeenCalled();
    expect(markScanFailedAfterAttemptCompletionMock).not.toHaveBeenCalled();
    expect(markAttemptCancelledMock).not.toHaveBeenCalled();
    expect(dependencies.recoverInterruptedHttpProbe).toHaveBeenCalledWith(claimedScan);
    expect(upsertPhaseRunMock).not.toHaveBeenCalled();
    expect(upsertPhaseRunMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(markScanProcessingMock).not.toHaveBeenCalled();
    expect(markPhaseCompletedMock).not.toHaveBeenCalled();
    expect(markPhaseSkippedMock).not.toHaveBeenCalled();
    expect(dependencies.queueEnrichmentPhaseJobs).not.toHaveBeenCalled();
  });
});
