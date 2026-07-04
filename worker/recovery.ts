import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  scanAttempts,
  scanEvents,
  scanPhaseRuns,
  scans,
} from "../drizzle/schema.ts";
import { buildQueuedScanStatusEventPayload } from "../lib/contracts/events.ts";
import { env } from "../lib/env/server.ts";
import { enqueueGraphileJob } from "../lib/server/jobs/graphile.ts";
import { markAttemptInterruptedInTransaction } from "./attempts.ts";
import { db } from "./db.ts";
import { getHttpProbeScanJobKey, getPhaseJobKey, type ScanPhaseKind } from "./queue.ts";
import { resolveGraphileJobFlags } from "./worker-config.ts";

export { recoverStaleScanPhaseJobs } from "./downstream-recovery.ts";

const DEFAULT_SCAN_TIMEOUT_MS = env.STACKRAY_HTTPX_TIMEOUT_MS ?? 15 * 60 * 1000;
const HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS = Math.ceil((DEFAULT_SCAN_TIMEOUT_MS + 60_000) / 1000);
const RESULT_PHASES_AFTER_HTTP_PROBE = ["headless", "browser_fallback", "nuclei_dns", "nuclei_http", "ip_intel"] as const satisfies readonly ScanPhaseKind[];

type RecoveryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "httpx-worker",
      event,
      ...payload,
    }),
  );
}

async function insertRecoveredPhaseRun(
  tx: RecoveryTransaction,
  {
    scanId,
    attemptId,
    resultId = null,
    phase,
    status,
    reason = null,
    now,
  }: {
    scanId: string;
    attemptId: string;
    resultId?: string | null;
    phase: ScanPhaseKind;
    status: "queued" | "skipped";
    reason?: string | null;
    now: Date;
  },
) {
  await tx.insert(scanPhaseRuns).values({
    scanId,
    attemptId,
    resultId,
    phase,
    status,
    errorMessage: reason,
    metaJson: reason ? { reason } : {},
    queuedAt: now,
    completedAt: status === "skipped" ? now : null,
    updatedAt: now,
  });

  await tx.insert(scanEvents).values({
    scanId,
    attemptId,
    eventType: "scan.phase",
    payload: {
      scanId,
      attemptId,
      resultId,
      phase,
      status,
      errorCode: null,
      errorMessage: reason,
      meta: reason ? { reason } : {},
      queuedAt: now.toISOString(),
      startedAt: null,
      completedAt: status === "skipped" ? now.toISOString() : null,
      at: now.toISOString(),
    },
  });
}

async function enqueueRecoveredPhase(
  tx: RecoveryTransaction,
  phase: ScanPhaseKind,
  payload: Record<string, unknown>,
  scanId: string,
  attemptId: string,
) {
  await enqueueGraphileJob(tx, phase, payload, {
    flags: resolveGraphileJobFlags(),
    jobKey: getPhaseJobKey(scanId, attemptId, phase),
    jobKeyMode: "replace",
  });
}

async function recoverCompletedHttpProbeHandoff(
  tx: RecoveryTransaction,
  {
    scanId,
    attemptId,
    resultId,
  }: {
    scanId: string;
    attemptId: string;
    resultId: string | null;
  },
) {
  const now = new Date();

  await tx
    .update(scanAttempts)
    .set({
      status: "completed",
      completedAt: now,
      workerId: null,
    })
    .where(and(eq(scanAttempts.id, attemptId), inArray(scanAttempts.status, ["queued", "running"])));

  await insertRecoveredPhaseRun(tx, {
    scanId,
    attemptId,
    phase: "subfinder",
    status: "queued",
    now,
  });
  await enqueueRecoveredPhase(tx, "subfinder", { scanId, attemptId }, scanId, attemptId);

  if (resultId) {
    await insertRecoveredPhaseRun(tx, {
      scanId,
      attemptId,
      resultId,
      phase: "headless",
      status: "queued",
      now,
    });
    await enqueueRecoveredPhase(tx, "headless", { scanId, attemptId, resultId }, scanId, attemptId);

    for (const phase of RESULT_PHASES_AFTER_HTTP_PROBE) {
      if (phase === "headless") {
        continue;
      }

      await insertRecoveredPhaseRun(tx, {
        scanId,
        attemptId,
        resultId,
        phase,
        status: "queued",
        now,
      });
    }
  } else {
    const reason = "No authoritative HTTP result was selected.";
    for (const phase of RESULT_PHASES_AFTER_HTTP_PROBE) {
      await insertRecoveredPhaseRun(tx, {
        scanId,
        attemptId,
        phase,
        status: "skipped",
        reason,
        now,
      });
    }
  }

  await insertRecoveredPhaseRun(tx, {
    scanId,
    attemptId,
    phase: "finalize",
    status: "queued",
    now,
  });
  await enqueueRecoveredPhase(tx, "finalize", { scanId, attemptId }, scanId, attemptId);
}

export async function recoverStaleHttpProbeJobs() {
  const queuedScansWithoutPhase = await db
    .select({
      scanId: scans.id,
      submittedAt: scans.submittedAt,
    })
    .from(scans)
    .where(and(
      eq(scans.status, "queued"),
      isNull(scans.cancellationRequestedAt),
      sql`not exists (
        select 1
        from scan_phase_runs
        where scan_id = ${scans.id}
          and phase = 'http_probe'
      )`,
      sql`not exists (
        select 1
        from graphile_worker.jobs
        where task_identifier in ('http_probe', 'run_scan')
          and "key" = 'scan:' || ${scans.id}::text || ':http_probe'
          and attempts < max_attempts
          and (
            (locked_at is not null and locked_at > now() - make_interval(secs => ${HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS}))
            or locked_at is null
          )
      )`,
    ));

  const recoveredScanIds = new Set<string>();

  for (const scan of queuedScansWithoutPhase) {
    const recovered = await db.transaction(async (tx) => {
      const [lockedScan] = await tx
        .select({
          scanId: scans.id,
          submittedAt: scans.submittedAt,
        })
        .from(scans)
        .where(and(
          eq(scans.id, scan.scanId),
          eq(scans.status, "queued"),
          isNull(scans.cancellationRequestedAt),
          sql`not exists (
            select 1
            from scan_phase_runs
            where scan_id = ${scans.id}
              and phase = 'http_probe'
          )`,
          sql`not exists (
            select 1
            from graphile_worker.jobs
            where task_identifier in ('http_probe', 'run_scan')
              and "key" = 'scan:' || ${scans.id}::text || ':http_probe'
              and attempts < max_attempts
              and (
                (locked_at is not null and locked_at > now() - make_interval(secs => ${HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS}))
                or locked_at is null
              )
          )`,
        ))
        .limit(1)
        .for("update", { skipLocked: true });

      if (!lockedScan) {
        return false;
      }

      const now = new Date();
      await tx.insert(scanEvents).values({
        scanId: lockedScan.scanId,
        attemptId: null,
        eventType: "scan.status",
        payload: buildQueuedScanStatusEventPayload({
          scanId: lockedScan.scanId,
          recoveryReason: "missing_http_probe_job_requeued",
          at: now,
        }),
      });

      await enqueueGraphileJob(tx, "http_probe", { scanId: lockedScan.scanId }, {
        flags: resolveGraphileJobFlags(),
        jobKey: getHttpProbeScanJobKey(lockedScan.scanId),
        jobKeyMode: "replace",
        runAt: lockedScan.submittedAt,
      });

      return true;
    });

    if (recovered) {
      recoveredScanIds.add(scan.scanId);
    }
  }

  const stalePhases = await db
    .select({
      phaseRunId: scanPhaseRuns.id,
      scanId: scanPhaseRuns.scanId,
      attemptId: scanPhaseRuns.attemptId,
      queuedAt: scanPhaseRuns.queuedAt,
      startedAt: scanPhaseRuns.startedAt,
      submittedAt: scans.submittedAt,
    })
    .from(scanPhaseRuns)
    .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
    .where(and(
      eq(scanPhaseRuns.phase, "http_probe"),
      inArray(scanPhaseRuns.status, ["queued", "running"]),
      inArray(scans.status, ["queued", "running", "processing"]),
      isNull(scans.cancellationRequestedAt),
      sql`not exists (
        select 1
        from graphile_worker.jobs
        where task_identifier in ('http_probe', 'run_scan')
          and "key" = 'scan:' || ${scanPhaseRuns.scanId}::text || ':http_probe'
          and attempts < max_attempts
          and (
            (locked_at is not null and locked_at > now() - make_interval(secs => ${HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS}))
            or (${scans.status} = 'queued' and locked_at is null and run_at <= now())
          )
      )`,
    ));

  for (const phase of stalePhases) {
    const recovered = await db.transaction(async (tx) => {
      const [lockedPhase] = await tx
        .select({
          phaseRunId: scanPhaseRuns.id,
          scanId: scanPhaseRuns.scanId,
          attemptId: scanPhaseRuns.attemptId,
          resultId: scanPhaseRuns.resultId,
          queuedAt: scanPhaseRuns.queuedAt,
          startedAt: scanPhaseRuns.startedAt,
          submittedAt: scans.submittedAt,
        })
        .from(scanPhaseRuns)
        .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
        .innerJoin(scanAttempts, eq(scanPhaseRuns.attemptId, scanAttempts.id))
        .where(and(
          eq(scanPhaseRuns.id, phase.phaseRunId),
          eq(scanPhaseRuns.phase, "http_probe"),
          inArray(scanPhaseRuns.status, ["queued", "running"]),
          inArray(scans.status, ["queued", "running", "processing"]),
          isNull(scans.cancellationRequestedAt),
          inArray(scanAttempts.status, ["queued", "running", "completed"]),
          sql`not exists (
            select 1
            from graphile_worker.jobs
            where task_identifier in ('http_probe', 'run_scan')
              and "key" = 'scan:' || ${scanPhaseRuns.scanId}::text || ':http_probe'
              and attempts < max_attempts
              and (
                (locked_at is not null and locked_at > now() - make_interval(secs => ${HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS}))
                or (${scans.status} = 'queued' and locked_at is null and run_at <= now())
              )
          )`,
        ))
        .limit(1)
        .for("update", { skipLocked: true });

      if (!lockedPhase) {
        return false;
      }

      const recoveryOutcome = await markAttemptInterruptedInTransaction(tx, {
        scanId: lockedPhase.scanId,
        attemptId: lockedPhase.attemptId,
      });

      if (recoveryOutcome === "not_recoverable") {
        return false;
      }

      const now = new Date();
      const completedAtIso = now.toISOString();
      const phaseStatus = recoveryOutcome === "failed" ? "failed" : "skipped";
      const errorCode = recoveryOutcome === "failed" ? "worker_interrupted_recovery_exhausted" : null;
      const errorMessage = recoveryOutcome === "failed"
        ? "Worker interruption recovery was exhausted before the scan could complete."
        : null;

      await tx
        .update(scanPhaseRuns)
        .set({
          status: phaseStatus,
          workerId: null,
          errorCode,
          errorMessage,
          metaJson: { recoveryReason: "worker_interrupted" },
          startedAt: lockedPhase.startedAt,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(scanPhaseRuns.id, lockedPhase.phaseRunId));

      await tx.insert(scanEvents).values({
        scanId: lockedPhase.scanId,
        attemptId: lockedPhase.attemptId,
        eventType: "scan.phase",
        payload: {
          scanId: lockedPhase.scanId,
          attemptId: lockedPhase.attemptId,
          resultId: lockedPhase.resultId,
          phase: "http_probe",
          status: phaseStatus,
          errorCode,
          errorMessage,
          meta: { recoveryReason: "worker_interrupted" },
          queuedAt: lockedPhase.queuedAt.toISOString(),
          startedAt: lockedPhase.startedAt?.toISOString() ?? null,
          completedAt: completedAtIso,
          at: completedAtIso,
        },
      });

      if (recoveryOutcome === "failed") {
        return true;
      }

      await enqueueGraphileJob(tx, "http_probe", { scanId: lockedPhase.scanId }, {
        flags: resolveGraphileJobFlags(),
        jobKey: getHttpProbeScanJobKey(lockedPhase.scanId),
        jobKeyMode: "replace",
        runAt: lockedPhase.submittedAt,
      });

      return true;
    });

    if (recovered) {
      recoveredScanIds.add(phase.scanId);
    }
  }

  const completedHttpProbeHandoffGaps = await db
    .select({
      phaseRunId: scanPhaseRuns.id,
      scanId: scanPhaseRuns.scanId,
      attemptId: scanPhaseRuns.attemptId,
      resultId: scanPhaseRuns.resultId,
    })
    .from(scanPhaseRuns)
    .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
    .innerJoin(scanAttempts, eq(scanPhaseRuns.attemptId, scanAttempts.id))
    .where(and(
      eq(scanPhaseRuns.phase, "http_probe"),
      eq(scanPhaseRuns.status, "completed"),
      eq(scans.status, "processing"),
      isNull(scans.cancellationRequestedAt),
      inArray(scanAttempts.status, ["queued", "running", "completed"]),
      sql`not exists (
        select 1
        from scan_phase_runs downstream
        where downstream.attempt_id = ${scanPhaseRuns.attemptId}
          and downstream.phase <> 'http_probe'
      )`,
    ));

  for (const phase of completedHttpProbeHandoffGaps) {
    const recovered = await db.transaction(async (tx) => {
      const [lockedPhase] = await tx
        .select({
          scanId: scanPhaseRuns.scanId,
          attemptId: scanPhaseRuns.attemptId,
          resultId: scanPhaseRuns.resultId,
        })
        .from(scanPhaseRuns)
        .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
        .innerJoin(scanAttempts, eq(scanPhaseRuns.attemptId, scanAttempts.id))
        .where(and(
          eq(scanPhaseRuns.id, phase.phaseRunId),
          eq(scanPhaseRuns.phase, "http_probe"),
          eq(scanPhaseRuns.status, "completed"),
          eq(scans.status, "processing"),
          isNull(scans.cancellationRequestedAt),
          inArray(scanAttempts.status, ["queued", "running", "completed"]),
          sql`not exists (
            select 1
            from scan_phase_runs downstream
            where downstream.attempt_id = ${scanPhaseRuns.attemptId}
              and downstream.phase <> 'http_probe'
          )`,
        ))
        .limit(1)
        .for("update", { skipLocked: true });

      if (!lockedPhase) {
        return false;
      }

      await recoverCompletedHttpProbeHandoff(tx, lockedPhase);
      return true;
    });

    if (recovered) {
      recoveredScanIds.add(phase.scanId);
    }
  }

  if (queuedScansWithoutPhase.length > 0 || stalePhases.length > 0 || completedHttpProbeHandoffGaps.length > 0) {
    logWorkerEvent("stale_http_probe_jobs_requeued", {
      count: recoveredScanIds.size,
      queuedScanWithoutPhaseCount: queuedScansWithoutPhase.length,
      stalePhaseCount: stalePhases.length,
      completedHttpProbeHandoffGapCount: completedHttpProbeHandoffGaps.length,
    });
  }

  return recoveredScanIds.size;
}
