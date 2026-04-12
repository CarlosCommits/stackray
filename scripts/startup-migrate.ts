import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient } from "pg";

import { runGraphileWorkerMigrations } from "../lib/server/jobs/graphile.ts";

type MigrationConnection = {
  query: (queryText: string, values?: unknown[]) => Promise<unknown>;
  release: () => void | Promise<void>;
};

type MigrationPool = {
  connect: () => Promise<MigrationConnection>;
  end: () => Promise<void>;
};

type MigrationLogger = Pick<typeof console, "info" | "warn" | "error">;

type RuntimeMigrationOptions = {
  connectionString?: string;
  migrationsFolder?: string;
  maxAttempts?: number;
  retryDelayMs?: number;
  createPool?: (connectionString: string) => MigrationPool;
  migrateDatabase?: (connection: MigrationConnection, migrationsFolder: string) => Promise<void>;
  sleep?: (delayMs: number) => Promise<void>;
  logger?: MigrationLogger;
};

const RETRYABLE_NODE_ERROR_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"]);
const RETRYABLE_POSTGRES_ERROR_CODES = new Set(["57P03"]);
const DEFAULT_MAX_ATTEMPTS = 20;
const DEFAULT_RETRY_DELAY_MS = 3_000;
const LOCK_ID = "stackray:runtime-migrations";

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

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveMigrationsFolder() {
  return fileURLToPath(new URL("../drizzle/migrations", import.meta.url));
}

export function isRetryableMigrationStartupError(error: unknown) {
  let currentError: unknown = error;

  while (currentError instanceof Error) {
    const retryableError = currentError as Error & { code?: string; cause?: unknown };
    const normalizedMessage = currentError.message.toLowerCase();

    if (retryableError.code && RETRYABLE_NODE_ERROR_CODES.has(retryableError.code)) {
      return true;
    }

    if (retryableError.code && RETRYABLE_POSTGRES_ERROR_CODES.has(retryableError.code)) {
      return true;
    }

    if (
      normalizedMessage.includes("database system is starting up") ||
      normalizedMessage.includes("the database system is starting up")
    ) {
      return true;
    }

    currentError = retryableError.cause;
  }

  return false;
}

function createRuntimePool(connectionString: string): MigrationPool {
  return new Pool({
    connectionString,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
}

async function migrateWithConnection(connection: MigrationConnection, migrationsFolder: string) {
  const db = drizzle(connection as PoolClient);
  await migrate(db, { migrationsFolder });
}

async function withMigrationLock<T>(connection: MigrationConnection, callback: () => Promise<T>) {
  await connection.query("select pg_advisory_lock(hashtext($1))", [LOCK_ID]);

  try {
    return await callback();
  } finally {
    await connection.query("select pg_advisory_unlock(hashtext($1))", [LOCK_ID]);
  }
}

export async function runRuntimeMigrations(options: RuntimeMigrationOptions = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before running runtime migrations.");
  }

  const migrationsFolder = options.migrationsFolder ?? resolveMigrationsFolder();
  const maxAttempts = options.maxAttempts ?? parsePositiveInteger(process.env.STACKRAY_DB_MIGRATION_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS);
  const retryDelayMs = options.retryDelayMs ?? parsePositiveInteger(process.env.STACKRAY_DB_MIGRATION_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS);
  const createPool = options.createPool ?? createRuntimePool;
  const migrateDatabase = options.migrateDatabase ?? migrateWithConnection;
  const delay = options.sleep ?? sleep;
  const logger = options.logger ?? console;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pool = createPool(connectionString);

    try {
      const connection = await pool.connect();

      try {
        await withMigrationLock(connection, async () => {
          await migrateDatabase(connection, migrationsFolder);
        });
      } finally {
        await connection.release();
      }

      logger.info(`Applied database migrations from ${migrationsFolder}.`);
      return;
    } catch (error) {
      if (!isRetryableMigrationStartupError(error) || attempt === maxAttempts) {
        throw error;
      }

      logger.warn(
        `Database was not ready for runtime migrations (attempt ${attempt}/${maxAttempts}). Retrying in ${retryDelayMs}ms.`,
      );

      await delay(retryDelayMs);
    } finally {
      await pool.end();
    }
  }
}

async function main() {
  loadLocalEnv();
  await runRuntimeMigrations();
  await runGraphileWorkerMigrations(process.env.DATABASE_URL!);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
