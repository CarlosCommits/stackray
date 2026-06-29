import { runMigrations } from "graphile-worker";
import { sql, type SQL } from "drizzle-orm";

type GraphileExecutor = {
  execute: (query: SQL) => Promise<unknown>;
};

type GraphileJobKeyMode = "replace" | "preserve_run_at" | "unsafe_dedupe";

export type EnqueueGraphileJobOptions = {
  jobKey?: string;
  jobKeyMode?: GraphileJobKeyMode;
  queueName?: string;
  flags?: string[];
  runAt?: Date;
  maxAttempts?: number;
};

export async function runGraphileWorkerMigrations(connectionString: string) {
  await runMigrations({ connectionString });
}

export async function enqueueGraphileJob(
  executor: GraphileExecutor,
  identifier: string,
  payload: unknown,
  options: EnqueueGraphileJobOptions = {},
) {
  const argumentsList: SQL[] = [
    sql`${identifier}`,
    sql`${JSON.stringify(payload)}::json`,
  ];

  if (options.queueName) {
    argumentsList.push(sql`queue_name := ${options.queueName}`);
  }

  if (options.runAt) {
    argumentsList.push(sql`run_at := ${options.runAt}`);
  }

  if (options.maxAttempts !== undefined) {
    argumentsList.push(sql`max_attempts := ${options.maxAttempts}`);
  }

  if (options.flags && options.flags.length > 0) {
    argumentsList.push(sql`flags := array[${sql.join(options.flags.map((flag) => sql`${flag}`), sql`, `)}]::text[]`);
  }

  if (options.jobKey) {
    argumentsList.push(sql`job_key := ${options.jobKey}`);
  }

  if (options.jobKeyMode) {
    argumentsList.push(sql`job_key_mode := ${options.jobKeyMode}`);
  }

  await executor.execute(sql`select graphile_worker.add_job(${sql.join(argumentsList, sql`, `)})`);
}
