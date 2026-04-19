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

  it("allows future incremental migrations after the baseline", () => {
    assertMigrationLayout({
      journaledMigrationTags: [
        "0000_initial_schema",
        "0001_add_saved_filters",
        "0002_amused_zeigeist",
        "0003_massive_mephisto",
        "0004_rapid_zaran",
        "0005_open_energizer",
        "0006_polite_leper_queen",
        "0007_loving_jetstream",
      ],
      migrationFiles: [
        "0000_initial_schema",
        "0001_add_saved_filters",
        "0002_amused_zeigeist",
        "0003_massive_mephisto",
        "0004_rapid_zaran",
        "0005_open_energizer",
        "0006_polite_leper_queen",
        "0007_loving_jetstream",
      ],
      snapshotFiles: [
        "0000_snapshot.json",
        "0001_snapshot.json",
        "0002_snapshot.json",
        "0003_snapshot.json",
        "0004_snapshot.json",
        "0005_snapshot.json",
        "0006_snapshot.json",
        "0007_snapshot.json",
      ],
    });
  });

  it("captures the current schema in the baseline migration", () => {
    const migrationsFolder = resolveMigrationsFolder();
    const [baselineMigrationFile] = readdirSync(migrationsFolder).filter((fileName) => fileName.endsWith(".sql")).sort();
    const migrationSql = readFileSync(resolve(migrationsFolder, baselineMigrationFile), "utf8");

    expect(baselineMigrationFile).toMatch(/^0000_.+\.sql$/);
    expect(migrationSql).toContain('CREATE TABLE "instance_settings"');
    expect(migrationSql).toContain('CREATE TABLE "scan_result_nuclei_runs"');
    expect(migrationSql).toContain('CREATE TABLE "scan_result_nuclei_matches"');
    expect(migrationSql).toContain('"api_token_access_enabled" boolean DEFAULT true NOT NULL');
    expect(migrationSql).toContain('"token_hint" text');
    expect(migrationSql).not.toContain('CREATE TABLE "workspaces"');
    expect(migrationSql).not.toContain('CREATE TABLE "workspace_members"');
    expect(migrationSql).not.toContain('"workspace_id" uuid');
  });
});

describe("isRetryableMigrationStartupError", () => {
  it("recognizes retryable node and postgres startup errors through cause chains", () => {
    expect(isRetryableMigrationStartupError(createRetryableError("ECONNREFUSED", "connection refused"))).toBe(true);
    expect(isRetryableMigrationStartupError(createRetryableError("57P03", "the database system is starting up"))).toBe(true);
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
