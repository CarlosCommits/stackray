import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  scanAttempts,
  scanEvents,
  scanPhaseRuns,
  scans,
} from "../drizzle/schema.ts";
import { env } from "../lib/env/server.ts";
import { enqueueGraphileJob } from "../lib/server/jobs/graphile.ts";
import { db } from "./db.ts";
import { getHttpProbeScanJobKey } from "./queue.ts";

const DEFAULT_SCAN_TIMEOUT_MS = env.STACKRAY_HTTPX_TIMEOUT_MS ?? 15 * 60 * 1000;
const HTTP_PROBE_RECOVERY_LOCK_GRACE_SECONDS = Math.ceil((DEFAULT_SCAN_TIMEOUT_MS + 60_000) / 1000);

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "httpx-worker",
      event,
      ...payload,
    }),
  );
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

      const nowIso = new Date().toISOString();
      await tx.insert(scanEvents).values({
        scanId: lockedScan.scanId,
        attemptId: null,
        eventType: "scan.status",
        payload: {
          scanId: lockedScan.scanId,
          status: "queued",
          recoveryReason: "missing_http_probe_job_requeued",
          at: nowIso,
        },
      });

      await enqueueGraphileJob(tx, "http_probe", { scanId: lockedScan.scanId }, {
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
    const message = "HTTP probe was recovered after its worker stopped before completion.";
    const recovered = await db.transaction(async (tx) => {
      const [lockedPhase] = await tx
        .select({
          phaseRunId: scanPhaseRuns.id,
          scanId: scanPhaseRuns.scanId,
          attemptId: scanPhaseRuns.attemptId,
          resultId: scanPhaseRuns.resultId,
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
          inArray(scanAttempts.status, ["queued", "running"]),
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

      const now = new Date();
      const completedAtIso = now.toISOString();

      await tx
        .update(scanAttempts)
        .set({
          status: "failed",
          completedAt: now,
          errorCode: "stale_http_probe_recovered",
          errorMessage: message,
        })
        .where(eq(scanAttempts.id, lockedPhase.attemptId));

      await tx
        .update(scanPhaseRuns)
        .set({
          status: "failed",
          workerId: null,
          errorCode: "phase_failed",
          errorMessage: message,
          metaJson: { message },
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(scanPhaseRuns.id, lockedPhase.phaseRunId));

      await tx
        .update(scans)
        .set({
          status: "queued",
          completedAt: null,
          errorCode: null,
          errorMessage: null,
        })
        .where(eq(scans.id, lockedPhase.scanId));

      await tx.insert(scanEvents).values([
        {
          scanId: lockedPhase.scanId,
          attemptId: lockedPhase.attemptId,
          eventType: "scan.phase",
          payload: {
            scanId: lockedPhase.scanId,
            attemptId: lockedPhase.attemptId,
            resultId: lockedPhase.resultId,
            phase: "http_probe",
            status: "failed",
            errorCode: "phase_failed",
            errorMessage: message,
            meta: { message },
            at: completedAtIso,
          },
        },
        {
          scanId: lockedPhase.scanId,
          attemptId: lockedPhase.attemptId,
          eventType: "scan.status",
          payload: {
            scanId: lockedPhase.scanId,
            attemptId: lockedPhase.attemptId,
            status: "queued",
            recoveryReason: "stale_http_probe_recovered",
            at: completedAtIso,
          },
        },
      ]);

      await enqueueGraphileJob(tx, "http_probe", { scanId: lockedPhase.scanId }, {
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

  if (queuedScansWithoutPhase.length > 0 || stalePhases.length > 0) {
    logWorkerEvent("stale_http_probe_jobs_requeued", {
      count: recoveredScanIds.size,
      queuedScanWithoutPhaseCount: queuedScansWithoutPhase.length,
      stalePhaseCount: stalePhases.length,
    });
  }

  return recoveredScanIds.size;
}
