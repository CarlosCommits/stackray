// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { scanChangeItems, scanComparisons, scanResults, scans } from "@/drizzle/schema";

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
    expect(getIndexColumns(scanComparisons).get("idx_scan_comparisons_target_created_at")).toEqual([
      "canonical_target_id",
      "created_at",
    ]);
    expect(getIndexColumns(scanChangeItems).get("idx_scan_change_items_comparison_category")).toEqual([
      "comparison_id",
      "category",
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
    expect(migrationSql).toContain('CREATE INDEX "idx_scan_comparisons_target_created_at"');
    expect(migrationSql).toContain('CREATE INDEX "idx_scan_comparisons_feed_current_scan"');
    expect(migrationSql).toContain('CREATE INDEX "idx_scans_completed_at_id"');
    expect(migrationSql).toContain('CREATE INDEX "idx_scan_change_items_comparison_category"');
  });

  it("keeps change-feed hydration and scan-detail evidence bounded", () => {
    const changeServiceSource = readFileSync(
      resolve(process.cwd(), "lib/server/changes/service.ts"),
      "utf8",
    );

    expect(changeServiceSource).toContain("CHANGE_FEED_MAX_LIMIT + 1 : limit + 1");
    expect(changeServiceSource).toContain("const CHANGE_FEED_ITEM_LIMIT = 100;");
    expect(changeServiceSource).toContain(".where(lte(rankedItems.itemRank, options.itemLimit))");
    expect(changeServiceSource).toContain("itemLimit: CHANGE_FEED_PREVIEW_LIMIT");
    expect(changeServiceSource).toContain("notInArray(scanChangeItems.changeType, RETIRED_CHANGE_TYPES)");
    expect(changeServiceSource).toContain(".limit(2_000)");
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
