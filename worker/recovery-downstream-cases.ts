import { beforeEach, describe, expect, it, vi } from "vitest";

type RecoveryMocks = {
  readonly dbSelectRows: ReturnType<typeof vi.fn>;
  readonly enqueueGraphileJob: ReturnType<typeof vi.fn>;
  readonly removeGraphileJob: ReturnType<typeof vi.fn>;
  txLockedRows: unknown[][];
  readonly updatedRows: unknown[];
};

type RegisterDownstreamRecoveryTestsOptions = {
  readonly mocks: RecoveryMocks;
  readonly parseInsertedScanEvents: () => unknown[];
  readonly recoverStaleScanPhaseJobs: () => Promise<unknown>;
  readonly resetRecoveryMocks: () => void;
};

function makePhaseRow(
  phase: string,
  status: "queued" | "running",
  resultId: string | null = "result_01",
  readyForRecovery = false,
) {
  return {
    phaseRunId: `phase_${phase}`,
    scanId: "scan_01",
    attemptId: "attempt_01",
    resultId,
    phase,
    status,
    metaJson: {},
    readyForRecovery,
    queuedAt: new Date("2026-06-30T12:00:00.000Z"),
    startedAt: status === "running" ? new Date("2026-06-30T12:01:00.000Z") : null,
  };
}

export function registerDownstreamRecoveryTests({
  mocks,
  parseInsertedScanEvents,
  recoverStaleScanPhaseJobs,
  resetRecoveryMocks,
}: RegisterDownstreamRecoveryTestsOptions) {
  describe("recoverStaleScanPhaseJobs", () => {
    beforeEach(() => {
      resetRecoveryMocks();
    });

    it("requeues a queued downstream phase when its Graphile job is missing", async () => {
      const queuedPhase = makePhaseRow("headless", "queued");
      mocks.dbSelectRows.mockReturnValueOnce([queuedPhase]);
      mocks.txLockedRows.push([queuedPhase]);

      await recoverStaleScanPhaseJobs();

      expect(mocks.enqueueGraphileJob).toHaveBeenCalledWith(
        expect.anything(),
        "headless",
        { scanId: "scan_01", attemptId: "attempt_01", resultId: "result_01" },
        expect.objectContaining({
          jobKey: "scan:scan_01:attempt:attempt_01:phase:headless",
          jobKeyMode: "replace",
        }),
      );
      expect(mocks.updatedRows).toEqual([]);
    });

    it("does not requeue parked queued phases that are waiting on upstream enrichment", async () => {
      const browserFallbackPhase = makePhaseRow("browser_fallback", "queued");
      const nucleiDnsPhase = makePhaseRow("nuclei_dns", "queued");
      const nucleiHttpPhase = makePhaseRow("nuclei_http", "queued");
      const ipIntelPhase = makePhaseRow("ip_intel", "queued");
      mocks.dbSelectRows.mockReturnValueOnce([
        browserFallbackPhase,
        nucleiDnsPhase,
        nucleiHttpPhase,
        ipIntelPhase,
      ]);
      mocks.txLockedRows.push([browserFallbackPhase], [nucleiDnsPhase], [nucleiHttpPhase], [ipIntelPhase]);

      await recoverStaleScanPhaseJobs();

      expect(mocks.enqueueGraphileJob).not.toHaveBeenCalled();
      expect(mocks.updatedRows).toEqual([]);
    });

    it("requeues parked queued phases after their upstream dependency terminalized", async () => {
      const browserFallbackPhase = makePhaseRow("browser_fallback", "queued", "result_01", true);
      const nucleiDnsPhase = makePhaseRow("nuclei_dns", "queued", "result_01", true);
      const nucleiHttpPhase = makePhaseRow("nuclei_http", "queued", "result_01", true);
      const ipIntelPhase = makePhaseRow("ip_intel", "queued", "result_01", true);
      mocks.dbSelectRows.mockReturnValueOnce([
        browserFallbackPhase,
        nucleiDnsPhase,
        nucleiHttpPhase,
        ipIntelPhase,
      ]);
      mocks.txLockedRows.push([browserFallbackPhase], [nucleiDnsPhase], [nucleiHttpPhase], [ipIntelPhase]);

      await recoverStaleScanPhaseJobs();

      expect(mocks.enqueueGraphileJob.mock.calls.map((call) => call[1])).toEqual([
        "browser_fallback",
        "nuclei_dns",
        "nuclei_http",
        "ip_intel",
      ]);
      expect(mocks.updatedRows).toEqual([]);
    });

    it("fails queued result phases that cannot be requeued because their result is missing", async () => {
      const nucleiDnsPhase = makePhaseRow("nuclei_dns", "queued", null, true);
      mocks.dbSelectRows.mockReturnValueOnce([nucleiDnsPhase]);
      mocks.txLockedRows.push([nucleiDnsPhase]);

      await recoverStaleScanPhaseJobs();

      expect(mocks.updatedRows).toEqual(expect.arrayContaining([
        expect.objectContaining({
          status: "failed",
          errorCode: "recovery_missing_result",
        }),
      ]));
      expect(mocks.enqueueGraphileJob).toHaveBeenCalledWith(
        expect.anything(),
        "finalize",
        { scanId: "scan_01", attemptId: "attempt_01" },
        expect.objectContaining({ jobKeyMode: "replace" }),
      );
      expect(parseInsertedScanEvents()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          event: "scan.phase",
          data: expect.objectContaining({
            phase: "nuclei_dns",
            status: "failed",
            errorCode: "recovery_missing_result",
            errorMessage: expect.stringContaining("scan result is missing"),
          }),
        }),
      ]));
    });

    it("fails interrupted headless with a schema-valid event and enqueues browser fallback", async () => {
      const headlessPhase = makePhaseRow("headless", "running");
      mocks.dbSelectRows.mockReturnValueOnce([headlessPhase]);
      mocks.txLockedRows.push([headlessPhase], [{ id: "result_01", hostIp: "203.0.113.10" }]);

      await recoverStaleScanPhaseJobs();

      expect(mocks.updatedRows).toEqual(expect.arrayContaining([
        expect.objectContaining({
          status: "failed",
          errorCode: "worker_interrupted",
        }),
      ]));
      expect(mocks.enqueueGraphileJob).toHaveBeenCalledWith(
        expect.anything(),
        "browser_fallback",
        { scanId: "scan_01", attemptId: "attempt_01", resultId: "result_01" },
        expect.objectContaining({ jobKeyMode: "replace" }),
      );
      expect(mocks.removeGraphileJob).toHaveBeenCalledWith(
        expect.anything(),
        "scan:scan_01:attempt:attempt_01:phase:headless",
      );
      expect(parseInsertedScanEvents()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          event: "scan.phase",
          data: expect.objectContaining({
            scanId: "scan_01",
            attemptId: "attempt_01",
            resultId: "result_01",
            phase: "headless",
            status: "failed",
            errorCode: "worker_interrupted",
          }),
        }),
      ]));
    });

    it("continues orchestration for interrupted downstream dependency phases", async () => {
      const browserFallbackPhase = makePhaseRow("browser_fallback", "running");
      const subfinderPhase = makePhaseRow("subfinder", "running", null);
      const nucleiDnsPhase = makePhaseRow("nuclei_dns", "running");
      const nucleiHttpPhase = makePhaseRow("nuclei_http", "running");
      const ipIntelPhase = makePhaseRow("ip_intel", "running");
      mocks.dbSelectRows.mockReturnValueOnce([
        browserFallbackPhase,
        subfinderPhase,
        nucleiDnsPhase,
        nucleiHttpPhase,
        ipIntelPhase,
      ]);
      mocks.txLockedRows.push([browserFallbackPhase], [subfinderPhase], [nucleiDnsPhase], [nucleiHttpPhase], [ipIntelPhase]);

      await recoverStaleScanPhaseJobs();

      expect(mocks.enqueueGraphileJob.mock.calls.map((call) => call[1])).toEqual([
        "ip_intel",
        "nuclei_dns",
        "finalize",
        "finalize",
        "nuclei_http",
        "finalize",
        "finalize",
      ]);
      expect(parseInsertedScanEvents()).toHaveLength(5);
    });

    it("requeues interrupted finalize without marking the phase failed", async () => {
      const finalizePhase = makePhaseRow("finalize", "running", null);
      mocks.dbSelectRows.mockReturnValueOnce([finalizePhase]);
      mocks.txLockedRows.push([finalizePhase]);

      await recoverStaleScanPhaseJobs();

      expect(mocks.updatedRows).toEqual(expect.arrayContaining([
        expect.objectContaining({
          status: "queued",
          errorCode: null,
        }),
      ]));
      expect(mocks.updatedRows).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ status: "failed" }),
      ]));
      expect(mocks.enqueueGraphileJob).toHaveBeenCalledWith(
        expect.anything(),
        "finalize",
        { scanId: "scan_01", attemptId: "attempt_01" },
        expect.objectContaining({ jobKeyMode: "replace" }),
      );
    });

    it("removes stale downstream jobs whose phase is already terminal", async () => {
      const terminalJob = {
        jobKey: "scan:scan_01:attempt:attempt_01:phase:headless",
      };
      mocks.dbSelectRows
        .mockReturnValueOnce([])
        .mockReturnValueOnce([terminalJob]);

      await recoverStaleScanPhaseJobs();

      expect(mocks.removeGraphileJob).toHaveBeenCalledWith(
        expect.anything(),
        "scan:scan_01:attempt:attempt_01:phase:headless",
      );
      expect(mocks.enqueueGraphileJob).not.toHaveBeenCalled();
      expect(mocks.updatedRows).toEqual([]);
    });
  });
}
