import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "@/lib/session/actor-context";
import { listCompletedResultSnapshots, type CompletedResultSnapshot } from "@/lib/server/scans/read-service";
import { getTargetFilterOptions, getTargetResults, getTargetsPageResult, getTechnologyComparisonResults } from "@/lib/server/targets/service";

const selectDistinctOnMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());

function createQueryChain<T>(result: T) {
  const promise = Promise.resolve(result);
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    [Symbol.toStringTag]: "Promise",
  };

  return chain;
}

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock,
    selectDistinctOn: selectDistinctOnMock,
  },
}));

vi.mock("@/lib/server/scans/read-service", () => ({
  listCompletedResultSnapshots: vi.fn(),
}));

const listCompletedResultSnapshotsMock = vi.mocked(listCompletedResultSnapshots);
const actor = {
  user: {
    id: "usr_test",
    email: "operator@stackray.test",
    displayName: "Operator",
    image: null,
    role: "admin",
  },
  apiKeyAccessEnabled: true,
  requiresPasswordChange: false,
  source: "ui",
  apiKey: null,
} satisfies ActorContext;

function snapshot(overrides: Partial<CompletedResultSnapshot>): CompletedResultSnapshot {
  return {
    resultId: "res_test",
    scanId: "scn_test",
    canonicalTargetId: "ctg_test",
    inputTarget: "example.com",
    normalizedTarget: "example.com",
    resultInput: "example.com",
    resultUrl: "https://example.com",
    resultFinalUrl: "https://example.com/",
    resultHost: "example.com",
    searchDocument: "",
    title: "Example",
    technologies: [],
    technologyCount: 0,
    wordpressPlugins: [],
    wordpressThemes: [],
    cpe: [],
    statusCode: 200,
    server: null,
    cdn: null,
    completedAt: "2026-05-27T12:00:00.000Z",
    faviconUrl: null,
    screenshotUrl: null,
    ...overrides,
  };
}

describe("technology comparison results", () => {
  beforeEach(() => {
    listCompletedResultSnapshotsMock.mockReset();
    selectDistinctOnMock.mockReset();
    selectMock.mockReset();
  });

  it("requires distinct exact technology matches for multi-technology comparisons", async () => {
    selectDistinctOnMock.mockReturnValueOnce(createQueryChain([
      { id: "scn_native" },
      { id: "scn_both" },
    ]));
    listCompletedResultSnapshotsMock.mockResolvedValue([
      snapshot({
        canonicalTargetId: "ctg_react_native_only",
        normalizedTarget: "native.example",
        technologies: ["React Native"],
      }),
      snapshot({
        canonicalTargetId: "ctg_react_and_native",
        normalizedTarget: "both.example",
        technologies: ["React", "React Native"],
      }),
    ]);

    const response = await getTechnologyComparisonResults(
      actor,
      new URLSearchParams("technology=React&technology=React%20Native"),
    );

    expect(response.items.map((item) => item.canonicalTargetId)).toEqual(["ctg_react_and_native"]);
    expect(response.items[0]?.matchedTechnologies.map((technology) => technology.name)).toEqual([
      "React",
      "React Native",
    ]);
  });
});

describe("target results", () => {
  beforeEach(() => {
    listCompletedResultSnapshotsMock.mockReset();
    selectDistinctOnMock.mockReset();
    selectMock.mockReset();
  });

  it("uses completed snapshots for latest-target filtering", async () => {
    selectMock.mockReturnValue(createQueryChain([]));
    selectDistinctOnMock
      .mockReturnValueOnce(createQueryChain([{ canonicalTargetId: "ctg_wordpress" }]))
      .mockReturnValueOnce(createQueryChain([{ id: "scn_wordpress" }]));
    listCompletedResultSnapshotsMock.mockResolvedValue([
      snapshot({
        canonicalTargetId: "ctg_wordpress",
        scanId: "scn_wordpress",
        normalizedTarget: "cms.example.test",
        title: "WordPress",
        technologies: ["WordPress", "PHP"],
        wordpressPlugins: ["jetpack"],
        statusCode: 200,
        server: "nginx",
        cdn: "cloudflare",
        completedAt: "2026-05-27T12:00:00.000Z",
        faviconUrl: "/favicon.ico",
        screenshotUrl: "/api/v1/scans/scn_wordpress/results/res_wordpress/screenshot",
      }),
    ]);

    const response = await getTargetResults(actor, new URLSearchParams("plugin=jetpack&limit=1"));

    expect(selectDistinctOnMock).toHaveBeenCalledTimes(2);
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(actor, ["scn_wordpress"]);
    expect(response).toEqual({
      items: [
        {
          canonicalTargetId: "ctg_wordpress",
          normalizedTarget: "cms.example.test",
          latestScanId: "scn_wordpress",
          title: "WordPress",
          technologies: ["WordPress", "PHP"],
          lastScannedAt: "2026-05-27T12:00:00.000Z",
          faviconUrl: "/favicon.ico",
          screenshotUrl: "/api/v1/scans/scn_wordpress/results/res_wordpress/screenshot",
        },
      ],
      nextCursor: null,
    });
  });

  it("uses SQL candidate narrowing for target identity free-text searches", async () => {
    selectMock.mockReturnValue(createQueryChain([]));
    selectDistinctOnMock
      .mockReturnValueOnce(createQueryChain([{ canonicalTargetId: "ctg_wordpress" }]))
      .mockReturnValueOnce(createQueryChain([{ id: "scn_wordpress" }]));
    listCompletedResultSnapshotsMock.mockResolvedValue([
      snapshot({
        canonicalTargetId: "ctg_wordpress",
        scanId: "scn_wordpress",
        inputTarget: "cms.example.test",
        normalizedTarget: "cms.example.test",
        resultHost: "cms.example.test",
        title: "WordPress",
        technologies: ["WordPress", "PHP"],
      }),
      snapshot({
        canonicalTargetId: "ctg_other",
        scanId: "scn_other",
        normalizedTarget: "example.org",
        title: "Example",
        technologies: ["React"],
      }),
    ]);

    const response = await getTargetResults(actor, new URLSearchParams("q=cms.example&limit=1"));

    expect(selectDistinctOnMock).toHaveBeenCalledTimes(2);
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(actor, ["scn_wordpress"]);
    expect(response.items.map((item) => item.canonicalTargetId)).toEqual(["ctg_wordpress"]);
  });

  it("does not match target free-text against broad result evidence", async () => {
    selectMock.mockReturnValue(createQueryChain([]));
    selectDistinctOnMock.mockReturnValueOnce(createQueryChain([]));
    listCompletedResultSnapshotsMock.mockResolvedValue([
      snapshot({
        canonicalTargetId: "ctg_hash",
        normalizedTarget: "fingerprint.example",
        title: "Fingerprint Example",
        searchDocument: "redirect https://final.example AS15169 jarm:fad2b2f favicon:mmh3:12345",
      }),
      snapshot({
        canonicalTargetId: "ctg_other",
        normalizedTarget: "example.org",
        title: "Example",
        searchDocument: "react nginx",
      }),
    ]);

    const response = await getTargetResults(actor, new URLSearchParams("q=AS15169&limit=1"));

    expect(selectDistinctOnMock).toHaveBeenCalledTimes(1);
    expect(listCompletedResultSnapshotsMock).not.toHaveBeenCalled();
    expect(response.items).toEqual([]);
  });

  it("falls back to helper-safe hydration for derived server and cdn filters", async () => {
    selectDistinctOnMock.mockReturnValueOnce(createQueryChain([{ id: "scn_vercel" }]));
    listCompletedResultSnapshotsMock.mockResolvedValue([
      snapshot({
        canonicalTargetId: "ctg_vercel",
        scanId: "scn_vercel",
        normalizedTarget: "app.example.test",
        title: "Vercel",
        server: "Vercel",
        cdn: "Vercel Edge",
      }),
    ]);

    const response = await getTargetResults(actor, new URLSearchParams("server=vercel&cdn=edge&limit=1"));

    expect(selectDistinctOnMock).toHaveBeenCalledTimes(1);
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(actor, ["scn_vercel"]);
    expect(response.items.map((item) => item.canonicalTargetId)).toEqual(["ctg_vercel"]);
  });

  it("builds target filter options from latest completed snapshots", async () => {
    selectDistinctOnMock.mockReturnValueOnce(createQueryChain([
      { id: "scn_shop_latest" },
      { id: "scn_app_latest" },
    ]));
    listCompletedResultSnapshotsMock.mockResolvedValue([
      snapshot({
        canonicalTargetId: "ctg_shop",
        scanId: "scn_shop_latest",
        normalizedTarget: "shop.example",
        technologies: ["WordPress", "WooCommerce"],
        wordpressPlugins: ["woocommerce-gateway-stripe"],
        wordpressThemes: ["storefront"],
        cpe: ["cpe:2.3:a:woocommerce:woocommerce:8.5.2:*:*:*:*:*:*:*"],
        statusCode: 200,
        server: "Flywheel/5.1.0",
        cdn: "fastly",
        completedAt: "2026-05-28T12:00:00.000Z",
      }),
      snapshot({
        canonicalTargetId: "ctg_shop",
        scanId: "scn_shop_previous",
        normalizedTarget: "shop.example",
        technologies: ["WordPress", "PHP"],
        wordpressPlugins: ["jetpack"],
        wordpressThemes: ["co-op-classic"],
        statusCode: 200,
        server: "nginx",
        cdn: "cloudflare",
        completedAt: "2026-05-27T12:00:00.000Z",
      }),
      snapshot({
        canonicalTargetId: "ctg_app",
        scanId: "scn_app_latest",
        normalizedTarget: "app.example",
        technologies: ["Next.js", "React"],
        wordpressPlugins: [],
        wordpressThemes: [],
        cpe: ["cpe:2.3:a:vercel:next.js:16.0.0:*:*:*:*:*:*:*"],
        statusCode: 404,
        server: "Vercel",
        cdn: "Vercel Edge",
        completedAt: "2026-05-28T13:00:00.000Z",
      }),
    ]);

    const response = await getTargetFilterOptions(actor);

    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(actor, [
      "scn_shop_latest",
      "scn_app_latest",
    ]);

    expect(response.technology.map((option) => option.value)).toContain("woocommerce-gateway-stripe");
    expect(response.plugin).toEqual([
      { label: "WooCommerce Gateway Stripe", value: "woocommerce-gateway-stripe", matchCount: 1 },
    ]);
    expect(response.theme).toEqual([
      { label: "Storefront", value: "storefront", matchCount: 1 },
    ]);
    expect(response.cdn.map((option) => option.value)).toEqual(expect.arrayContaining(["fastly", "vercel edge"]));
    expect(response.server.map((option) => option.value)).toEqual(expect.arrayContaining(["flywheel/5.1.0", "vercel"]));
    expect(response.statusCode).toEqual([
      { label: "200", value: "200", matchCount: 1 },
      { label: "404", value: "404", matchCount: 1 },
    ]);
    expect(response.plugin.some((option) => option.value === "jetpack")).toBe(false);
    expect(response.theme.some((option) => option.value === "co-op-classic")).toBe(false);
  });

  it("hydrates target page rows and filter options from one snapshot read", async () => {
    selectMock.mockReturnValue(createQueryChain([]));
    selectDistinctOnMock
      .mockReturnValueOnce(createQueryChain([{ canonicalTargetId: "ctg_wordpress" }]))
      .mockReturnValueOnce(createQueryChain([{ id: "scn_wordpress" }]));
    listCompletedResultSnapshotsMock.mockResolvedValue([
      snapshot({
        canonicalTargetId: "ctg_wordpress",
        scanId: "scn_wordpress",
        normalizedTarget: "cms.example.test",
        title: "WordPress",
        technologies: ["WordPress", "PHP"],
        wordpressPlugins: ["jetpack"],
        wordpressThemes: ["twentytwentyfour"],
        statusCode: 200,
        server: "nginx",
        cdn: null,
        completedAt: "2026-05-28T12:00:00.000Z",
      }),
      snapshot({
        canonicalTargetId: "ctg_app",
        scanId: "scn_app",
        normalizedTarget: "app.example",
        title: "App",
        technologies: ["Next.js", "React"],
        wordpressPlugins: [],
        wordpressThemes: [],
        statusCode: 404,
        server: "Vercel",
        cdn: "Vercel Edge",
        completedAt: "2026-05-27T12:00:00.000Z",
      }),
    ]);

    const response = await getTargetsPageResult(actor, new URLSearchParams("plugin=jetpack&limit=1"));

    expect(selectDistinctOnMock).toHaveBeenCalledTimes(2);
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(actor, ["scn_wordpress"]);
    expect(response.results.items.map((item) => item.canonicalTargetId)).toEqual(["ctg_wordpress"]);
    expect(response.filterOptions.plugin).toEqual([
      { label: "Jetpack", value: "jetpack", matchCount: 0 },
    ]);
    expect(response.filterOptions.technology).toEqual([]);
  });
});
