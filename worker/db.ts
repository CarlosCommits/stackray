import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../lib/env/server.ts";
import { resolveWorkerConcurrency } from "./worker-config.ts";

const workerConcurrency = resolveWorkerConcurrency(env.STACKRAY_WORKER_ROLE, env.STACKRAY_WORKER_CONCURRENCY);

function logPostgresPoolError(error: unknown) {
  console.error(JSON.stringify({
    component: "stackray-worker",
    event: "postgres_pool_error",
    message: error instanceof Error ? error.message : String(error),
  }));
}

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: Math.max(10, workerConcurrency + 2),
});

pool.on("error", logPostgresPoolError);
pool.on("connect", (client) => {
  client.on("error", logPostgresPoolError);
});

export const db = drizzle(pool);
