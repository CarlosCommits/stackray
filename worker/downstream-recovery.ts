import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import {
  scanAttempts,
  scanPhaseRuns,
  scans,
} from "../drizzle/schema.ts";
import { removeGraphileJob } from "../lib/server/jobs/graphile.ts";
import { db } from "./db.ts";
import { recoverLockedPhase } from "./downstream-recovery-actions.ts";
import {
  DOWNSTREAM_PHASES,
  DOWNSTREAM_RECOVERY_LOCK_GRACE_SECONDS,
  DOWNSTREAM_RECOVERY_ATTEMPT_STATUSES,
  type StalePhaseRow,
} from "./downstream-recovery-types.ts";

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "stackray-worker",
      event,
      ...payload,
    }),
  );
}

type SelectedPhaseRow = Omit<StalePhaseRow, "phase" | "status"> & {
  readonly phase: typeof scanPhaseRuns.$inferSelect.phase;
  readonly status: typeof scanPhaseRuns.$inferSelect.status;
};
type TerminalPhaseJobRow = {
  readonly jobKey: string;
};

function isRecoverablePhaseRow(row: SelectedPhaseRow | null | undefined): row is StalePhaseRow {
  return row !== null
    && row !== undefined
    && DOWNSTREAM_PHASES.some((phase) => phase === row.phase)
    && (row.status === "queued" || row.status === "running");
}

function missingEligibleJobCondition() {
  return sql`not exists (
    select 1
    from graphile_worker.jobs
    where task_identifier = ${scanPhaseRuns.phase}::text
      and "key" = 'scan:' || ${scanPhaseRuns.scanId}::text || ':attempt:' || ${scanPhaseRuns.attemptId}::text || ':phase:' || ${scanPhaseRuns.phase}::text
      and attempts < max_attempts
      and (
        (locked_at is not null and locked_at > now() - make_interval(secs => ${DOWNSTREAM_RECOVERY_LOCK_GRACE_SECONDS}))
        or locked_at is null
      )
  )`;
}

function queuedPhaseRecoveryReadyExpression() {
  return sql<boolean>`case
    when ${scanPhaseRuns.metaJson}->>'recoveryReason' = 'worker_interrupted' then true
    when ${scanPhaseRuns.phase} in ('headless', 'subfinder', 'finalize') then true
    when ${scanPhaseRuns.phase} = 'browser_fallback' then exists (
      select 1
      from scan_phase_runs upstream
      where upstream.attempt_id = ${scanPhaseRuns.attemptId}
        and upstream.phase = 'headless'
        and upstream.status in ('completed', 'failed', 'cancelled', 'skipped')
    )
    when ${scanPhaseRuns.phase} in ('nuclei_dns', 'ip_intel') then exists (
      select 1
      from scan_phase_runs upstream
      where upstream.attempt_id = ${scanPhaseRuns.attemptId}
        and upstream.phase = 'browser_fallback'
        and upstream.status in ('completed', 'failed', 'cancelled', 'skipped')
    )
    when ${scanPhaseRuns.phase} = 'nuclei_http' then exists (
      select 1
      from scan_phase_runs upstream
      where upstream.attempt_id = ${scanPhaseRuns.attemptId}
        and upstream.phase = 'nuclei_dns'
        and upstream.status in ('completed', 'failed', 'cancelled', 'skipped')
    )
    else false
  end`;
}

function recoverableQueuedPhaseCondition() {
  return or(
    eq(scanPhaseRuns.status, "running"),
    and(
      eq(scanPhaseRuns.status, "queued"),
      queuedPhaseRecoveryReadyExpression(),
    ),
  );
}

function recoverablePhaseWhereClause(phaseRunId?: string) {
  const predicates = [
    inArray(scanPhaseRuns.phase, DOWNSTREAM_PHASES),
    recoverableQueuedPhaseCondition(),
    inArray(scans.status, ["queued", "running", "processing"]),
    isNull(scans.cancellationRequestedAt),
    inArray(scanAttempts.status, DOWNSTREAM_RECOVERY_ATTEMPT_STATUSES),
    missingEligibleJobCondition(),
  ];

  return and(
    ...(phaseRunId ? [eq(scanPhaseRuns.id, phaseRunId), ...predicates] : predicates),
  );
}

function selectRecoverablePhaseRows() {
  return db
    .select({
      phaseRunId: scanPhaseRuns.id,
      scanId: scanPhaseRuns.scanId,
      attemptId: scanPhaseRuns.attemptId,
      resultId: scanPhaseRuns.resultId,
      phase: scanPhaseRuns.phase,
      status: scanPhaseRuns.status,
      metaJson: scanPhaseRuns.metaJson,
      readyForRecovery: queuedPhaseRecoveryReadyExpression(),
      queuedAt: scanPhaseRuns.queuedAt,
      startedAt: scanPhaseRuns.startedAt,
    })
    .from(scanPhaseRuns)
    .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
    .innerJoin(scanAttempts, eq(scanPhaseRuns.attemptId, scanAttempts.id));
}

function terminalPhaseJobWhereClause() {
  return and(
    inArray(scanPhaseRuns.phase, DOWNSTREAM_PHASES),
    or(
      inArray(scanPhaseRuns.status, ["completed", "failed", "cancelled", "skipped"]),
      inArray(scans.status, ["completed", "failed", "cancelled"]),
      inArray(scanAttempts.status, ["failed", "cancelled"]),
    ),
    sql`exists (
      select 1
      from graphile_worker.jobs
      where task_identifier = ${scanPhaseRuns.phase}::text
        and "key" = 'scan:' || ${scanPhaseRuns.scanId}::text || ':attempt:' || ${scanPhaseRuns.attemptId}::text || ':phase:' || ${scanPhaseRuns.phase}::text
        and attempts < max_attempts
    )`,
  );
}

function selectTerminalPhaseJobRows() {
  return db
    .select({
      jobKey: sql<string>`'scan:' || ${scanPhaseRuns.scanId}::text || ':attempt:' || ${scanPhaseRuns.attemptId}::text || ':phase:' || ${scanPhaseRuns.phase}::text`,
    })
    .from(scanPhaseRuns)
    .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
    .innerJoin(scanAttempts, eq(scanPhaseRuns.attemptId, scanAttempts.id));
}

export async function recoverStaleScanPhaseJobs() {
  const stalePhases = await selectRecoverablePhaseRows().where(recoverablePhaseWhereClause());
  const terminalPhaseJobs = await selectTerminalPhaseJobRows().where(terminalPhaseJobWhereClause()) as TerminalPhaseJobRow[];
  const recoveredScanIds = new Set<string>();

  for (const terminalJob of terminalPhaseJobs) {
    await removeGraphileJob(db, terminalJob.jobKey);
  }

  for (const phase of stalePhases) {
    const recovered = await db.transaction(async (tx) => {
      const [lockedPhase] = await tx
        .select({
          phaseRunId: scanPhaseRuns.id,
          scanId: scanPhaseRuns.scanId,
          attemptId: scanPhaseRuns.attemptId,
          resultId: scanPhaseRuns.resultId,
          phase: scanPhaseRuns.phase,
          status: scanPhaseRuns.status,
          metaJson: scanPhaseRuns.metaJson,
          readyForRecovery: queuedPhaseRecoveryReadyExpression(),
          queuedAt: scanPhaseRuns.queuedAt,
          startedAt: scanPhaseRuns.startedAt,
        })
        .from(scanPhaseRuns)
        .innerJoin(scans, eq(scanPhaseRuns.scanId, scans.id))
        .innerJoin(scanAttempts, eq(scanPhaseRuns.attemptId, scanAttempts.id))
        .where(recoverablePhaseWhereClause(phase.phaseRunId))
        .limit(1)
        .for("update", { skipLocked: true });

      if (!isRecoverablePhaseRow(lockedPhase)) {
        return false;
      }

      return recoverLockedPhase(tx, lockedPhase);
    });

    if (recovered) {
      recoveredScanIds.add(phase.scanId);
    }
  }

  if (stalePhases.length > 0) {
    logWorkerEvent("stale_scan_phase_jobs_recovered", {
      count: recoveredScanIds.size,
      stalePhaseCount: stalePhases.length,
    });
  }

  if (terminalPhaseJobs.length > 0) {
    logWorkerEvent("stale_terminal_scan_phase_jobs_removed", {
      staleJobCount: terminalPhaseJobs.length,
    });
  }

  return recoveredScanIds.size;
}
