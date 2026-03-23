import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env/server";

declare global {
  var __stackrayPool: Pool | undefined;
}

const pool =
  globalThis.__stackrayPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__stackrayPool = pool;
}

export const db = drizzle(pool);
export { pool };
