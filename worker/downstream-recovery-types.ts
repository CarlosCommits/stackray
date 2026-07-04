import { env } from "../lib/env/server.ts";
import type { enqueueGraphileJob } from "../lib/server/jobs/graphile.ts";
import type { db } from "./db.ts";
import type { ScanPhaseKind } from "./queue.ts";

export const DOWNSTREAM_PHASES = ["headless", "browser_fallback", "subfinder", "nuclei_dns", "nuclei_http", "ip_intel", "finalize"] as const satisfies readonly ScanPhaseKind[];
export const RESULT_PHASES = ["headless", "browser_fallback", "nuclei_dns", "nuclei_http", "ip_intel"] as const satisfies readonly ScanPhaseKind[];
export const DOWNSTREAM_RECOVERY_ATTEMPT_STATUSES = ["queued", "running", "completed"] as const;

const DEFAULT_DOWNSTREAM_RECOVERY_TIMEOUT_MS = Math.max(
  env.STACKRAY_HEADLESS_ENRICHMENT_TIMEOUT_MS ?? 0,
  env.STACKRAY_BROWSER_FALLBACK_TIMEOUT_MS ?? 0,
  env.STACKRAY_SUBFINDER_TIMEOUT_MS ?? 0,
  env.STACKRAY_NUCLEI_TIMEOUT_MS ?? 0,
  15 * 60 * 1000,
);

export const DOWNSTREAM_RECOVERY_LOCK_GRACE_SECONDS = Math.ceil((DEFAULT_DOWNSTREAM_RECOVERY_TIMEOUT_MS + 60_000) / 1000);
export const WORKER_INTERRUPTED_MESSAGE = "Worker stopped before this phase completed; recovery continued the scan.";

export type DownstreamPhase = (typeof DOWNSTREAM_PHASES)[number];
export type RecoveryDb = Pick<typeof db, "insert" | "select" | "update"> & Parameters<typeof enqueueGraphileJob>[0];
export type StalePhaseRow = {
  readonly phaseRunId: string;
  readonly scanId: string;
  readonly attemptId: string;
  readonly resultId: string | null;
  readonly phase: DownstreamPhase;
  readonly status: "queued" | "running";
  readonly metaJson: Record<string, unknown>;
  readonly readyForRecovery: boolean;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
};
