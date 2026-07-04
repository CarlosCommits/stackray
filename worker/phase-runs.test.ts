// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("./db.ts", () => ({
  db: dbMocks,
}));

import { upsertPhaseRun } from "./phase-runs.ts";

function makeSelectChain(rows: readonly unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rows),
      })),
    })),
  };
}

describe("upsertPhaseRun", () => {
  beforeEach(() => {
    dbMocks.insert.mockReset();
    dbMocks.select.mockReset();
    dbMocks.update.mockReset();
  });

  it("keeps terminal phase rows immutable when a stale worker reports a later state", async () => {
    const terminalPhaseRun = {
      id: "phase_01",
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "nuclei_dns",
      status: "failed",
      workerId: null,
      jobKey: "scan:scan_01:attempt:attempt_01:phase:nuclei_dns",
      errorCode: "worker_interrupted",
      errorMessage: "Worker stopped before this phase completed; recovery continued the scan.",
      metaJson: { message: "Worker stopped before this phase completed; recovery continued the scan." },
      queuedAt: new Date("2026-06-30T12:00:00.000Z"),
      startedAt: new Date("2026-06-30T12:01:00.000Z"),
      completedAt: new Date("2026-06-30T12:02:00.000Z"),
      updatedAt: new Date("2026-06-30T12:02:00.000Z"),
    };
    dbMocks.select.mockReturnValue(makeSelectChain([terminalPhaseRun]));

    await expect(upsertPhaseRun({
      scanId: "scan_01",
      attemptId: "attempt_01",
      resultId: "result_01",
      phase: "nuclei_dns",
      status: "completed",
      metaJson: { matchCount: 2 },
    })).resolves.toBe(terminalPhaseRun);

    expect(dbMocks.update).not.toHaveBeenCalled();
    expect(dbMocks.insert).not.toHaveBeenCalled();
  });
});
