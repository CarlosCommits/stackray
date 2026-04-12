import { run, runOnce } from "graphile-worker";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const once = process.argv.includes("--once");
const crontab = "* * * * * schedule_due_scans";

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

  const [{ env }, { runGraphileWorkerMigrations }, { pool }, { taskList }] = await Promise.all([
    import("../lib/env/server.ts"),
    import("../lib/server/jobs/graphile.ts"),
    import("./db.ts"),
    import("./tasks.ts"),
  ]);

  await runGraphileWorkerMigrations(env.DATABASE_URL);

  try {
    if (once) {
      await runOnce({
        pgPool: pool,
        taskList,
      });
      return;
    }

    const runner = await run({
      pgPool: pool,
      taskList,
      crontab,
    });

    await runner.promise;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
