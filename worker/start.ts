/*
 * Railway worker runtime entrypoint.
 *
 * Workers need the Stackray app schema and Graphile Worker schema to exist before
 * they run startup recovery and begin polling jobs. Railway service start command
 * overrides should invoke this single Node entrypoint instead of shell-chaining a
 * separate schema wait command with worker/index.ts; that keeps the process alive
 * as the actual worker after the read-only schema gate succeeds.
 */

import { loadLocalEnv, waitForWorkerSchema } from "../scripts/wait-for-worker-db-schema.ts";
import { startWorker } from "./index.ts";

loadLocalEnv();
await waitForWorkerSchema();
await startWorker();
