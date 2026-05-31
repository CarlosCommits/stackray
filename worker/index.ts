import { run, runOnce } from "graphile-worker";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const once = process.argv.includes("--once");
const crontab = "* * * * * schedule_due_scans";

function roleUsesCron(role: string) {
  return role === "all" || role === "intel";
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

async function main() {
  loadLocalEnv();

  const [
    { env },
    { runGraphileWorkerMigrations },
    { pool },
    { taskList },
    { waitForPendingIpEnrichments },
    { resolveWorkerConcurrency, selectTaskListForRole },
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

  console.info(JSON.stringify({
    component: "stackray-worker",
    event: "worker_starting",
    role: env.STACKRAY_WORKER_ROLE,
    concurrency,
    tasks: Object.keys(selectedTaskList),
  }));

  try {
    if (once) {
      let jobStarted = true;

      while (jobStarted) {
        const events = new EventEmitter();
        jobStarted = false;
        events.on("job:start", () => {
          jobStarted = true;
        });

        await runOnce({
          pgPool: pool,
          taskList: selectedTaskList,
          events,
        });
      }

      return;
    }

    const runner = await run({
      pgPool: pool,
      taskList: selectedTaskList,
      ...(roleUsesCron(env.STACKRAY_WORKER_ROLE) ? { crontab } : { parsedCronItems: [] }),
      concurrency,
    });

    await runner.promise;
  } finally {
    try {
      await waitForPendingIpEnrichments();
    } catch (error) {
      console.warn(`Timed out waiting for pending IP enrichment: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
