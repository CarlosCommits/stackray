import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "@/lib/session/actor-context";
import { listCompletedResultSnapshots, type CompletedResultSnapshot } from "@/lib/server/scans/read-service";
import { getTargetResults, getTechnologyComparisonResults } from "@/lib/server/targets/service";

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
    normalizedTarget: "example.com",
    searchDocument: "",
    title: "Example",
    technologies: [],
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

  it("falls back to helper-safe hydration for free-text searches", async () => {
    listCompletedResultSnapshotsMock.mockResolvedValue([
      snapshot({
        canonicalTargetId: "ctg_wordpress",
        scanId: "scn_wordpress",
        normalizedTarget: "cms.example.test",
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

    const response = await getTargetResults(actor, new URLSearchParams("q=wordpress&limit=1"));

    expect(selectDistinctOnMock).not.toHaveBeenCalled();
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(actor);
    expect(response.items.map((item) => item.canonicalTargetId)).toEqual(["ctg_wordpress"]);
  });

  it("matches target free-text against the stored result search document", async () => {
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

    expect(selectDistinctOnMock).not.toHaveBeenCalled();
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(actor);
    expect(response.items.map((item) => item.canonicalTargetId)).toEqual(["ctg_hash"]);
  });

  it("falls back to helper-safe hydration for derived server and cdn filters", async () => {
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

    expect(selectDistinctOnMock).not.toHaveBeenCalled();
    expect(listCompletedResultSnapshotsMock).toHaveBeenCalledWith(actor);
    expect(response.items.map((item) => item.canonicalTargetId)).toEqual(["ctg_vercel"]);
  });
});
