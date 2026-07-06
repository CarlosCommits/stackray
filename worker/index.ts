import { run, runOnce } from "graphile-worker";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const once = process.argv.includes("--once");
const crontab = "* * * * * schedule_due_scans";
const staleRecoveryIntervalMs = 60_000;
const downstreamRecoverableTasks = ["headless", "browser_fallback", "subfinder", "nuclei_dns", "nuclei_http", "ip_intel", "finalize"] as const;

type RecoveryHandler = () => Promise<number>;

function roleUsesCron(role: string) {
  return role === "all" || role === "intel";
}

function taskListOwnsAny(taskList: object, taskNames: readonly string[]) {
  return taskNames.some((taskName) => taskName in taskList);
}

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

export async function startWorker() {
  loadLocalEnv();

  const [
    { env },
    { runGraphileWorkerMigrations },
    { pool },
    { taskList },
    { waitForPendingIpEnrichments },
    { resolveForbiddenGraphileJobFlags, resolveWorkerConcurrency, selectTaskListForRole },
  ] = await Promise.all([
    import("../lib/env/server.ts"),
    import("../lib/server/jobs/graphile.ts"),
    import("./db.ts"),
    import("./tasks.ts"),
    import("./ip-enrichment.ts"),
    import("./worker-config.ts"),
  ]);

  await runGraphileWorkerMigrations(env.DATABASE_URL);
  const selectedTaskList = selectTaskListForRole(taskList, env.STACKRAY_WORKER_ROLE);
  const concurrency = resolveWorkerConcurrency(env.STACKRAY_WORKER_ROLE, env.STACKRAY_WORKER_CONCURRENCY);
  const forbiddenFlags = resolveForbiddenGraphileJobFlags();

  const recoversHttpProbeJobs = taskListOwnsAny(selectedTaskList, ["http_probe", "run_scan"]);
  const recoversDownstreamPhaseJobs = taskListOwnsAny(selectedTaskList, downstreamRecoverableTasks);
  const recoveryModule = recoversHttpProbeJobs || recoversDownstreamPhaseJobs
    ? await import("./scan-worker.ts")
    : null;
  const recoveryHandlers: RecoveryHandler[] = [];
  if (recoversHttpProbeJobs && recoveryModule) {
    recoveryHandlers.push(recoveryModule.recoverStaleHttpProbeJobs);
  }
  if (recoversDownstreamPhaseJobs && recoveryModule) {
    recoveryHandlers.push(recoveryModule.recoverStaleScanPhaseJobs);
  }

  const recoverStaleScanJobs = recoveryHandlers.length > 0
    ? async () => {
      for (const recover of recoveryHandlers) {
        await recover();
      }
    }
    : null;

  if (recoverStaleScanJobs) {
    await recoverStaleScanJobs();
  }

  console.info(JSON.stringify({
    component: "stackray-worker",
    event: "worker_starting",
    role: env.STACKRAY_WORKER_ROLE,
    concurrency,
    tasks: Object.keys(selectedTaskList),
    forbiddenFlags,
  }));

  let recoveryInterval: NodeJS.Timeout | null = null;

  try {
    if (once) {
      let jobStarted = true;

      while (jobStarted) {
        if (recoverStaleScanJobs) {
          await recoverStaleScanJobs();
        }

        const events = new EventEmitter();
        jobStarted = false;
        events.on("job:start", () => {
          jobStarted = true;
        });

        await runOnce({
          pgPool: pool,
          taskList: selectedTaskList,
          events,
          forbiddenFlags,
        });
      }

      return;
    }

    let recoveryInFlight = false;
    recoveryInterval = recoverStaleScanJobs
      ? setInterval(() => {
        if (recoveryInFlight) {
          return;
        }

        recoveryInFlight = true;
        recoverStaleScanJobs()
          .catch((error) => {
            console.error(JSON.stringify({
              component: "stackray-worker",
              event: "stale_scan_recovery_failed",
              message: error instanceof Error ? error.message : String(error),
            }));
          })
          .finally(() => {
            recoveryInFlight = false;
          });
      }, staleRecoveryIntervalMs)
      : null;

    recoveryInterval?.unref();

    const runner = await run({
      pgPool: pool,
      taskList: selectedTaskList,
      ...(roleUsesCron(env.STACKRAY_WORKER_ROLE) ? { crontab } : { parsedCronItems: [] }),
      concurrency,
      forbiddenFlags,
    });

    await runner.promise;
  } finally {
    if (recoveryInterval) {
      clearInterval(recoveryInterval);
    }

    try {
      await waitForPendingIpEnrichments();
    } catch (error) {
      console.warn(`Timed out waiting for pending IP enrichment: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await pool.end();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startWorker().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
