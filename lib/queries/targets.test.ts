import { describe, expect, it } from "vitest";

import { targetResultsResponseSchema } from "@/lib/contracts/targets";
import {
  buildTargetRow,
  parseTargetQuery,
} from "@/lib/targets/shared";
import { getMockTargetResults } from "@/lib/mocks/targets";
import {
  TARGET_LATEST_SCAN_LINK_LABEL,
  TARGETS_DEFAULT_PAGE_LIMIT,
  getTargetScanDetailHref,
  type TargetRow,
} from "@/lib/targets/shared";

describe("/targets query contract", () => {
  it("locks the canonical column order from docs/pages.md", () => {
    expect([
      { key: "target", label: "Target" },
      { key: "title", label: "Title" },
      { key: "technologies", label: "Technologies" },
      { key: "lastScannedAt", label: "Last scanned at" },
      { key: "latestScan", label: "Latest scan" },
    ]);
  });

  it("parses default latest mode plus supported filters from query params", () => {
    const query = parseTargetQuery(
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
      timeZone: null,
      cursor: null,
      limit: TARGETS_DEFAULT_PAGE_LIMIT,
    });
  });

  it("parses date-only filters against a supplied browser timezone", () => {
    const query = parseTargetQuery(
      new URLSearchParams("from=2026-06-02&to=2026-06-02&timeZone=America/New_York"),
    );

    expect(query.from).toBe("2026-06-02T04:00:00.000Z");
    expect(query.to).toBe("2026-06-03T03:59:59.999Z");
    expect(query.timeZone).toBe("America/New_York");
  });

  it("ignores legacy mode query params and preserves supported filters", () => {
    const query = parseTargetQuery(new URLSearchParams("mode=snapshots&plugin=jetpack"));

    expect(query.plugin).toEqual(["jetpack"]);
  });

  it("parses theme, cursor, and limit query params", () => {
    const query = parseTargetQuery(new URLSearchParams("theme=storefront&cursor=2&limit=1"));

    expect(query.theme).toEqual(["storefront"]);
    expect(query.cursor).toBe("2");
    expect(query.limit).toBe(1);
  });

  it("returns the latest successful result per canonical target by default", () => {
    const response = getMockTargetResults();

    expect(targetResultsResponseSchema.parse(response)).toEqual(response);
    expect(response.items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_tpss",
      "ctg_01J_target_vercel",
      "ctg_01J_target_wordpress",
      "ctg_01J_target_login",
    ]);
    expect(response.items.map((item) => item.latestScanId)).toEqual([
      "scn_01J_target_tpss_latest",
      "scn_01J_target_vercel_latest",
      "scn_01J_target_wp_latest",
      "scn_01J_target_login_latest",
    ]);
  });

  it("filters latest mode against the latest successful snapshot only", () => {
    const response = getMockTargetResults(new URLSearchParams("plugin=jetpack"));

    expect(response.items).toEqual([
      {
        canonicalTargetId: "ctg_01J_target_wordpress",
        normalizedTarget: "https://cms.example.test",
        latestScanId: "scn_01J_target_wp_latest",
        title: "Blog Tool, Publishing Platform, and CMS",
        technologies: ["WordPress", "PHP", "MySQL"],
        lastScannedAt: "2026-03-21T09:15:00.000Z",
        faviconUrl: "https://cms.example.test/favicon.ico",
        screenshotUrl: "/api/v1/scans/scn_01J_target_wp_latest/results/res_wp_latest/screenshot",
      },
    ]);
  });

  it("ignores a legacy snapshots mode query and still returns latest-only results", () => {
    const response = getMockTargetResults(new URLSearchParams("mode=snapshots&plugin=jetpack"));

    expect(response.items).toEqual([
      {
        canonicalTargetId: "ctg_01J_target_wordpress",
        normalizedTarget: "https://cms.example.test",
        latestScanId: "scn_01J_target_wp_latest",
        title: "Blog Tool, Publishing Platform, and CMS",
        technologies: ["WordPress", "PHP", "MySQL"],
        lastScannedAt: "2026-03-21T09:15:00.000Z",
        faviconUrl: "https://cms.example.test/favicon.ico",
        screenshotUrl: "/api/v1/scans/scn_01J_target_wp_latest/results/res_wp_latest/screenshot",
      },
    ]);
  });

  it("supports free text, technology, cdn, server, cpe, status code, and date range filters", () => {
    expect(getMockTargetResults(new URLSearchParams("q=login")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_login",
    ]);
    expect(
      getMockTargetResults(new URLSearchParams("technology=next.js")).items.map((item) => item.canonicalTargetId),
    ).toEqual(["ctg_01J_target_vercel"]);
    expect(getMockTargetResults(new URLSearchParams("cdn=cloudflare")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_login",
    ]);
    expect(getMockTargetResults(new URLSearchParams("server=nginx")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_wordpress",
    ]);
    expect(getMockTargetResults(new URLSearchParams("cpe=wordpress")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_tpss",
      "ctg_01J_target_wordpress",
    ]);
    expect(getMockTargetResults(new URLSearchParams("statusCode=404")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_login",
    ]);
    expect(
      getMockTargetResults(new URLSearchParams("from=2026-03-21&to=2026-03-22")).items.map(
        (item) => item.canonicalTargetId,
      ),
    ).toEqual(["ctg_01J_target_vercel", "ctg_01J_target_wordpress"]);
  });

  it("supports wordpress theme filters and paginates with cursor/limit", () => {
    expect(getMockTargetResults(new URLSearchParams("theme=storefront")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_tpss",
    ]);

    const response = getMockTargetResults(new URLSearchParams("limit=2"));

    expect(response.items).toHaveLength(2);
    expect(response.nextCursor).toBe("2");

    const secondPage = getMockTargetResults(new URLSearchParams(`limit=2&cursor=${response.nextCursor}`));

    expect(secondPage.items).toHaveLength(2);
  });

  it("excludes non-completed scans from results", () => {
    expect(getMockTargetResults(new URLSearchParams("technology=bullmq")).items).toEqual([]);
  });

  it("matches technology filter against WordPress plugins when selecting plugin values from combobox", () => {
    const latestResponse = getMockTargetResults(new URLSearchParams("technology=jetpack"));
    expect(latestResponse.items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_wordpress",
    ]);

    expect(getMockTargetResults(new URLSearchParams("technology=akismet")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_wordpress",
    ]);

    expect(getMockTargetResults(new URLSearchParams("technology=woocommerce-gateway-stripe")).items.map((item) => item.canonicalTargetId)).toEqual([
      "ctg_01J_target_tpss",
    ]);
  });

  it("builds page-facing rows with target, title, technologies, last scanned at, and latest scan link", () => {
    const result = getMockTargetResults(new URLSearchParams("q=takoma")).items[0];

    expect(result).toBeDefined();

    const row: TargetRow = buildTargetRow(result!);

    expect(row).toEqual({
      canonicalTargetId: "ctg_01J_target_tpss",
      target: "https://primary.example.test",
      title: "Takoma Park Silver Spring Co-op | Your Neighborhood Natural Foods Store",
      technologies: ["WordPress", "WooCommerce", "PHP"],
      lastScannedAt: {
        iso: "2026-03-23T16:00:12.000Z",
      },
      latestScan: {
        scanId: "scn_01J_target_tpss_latest",
        href: getTargetScanDetailHref("scn_01J_target_tpss_latest"),
        label: TARGET_LATEST_SCAN_LINK_LABEL,
        ariaLabel: "Open latest scan for https://primary.example.test",
      },
      faviconUrl: "https://primary.example.test/favicon.ico",
      screenshotUrl: "/api/v1/scans/scn_01J_target_tpss_latest/results/res_tpss_latest/screenshot",
    });
  });
});
