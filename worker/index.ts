import { pool } from "./db.ts";
import { runWorkerLoop } from "./scan-worker.ts";

const once = process.argv.includes("--once");

try {
  await runWorkerLoop({ once });
} finally {
  await pool.end();
}
