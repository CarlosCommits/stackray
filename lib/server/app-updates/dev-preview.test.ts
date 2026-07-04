import { describe, expect, it } from "vitest";

import { getStackrayReleaseNoticePreview, getStackrayUpdatePreviewStatus } from "./dev-preview";

describe("dev app update preview", () => {
  it("returns a synthetic update status for local UI review", () => {
    const status = getStackrayUpdatePreviewStatus("1.2.3");

    expect(status).toMatchObject({
      updateAvailable: true,
      fingerprint: "stackray-dev-preview:1.2.3>1.2.4",
      currentVersion: "1.2.3",
      latestVersion: "1.2.4",
      latestUrl: "https://github.com/CarlosCommits/stackray/releases",
      latestRelease: {
        version: "1.2.4",
        title: "Stackray 1.2.4",
      },
    });
    expect(status.latestRelease?.body).toContain("### Features");
    expect(status.latestRelease?.body).toContain("### Bug Fixes");
    expect(status.latestRelease?.body?.match(/^\* \*\*/gm)).toHaveLength(20);
  });

  it("falls back to a preview suffix for non-semver versions", () => {
    const status = getStackrayUpdatePreviewStatus("local");

    expect(status.latestVersion).toBe("local-preview");
    expect(status.fingerprint).toBe("stackray-dev-preview:local>local-preview");
  });

  it("returns synthetic release metadata for the post-update notice", () => {
    const release = getStackrayReleaseNoticePreview("1.2.3");

    expect(release).toMatchObject({
      version: "1.2.3",
      title: "Stackray 1.2.3",
      url: "https://github.com/CarlosCommits/stackray/releases",
    });
    expect(release.body).toContain("### Features");
    expect(release.body).toContain("### Bug Fixes");
    expect(release.body?.match(/^\* \*\*/gm)).toHaveLength(20);
  });
});
