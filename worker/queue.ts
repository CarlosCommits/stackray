import { scanPhaseRuns } from "../drizzle/schema.ts";
import { enqueueGraphileJob } from "../lib/server/jobs/graphile.ts";
import { db } from "./db.ts";
import { resolveGraphileJobFlags } from "./worker-config.ts";

export type ScanPhaseKind = typeof scanPhaseRuns.$inferInsert.phase;

export type EnqueuePhaseJobOptions = {
  runAt?: Date;
  jobKeyMode?: "replace" | "preserve_run_at" | "unsafe_dedupe";
};

export function getPhaseJobKey(scanId: string, attemptId: string, phase: ScanPhaseKind) {
  return `scan:${scanId}:attempt:${attemptId}:phase:${phase}`;
}

export function getHttpProbeScanJobKey(scanId: string) {
  return `scan:${scanId}:http_probe`;
}

export async function enqueuePhaseJob(
  phase: ScanPhaseKind,
  payload: Record<string, unknown>,
  options: EnqueuePhaseJobOptions = {},
) {
  const scanId = typeof payload.scanId === "string" ? payload.scanId : null;
  const attemptId = typeof payload.attemptId === "string" ? payload.attemptId : null;

  if (!scanId || !attemptId) {
    throw new Error(`Cannot enqueue ${phase} without scanId and attemptId.`);
  }

  await enqueueGraphileJob(db, phase, payload, {
    jobKey: getPhaseJobKey(scanId, attemptId, phase),
    jobKeyMode: options.jobKeyMode ?? "preserve_run_at",
    flags: resolveGraphileJobFlags(),
    runAt: options.runAt,
  });
}
