// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { scanResults, scans } from "@/drizzle/schema";

function getIndexColumns(table: AnyPgTable) {
  return new Map(
    getTableConfig(table).indexes.map((tableIndex) => [
      tableIndex.config.name,
      tableIndex.config.columns.map((column) => {
        if (!("name" in column) || typeof column.name !== "string") {
          throw new Error(`Expected a named column in index ${tableIndex.config.name}`);
        }

        return column.name;
      }),
    ]),
  );
}

describe("database access performance contracts", () => {
  it("keeps the indexes required by scan-detail and target-history reads", () => {
    expect(getIndexColumns(scanResults).get("idx_scan_results_attempt_id")).toEqual([
      "attempt_id",
    ]);
    expect(getIndexColumns(scans).get("idx_scans_canonical_target_status_completed_at")).toEqual([
      "canonical_target_id",
      "status",
      "completed_at",
    ]);
  });

  it("keeps the required indexes in checked-in runtime migrations", () => {
    const migrationsDirectory = resolve(process.cwd(), "drizzle/migrations");
    const migrationSql = readdirSync(migrationsDirectory)
      .filter((fileName) => fileName.endsWith(".sql"))
      .toSorted()
      .map((fileName) => readFileSync(resolve(migrationsDirectory, fileName), "utf8"))
      .join("\n");

    expect(migrationSql).toContain('CREATE INDEX "idx_scan_results_attempt_id"');
    expect(migrationSql).toContain('CREATE INDEX "idx_scans_canonical_target_status_completed_at"');
  });

  it("keeps request-scoped caches on shared authentication and scan reads", () => {
    const actorContextSource = readFileSync(
      resolve(process.cwd(), "lib/session/actor-context.ts"),
      "utf8",
    );
    const scanReadSource = readFileSync(
      resolve(process.cwd(), "lib/server/scans/read-service.ts"),
      "utf8",
    );

    expect(actorContextSource).toContain("const getCachedActorContext = cache(");
    expect(scanReadSource).toContain("const getCachedScanRecord = cache(");
    expect(scanReadSource).toContain("const getAttemptsForScan = cache(");
    expect(scanReadSource).toContain("const getLatestAttemptForScan = cache(");
    expect(scanReadSource).toContain("const getSubdomainDiscoveryRunForAttempt = cache(");
    expect(scanReadSource).toContain("const getResultsForAttempt = cache(");
  });
});
