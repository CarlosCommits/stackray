import type { StackrayReleaseMetadata, StackrayUpdateStatus } from "@/lib/contracts/app-updates";
import { APP_VERSION } from "@/lib/version";

const DEV_UPDATE_PREVIEW_CHECKED_AT = "2026-05-08T00:00:00.000Z";

function getMockReleaseNotes(version: string) {
  return [
    `## [${version}](https://github.com/CarlosCommits/stackray/compare/v0.1.0...v${version}) (2026-07-04)`,
    "",
    "### Features",
    "",
    "* **scans:** expand custom technology metadata ([de653ea](https://github.com/CarlosCommits/stackray/commit/de653ea6760d019e4bd60d0a336fa052e3ba8aef))",
    "* **scans:** expand custom Wappalyzer fingerprints ([824c2ef](https://github.com/CarlosCommits/stackray/commit/824c2ef48576310b5fb21d6294f619d2a8794583))",
    "* **settings:** add account password page ([5df8208](https://github.com/CarlosCommits/stackray/commit/5df8208fc443d76dc1adeb6908d2424349a78e00))",
    "* **shell:** expose account settings navigation ([b60f9ec](https://github.com/CarlosCommits/stackray/commit/b60f9ec19fab0826db53008efc3feb7e721968b9))",
    "* **worker:** add DNS and Payload CMS detections ([dd3031c](https://github.com/CarlosCommits/stackray/commit/dd3031c3a9c4f9cb0fc12ec73203df8f70c0c669))",
    "",
    "### Bug Fixes",
    "",
    "* **auth:** revoke sessions on password change ([a81d5be](https://github.com/CarlosCommits/stackray/commit/a81d5be6fefa4a2d11178941915e4bd2f3b8151c))",
    "* **compare:** avoid stale items after clearing technologies ([dd1834c](https://github.com/CarlosCommits/stackray/commit/dd1834c332dbc4f7946cef13fe70b94bf56bafa5))",
    "* **dashboard:** align scan technology counts ([625c73e](https://github.com/CarlosCommits/stackray/commit/625c73e0a39e97e78e551a7bb4b26f664b673c28))",
    "* **dashboard:** keep recent scan cards compact ([b90103b](https://github.com/CarlosCommits/stackray/commit/b90103b5310b8a71c0b1e2c9128518e46ccdd3b4))",
    "* **dashboard:** skip unchanged recent scan refresh ([a839462](https://github.com/CarlosCommits/stackray/commit/a839462c927b6d60bdb0154b7f8bbb93bb137295))",
    "* **dashboard:** stabilize recent scan refreshes ([398ef7d](https://github.com/CarlosCommits/stackray/commit/398ef7da0d1275f499a867285d1d2ae7a61b9b66))",
    "* **events:** allow queued events without attempts ([bc7c263](https://github.com/CarlosCommits/stackray/commit/bc7c263ba18796cdb3be4aa0c861ff8d4aff4fed))",
    "* **jobs:** add Graphile job removal helper ([03a9c8b](https://github.com/CarlosCommits/stackray/commit/03a9c8b15f6a385c7f19a32ff93f83106e3d1d10))",
    "* **scans:** avoid scan detail prop-state effects ([8f2af60](https://github.com/CarlosCommits/stackray/commit/8f2af60b33dc69b3649fab0143614a4ed19b70cd))",
    "* **scans:** emit queued status helper payloads ([1b9a2f8](https://github.com/CarlosCommits/stackray/commit/1b9a2f8c78e34feabc07659a5b2fb93035f116aa))",
    "* **scans:** render terminal status badges statically ([41b1ac5](https://github.com/CarlosCommits/stackray/commit/41b1ac53d369c2ae47bd47db6b5c6aabc2bc5859))",
    "* **scans:** round screenshot preview frame ([6892a5f](https://github.com/CarlosCommits/stackray/commit/6892a5fe94c4a33e02e1fcaae9e1d038a58069a9))",
    "* **scans:** sort result decorations deterministically ([ffa38bf](https://github.com/CarlosCommits/stackray/commit/ffa38bf30ed956675a6520ea3fcd5170aa5774c4))",
    "* **shell:** align Railway update service copy ([c4adf95](https://github.com/CarlosCommits/stackray/commit/c4adf950cde63be871244a197d8cd5f6f83e2f43))",
    "* **worker:** abort scanner subprocesses cleanly ([0b17126](https://github.com/CarlosCommits/stackray/commit/0b171263f90655555a084c649e626091b9cc713a))",
  ].join("\n");
}

function getPreviewLatestVersion(currentVersion: string) {
  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);

  if (!match) {
    return `${currentVersion}-preview`;
  }

  return `${match[1]}.${match[2]}.${Number.parseInt(match[3]!, 10) + 1}`;
}

export function getStackrayUpdatePreviewStatus(currentVersion = APP_VERSION): StackrayUpdateStatus {
  const latestVersion = getPreviewLatestVersion(currentVersion);

  return {
    updateAvailable: true,
    fingerprint: `stackray-dev-preview:${currentVersion}>${latestVersion}`,
    currentVersion,
    latestVersion,
    latestUrl: "https://github.com/CarlosCommits/stackray/releases",
    latestRelease: {
      version: latestVersion,
      title: `Stackray ${latestVersion}`,
      body: getMockReleaseNotes(latestVersion),
      url: "https://github.com/CarlosCommits/stackray/releases",
      publishedAt: DEV_UPDATE_PREVIEW_CHECKED_AT,
    },
    checkedAt: DEV_UPDATE_PREVIEW_CHECKED_AT,
  };
}

export function getStackrayReleaseNoticePreview(currentVersion = APP_VERSION): StackrayReleaseMetadata {
  return {
    version: currentVersion,
    title: `Stackray ${currentVersion}`,
    body: getMockReleaseNotes(currentVersion),
    url: "https://github.com/CarlosCommits/stackray/releases",
    publishedAt: DEV_UPDATE_PREVIEW_CHECKED_AT,
  };
}
