import { describe, expect, it } from "vitest";

import {
  SEARCH_COLUMNS,
  SEARCH_LATEST_SCAN_LINK_LABEL,
  getSearchScanDetailHref,
  type SearchRow,
} from "@/components/search/types";
import { searchResultsResponseSchema } from "@/lib/contracts/search";
import {
  buildSearchRow,
  getSearchPageData,
  getSearchResults,
  parseSearchQuery,
} from "@/lib/queries/search";

describe("/search query contract", () => {
  it("locks the canonical column order from docs/pages.md", () => {
    expect(SEARCH_COLUMNS).toEqual([
      { key: "target", label: "Target" },
      { key: "title", label: "Title" },
      { key: "technologies", label: "Technologies" },
      { key: "lastScannedAt", label: "Last scanned at" },
      { key: "latestScan", label: "Latest scan" },
    ]);
  });

  it("parses default latest mode plus supported filters from query params", () => {
    const query = parseSearchQuery(
      new URLSearchParams(
        "q= Takoma &technology=WordPress,WooCommerce&cdn=fastly&server=flywheel&plugin=jetpack&cpe=wordpress&statusCode=200&statusCode=404&from=2026-03-20&to=2026-03-23",
      ),
    );

    expect(query).toEqual({
      q: "takoma",
      technology: ["wordpress", "woocommerce"],
      cdn: ["fastly"],
      server: ["flywheel"],
      plugin: ["jetpack"],
      theme: [],
      cpe: ["wordpress"],
      statusCode: [200, 404],
      from: "2026-03-20T00:00:00.000Z",
      to: "2026-03-23T23:59:59.999Z",
      cursor: null,
      limit: null,
      mode: "latest",
    });
  });

  it("parses snapshots mode explicitly", () => {
    const query = parseSearchQuery(new URLSearchParams("mode=snapshots&plugin=jetpack"));

    expect(query.mode).toBe("snapshots");
    expect(query.plugin).toEqual(["jetpack"]);
  });

  it("parses theme, cursor, and limit query params", () => {
    const query = parseSearchQuery(new URLSearchParams("theme=storefront&cursor=2&limit=1"));

    expect(query.theme).toEqual(["storefront"]);
    expect(query.cursor).toBe("2");
    expect(query.limit).toBe(1);
  });

  it("returns the latest successful result per canonical target by default", () => {
    const response = getSearchResults();

    expect(searchResultsResponseSchema.parse(response)).toEqual(response);
    expect(response.items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_search_tpss",
      "ctg_01J_search_vercel",
      "ctg_01J_search_wordpress",
      "ctg_01J_search_login",
    ]);
    expect(response.items.map((item) => item.latestScanId)).toEqual([
      "scn_01J_search_tpss_latest",
      "scn_01J_search_vercel_latest",
      "scn_01J_search_wp_latest",
      "scn_01J_search_login_latest",
    ]);
  });

  it("filters latest mode against the latest successful snapshot only", () => {
    const response = getSearchResults(new URLSearchParams("plugin=jetpack"));

    expect(response.items).toEqual([
      {
        canonicalTargetId: "ctg_01J_search_wordpress",
        normalizedTarget: "https://cms.example.test",
        latestScanId: "scn_01J_search_wp_latest",
        title: "Blog Tool, Publishing Platform, and CMS",
        technologies: ["WordPress", "PHP", "MySQL"],
        lastScannedAt: "2026-03-21T09:15:00.000Z",
      },
    ]);
  });

  it("returns every matching completed historical snapshot in snapshots mode", () => {
    const response = getSearchResults(new URLSearchParams("mode=snapshots&plugin=jetpack"));

    expect(response.items).toEqual([
      {
        canonicalTargetId: "ctg_01J_search_wordpress",
        normalizedTarget: "https://cms.example.test",
        latestScanId: "scn_01J_search_wp_latest",
        title: "Blog Tool, Publishing Platform, and CMS",
        technologies: ["WordPress", "PHP", "MySQL"],
        lastScannedAt: "2026-03-21T09:15:00.000Z",
      },
      {
        canonicalTargetId: "ctg_01J_search_tpss",
        normalizedTarget: "https://primary.example.test",
        latestScanId: "scn_01J_search_tpss_latest",
        title: "Takoma Park Silver Spring Co-op",
        technologies: ["WordPress", "PHP", "Jetpack"],
        lastScannedAt: "2026-03-20T12:30:00.000Z",
      },
    ]);
  });

  it("supports free text, technology, cdn, server, cpe, status code, and date range filters", () => {
    expect(getSearchResults(new URLSearchParams("q=login")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_search_login",
    ]);
    expect(
      getSearchResults(new URLSearchParams("technology=next.js")).items.map((item) => item.canonicalTargetId),
    ).toEqual(["ctg_01J_search_vercel"]);
    expect(getSearchResults(new URLSearchParams("cdn=cloudflare")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_search_login",
    ]);
    expect(getSearchResults(new URLSearchParams("server=nginx")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_search_wordpress",
    ]);
    expect(getSearchResults(new URLSearchParams("cpe=wordpress")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_search_tpss",
      "ctg_01J_search_wordpress",
    ]);
    expect(getSearchResults(new URLSearchParams("statusCode=404")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_search_login",
    ]);
    expect(
      getSearchResults(new URLSearchParams("from=2026-03-21&to=2026-03-22")).items.map(
        (item) => item.canonicalTargetId,
      ),
    ).toEqual(["ctg_01J_search_vercel", "ctg_01J_search_wordpress"]);
  });

  it("supports wordpress theme filters and paginates with cursor/limit", () => {
    expect(getSearchResults(new URLSearchParams("theme=storefront")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_search_tpss",
    ]);

    const response = getSearchResults(new URLSearchParams("mode=snapshots&limit=2"));

    expect(response.items).toHaveLength(2);
    expect(response.nextCursor).toBe("2");

    const secondPage = getSearchResults(new URLSearchParams(`mode=snapshots&limit=2&cursor=${response.nextCursor}`));

    expect(secondPage.items).toHaveLength(2);
  });

  it("excludes non-completed scans from both latest and snapshots mode", () => {
    expect(getSearchResults(new URLSearchParams("technology=bullmq")).items).toEqual([]);
    expect(getSearchResults(new URLSearchParams("mode=snapshots&technology=bullmq")).items).toEqual([]);
  });

  it("builds page-facing rows with target, title, technologies, last scanned at, and latest scan link", async () => {
    const result = getSearchResults(new URLSearchParams("q=takoma")).items[0];

    expect(result).toBeDefined();

    const row: SearchRow = buildSearchRow(result!);
    const pageData = await getSearchPageData(new URLSearchParams("q=takoma"));

    expect(row).toEqual({
      canonicalTargetId: "ctg_01J_search_tpss",
      target: "https://primary.example.test",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      technologies: ["WordPress", "WooCommerce", "PHP"],
        lastScannedAt: {
          iso: "2026-03-23T16:00:12.000Z",
          label: "Mar 23, 2026, 4:00 PM UTC",
        },
        latestScan: {
          scanId: "scn_01J_search_tpss_latest",
          href: getSearchScanDetailHref("scn_01J_search_tpss_latest"),
          label: SEARCH_LATEST_SCAN_LINK_LABEL,
          ariaLabel: "Open latest scan for https://primary.example.test",
        },
      });
    expect(pageData.query.mode).toBe("latest");
    expect(pageData.rows).toEqual([row]);
  });
});
