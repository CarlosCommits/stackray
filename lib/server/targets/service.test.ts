import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActorContext } from "@/lib/session/actor-context";
import { listCompletedResultSnapshots, type CompletedResultSnapshot } from "@/lib/server/scans/read-service";
import { getTechnologyComparisonResults } from "@/lib/server/targets/service";

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
