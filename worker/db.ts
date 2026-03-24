import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../lib/env/server.ts";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool);
