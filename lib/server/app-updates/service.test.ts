import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("app update service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns GitHub release metadata for update details", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toBe("https://api.github.com/repos/CarlosCommits/stackray/releases/latest");

      return Response.json({
        tag_name: "v99.0.0",
        name: "Major scanner update",
        body: "Release notes from GitHub.",
        html_url: "https://github.com/CarlosCommits/stackray/releases/tag/v99.0.0",
        published_at: "2026-05-11T00:00:00Z",
      });
    }));

    const { getStackrayUpdateStatus } = await import("./service");
    const status = await getStackrayUpdateStatus();

    expect(status).toMatchObject({
      updateAvailable: true,
      latestVersion: "99.0.0",
      latestRelease: {
        version: "99.0.0",
        title: "Major scanner update",
        body: "Release notes from GitHub.",
        url: "https://github.com/CarlosCommits/stackray/releases/tag/v99.0.0",
        publishedAt: "2026-05-11T00:00:00Z",
      },
    });
  });

  it("fetches release metadata for the currently deployed version", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toBe("https://api.github.com/repos/CarlosCommits/stackray/releases/tags/v9.9.9");

      return Response.json({
        tag_name: "v9.9.9",
        name: "Current deployment notes",
        body: "What changed in this deployment.",
        html_url: "https://github.com/CarlosCommits/stackray/releases/tag/v9.9.9",
        published_at: "2026-05-10T00:00:00Z",
      });
    }));

    const { getStackrayReleaseByVersion } = await import("./service");
    const release = await getStackrayReleaseByVersion("9.9.9");

    expect(release).toEqual({
      version: "9.9.9",
      title: "Current deployment notes",
      body: "What changed in this deployment.",
      url: "https://github.com/CarlosCommits/stackray/releases/tag/v9.9.9",
      publishedAt: "2026-05-10T00:00:00Z",
    });
  });
});
