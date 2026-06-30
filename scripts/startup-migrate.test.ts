// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { isRetryableMigrationStartupError, resolveMigrationsFolder, runRuntimeMigrations } from "./startup-migrate";

type TestConnection = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

function createRetryableError(code: string, message = code) {
  return Object.assign(new Error(message), { code });
}

function createMigrationHarness() {
  const pools: Array<{ connect: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }> = [];

  return {
    createPool: vi.fn(() => {
      const pool = {
        connect: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };

      pools.push(pool);
      return pool;
    }),
    pools,
  };
}

function assertMigrationLayout({
  journaledMigrationTags,
  migrationFiles,
  snapshotFiles,
}: {
  journaledMigrationTags: string[];
  migrationFiles: string[];
  snapshotFiles: string[];
}) {
  expect(journaledMigrationTags).toEqual(migrationFiles);
  expect(journaledMigrationTags[0]).toMatch(/^0000_/);
  expect(snapshotFiles).toEqual(
    migrationFiles.map((_, index) => `${index.toString().padStart(4, "0")}_snapshot.json`),
  );
}

describe("resolveMigrationsFolder", () => {
  it("resolves the checked-in drizzle migrations directory", () => {
    expect(resolveMigrationsFolder()).toBe(resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle/migrations"));
  });

  it("keeps the startup migration journal aligned with checked-in sql files", () => {
    const migrationsFolder = resolveMigrationsFolder();
    const journal = JSON.parse(readFileSync(resolve(migrationsFolder, "meta/_journal.json"), "utf8")) as {
      entries: Array<{ tag: string }>;
    };
    const metaFolder = resolve(migrationsFolder, "meta");

    const journaledMigrationTags = journal.entries.map((entry) => entry.tag);
    const migrationFiles = readdirSync(migrationsFolder)
      .filter((fileName) => fileName.endsWith(".sql"))
      .map((fileName) => fileName.replace(/\.sql$/, ""))
      .sort();
    const snapshotFiles = readdirSync(metaFolder).filter((fileName) => fileName.endsWith("_snapshot.json")).sort();

    assertMigrationLayout({
      journaledMigrationTags,
      migrationFiles,
      snapshotFiles,
    });
  });

  it("keeps custom database setup before dependent indexes", () => {
    const migrationsFolder = resolveMigrationsFolder();
    const migrationFiles = readdirSync(migrationsFolder).filter((fileName) => fileName.endsWith(".sql")).sort();
    const migrationSql = migrationFiles
      .map((fileName) => readFileSync(resolve(migrationsFolder, fileName), "utf8"))
      .join("\n");
    const pgTrgmExtensionIndex = migrationSql.indexOf('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
    const firstTrigramIndex = migrationSql.indexOf("gin_trgm_ops");

    if (firstTrigramIndex !== -1) {
      expect(pgTrgmExtensionIndex).toBeGreaterThanOrEqual(0);
      expect(pgTrgmExtensionIndex).toBeLessThan(firstTrigramIndex);
    }
  });
});

describe("isRetryableMigrationStartupError", () => {
  it("recognizes retryable node and postgres startup errors through cause chains", () => {
    expect(isRetryableMigrationStartupError(createRetryableError("ECONNREFUSED", "connection refused"))).toBe(true);
    expect(isRetryableMigrationStartupError(createRetryableError("57P03", "the database system is starting up"))).toBe(true);
    expect(isRetryableMigrationStartupError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(
      isRetryableMigrationStartupError(
        Object.assign(new Error("migration failed"), {
          cause: createRetryableError("ENOTFOUND", "lookup postgres.railway.internal failed"),
        }),
      ),
    ).toBe(true);
  });

  it("does not treat unrelated errors as retryable", () => {
    expect(isRetryableMigrationStartupError(createRetryableError("28P01", "password authentication failed"))).toBe(false);
    expect(isRetryableMigrationStartupError(new Error("relation \"scans\" does not exist"))).toBe(false);
    expect(isRetryableMigrationStartupError("not an error")).toBe(false);
  });
});

describe("runRuntimeMigrations", () => {
  it("retries transient startup errors and eventually migrates under an advisory lock", async () => {
    const { createPool, pools } = createMigrationHarness();
    const sleep = vi.fn().mockResolvedValue(undefined);
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const firstConnectError = createRetryableError("ECONNREFUSED", "connection refused");
    const secondConnection: TestConnection = {
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };

    createPool.mockImplementationOnce(() => {
      const pool = {
        connect: vi.fn().mockRejectedValue(firstConnectError),
        end: vi.fn().mockResolvedValue(undefined),
      };

      pools.push(pool);
      return pool;
    });

    createPool.mockImplementationOnce(() => {
      const pool = {
        connect: vi.fn().mockResolvedValue(secondConnection),
        end: vi.fn().mockResolvedValue(undefined),
      };

      pools.push(pool);
      return pool;
    });

    const migrateDatabase = vi.fn().mockResolvedValue(undefined);

    await runRuntimeMigrations({
      connectionString: "postgres://example",
      createPool,
      migrateDatabase,
      sleep,
      logger,
      maxAttempts: 2,
      retryDelayMs: 50,
      migrationsFolder: "/tmp/migrations",
    });

    expect(createPool).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(50);
    expect(secondConnection.query).toHaveBeenNthCalledWith(1, "select pg_advisory_lock(hashtext($1))", ["stackray:runtime-migrations"]);
    expect(migrateDatabase).toHaveBeenCalledWith(secondConnection, "/tmp/migrations");
    expect(secondConnection.query).toHaveBeenNthCalledWith(2, "select pg_advisory_unlock(hashtext($1))", ["stackray:runtime-migrations"]);
    expect(secondConnection.release).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(pools[0]?.end).toHaveBeenCalledTimes(1);
    expect(pools[1]?.end).toHaveBeenCalledTimes(1);
  });

  it("fails fast on non-retryable errors", async () => {
    const { createPool, pools } = createMigrationHarness();
    const sleep = vi.fn().mockResolvedValue(undefined);
    const nonRetryableError = createRetryableError("28P01", "password authentication failed");

    createPool.mockImplementationOnce(() => {
      const pool = {
        connect: vi.fn().mockRejectedValue(nonRetryableError),
        end: vi.fn().mockResolvedValue(undefined),
      };

      pools.push(pool);
      return pool;
    });

    await expect(
      runRuntimeMigrations({
        connectionString: "postgres://example",
        createPool,
        sleep,
        maxAttempts: 3,
      }),
    ).rejects.toBe(nonRetryableError);

    expect(createPool).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(pools[0]?.end).toHaveBeenCalledTimes(1);
  });

  it("releases the advisory lock when migration execution fails", async () => {
    const connection: TestConnection = {
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };

    const pool = {
      connect: vi.fn().mockResolvedValue(connection),
      end: vi.fn().mockResolvedValue(undefined),
    };

    const migrateFailure = new Error("migration failed");

    await expect(
      runRuntimeMigrations({
        connectionString: "postgres://example",
        createPool: () => pool,
        migrateDatabase: vi.fn().mockRejectedValue(migrateFailure),
        maxAttempts: 1,
      }),
    ).rejects.toBe(migrateFailure);

    expect(connection.query).toHaveBeenNthCalledWith(1, "select pg_advisory_lock(hashtext($1))", ["stackray:runtime-migrations"]);
    expect(connection.query).toHaveBeenNthCalledWith(2, "select pg_advisory_unlock(hashtext($1))", ["stackray:runtime-migrations"]);
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
