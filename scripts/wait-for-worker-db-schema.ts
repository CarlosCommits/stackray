/*
 * Railway worker database-schema startup gate.
 *
 * Stackray workers can be scheduled before the web service has finished its
 * pre-deploy database migrations during an initial template deploy or a large
 * update. The worker process runs stale-job recovery before it starts polling
 * Graphile Worker, and that recovery queries Stackray app tables such as
 * scans, scan_attempts, and scan_phase_runs. If those tables do not exist yet,
 * the worker crashes.
 *
 * This script is intentionally read-only. It does not run migrations and does
 * not write to the database. It only waits until the minimal app and Graphile
 * Worker tables needed for worker startup are visible, then exits successfully
 * so the real worker process can start.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { Pool } from "pg";

const REQUIRED_RELATIONS = [
  "public.scans",
  "public.scan_attempts",
  "public.scan_phase_runs",
  "graphile_worker.jobs",
] as const;

const WAIT_TIMEOUT_MS = 30 * 60 * 1_000;
const POLL_INTERVAL_MS = 2_000;
const WAITING_LOG_INTERVAL_MS = 30_000;

type MissingRelationRow = {
  relation_name: string;
};

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = join(process.cwd(), fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const contents = readFileSync(filePath, "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();

      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = trimmed.slice(separatorIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

function logEvent(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({
    component: "stackray-worker",
    event,
    ...details,
  }));
}

function describeError(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const code = "code" in error && typeof error.code === "string" ? ` (${error.code})` : "";
  return `${error.message}${code}`;
}

async function findMissingRelations(pool: Pool) {
  const result = await pool.query<MissingRelationRow>(
    `
      select relation_name
      from unnest($1::text[]) as required(relation_name)
      where to_regclass(required.relation_name) is null
      order by relation_name
    `,
    [[...REQUIRED_RELATIONS]],
  );

  return result.rows.map((row) => row.relation_name);
}

export async function waitForWorkerSchema() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before waiting for the worker schema.");
  }

  const startedAt = Date.now();
  const deadline = startedAt + WAIT_TIMEOUT_MS;
  let nextWaitingLogAt = startedAt;

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });

  try {
    while (Date.now() < deadline) {
      try {
        const missingRelations = await findMissingRelations(pool);

        if (missingRelations.length === 0) {
          logEvent("schema_ready", {
            elapsedMs: Date.now() - startedAt,
            relations: [...REQUIRED_RELATIONS],
          });
          return;
        }

        if (Date.now() >= nextWaitingLogAt) {
          logEvent("schema_waiting", {
            elapsedMs: Date.now() - startedAt,
            missingRelations,
          });
          nextWaitingLogAt = Date.now() + WAITING_LOG_INTERVAL_MS;
        }
      } catch (error) {
        if (Date.now() >= nextWaitingLogAt) {
          logEvent("schema_waiting", {
            elapsedMs: Date.now() - startedAt,
            error: describeError(error),
          });
          nextWaitingLogAt = Date.now() + WAITING_LOG_INTERVAL_MS;
        }
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`Timed out after ${WAIT_TIMEOUT_MS}ms waiting for worker database schema.`);
  } finally {
    await pool.end();
  }
}

async function main() {
  loadLocalEnv();
  await waitForWorkerSchema();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
