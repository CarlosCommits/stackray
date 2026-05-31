import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../lib/env/server.ts";
import { resolveWorkerConcurrency } from "./worker-config.ts";

const workerConcurrency = resolveWorkerConcurrency(env.STACKRAY_WORKER_ROLE, env.STACKRAY_WORKER_CONCURRENCY);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: Math.max(10, workerConcurrency + 2),
});

export const db = drizzle(pool);
