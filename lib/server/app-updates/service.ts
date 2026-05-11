import { env } from "@/lib/env/server";
import { APP_VERSION } from "@/lib/version";
import type { StackrayReleaseMetadata, StackrayUpdateStatus } from "@/lib/contracts/app-updates";

const DEFAULT_RELEASE_REPOSITORY = "CarlosCommits/stackray";
const UPDATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type GitHubReleaseResponse = {
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  html_url?: string;
  published_at?: string | null;
}

type GitHubTagResponse = {
  name?: string;
  zipball_url?: string;
}

type CachedUpdateStatus = {
  checkedAtMs: number;
  status: StackrayUpdateStatus | null;
}

let cachedUpdateStatus: CachedUpdateStatus | null = null;
const cachedReleaseByVersion = new Map<string, { checkedAtMs: number; release: StackrayReleaseMetadata | null }>();

function getGitHubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "stackray-release-update-check",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (env.STACKRAY_GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.STACKRAY_GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchGitHubJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: getGitHubHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${url}.`);
  }

  return response.json() as Promise<T>;
}

function normalizeVersion(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
}

function parseSemver(value: string) {
  const match = normalizeVersion(value)?.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);

  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1]!, 10),
    minor: Number.parseInt(match[2]!, 10),
    patch: Number.parseInt(match[3]!, 10),
  };
}

function compareSemver(left: string, right: string) {
  const leftVersion = parseSemver(left);
  const rightVersion = parseSemver(right);

  if (!leftVersion || !rightVersion) {
    return 0;
  }

  for (const key of ["major", "minor", "patch"] as const) {
    const delta = leftVersion[key] - rightVersion[key];

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

function releaseFromGitHubRelease(repository: string, release: GitHubReleaseResponse): StackrayReleaseMetadata | null {
  if (!release.tag_name) {
    return null;
  }

  const version = normalizeVersion(release.tag_name) ?? release.tag_name;

  return {
    version,
    title: release.name?.trim() || null,
    body: release.body?.trim() || null,
    url: release.html_url ?? `https://github.com/${repository}/releases/tag/${release.tag_name}`,
    publishedAt: release.published_at ?? null,
  };
}

async function fetchGitHubReleaseByVersion(repository: string, version: string) {
  const normalizedVersion = normalizeVersion(version) ?? version;
  const tagNames = [`v${normalizedVersion}`, normalizedVersion];

  for (const tagName of tagNames) {
    const release = await fetchGitHubJson<GitHubReleaseResponse>(
      `https://api.github.com/repos/${repository}/releases/tags/${tagName}`,
    );
    const metadata = release ? releaseFromGitHubRelease(repository, release) : null;

    if (metadata) {
      return metadata;
    }
  }

  return null;
}

async function fetchLatestStackrayRelease(repository: string) {
  const latestRelease = await fetchGitHubJson<GitHubReleaseResponse>(
    `https://api.github.com/repos/${repository}/releases/latest`,
  );
  const latestReleaseMetadata = latestRelease ? releaseFromGitHubRelease(repository, latestRelease) : null;

  if (latestReleaseMetadata) {
    return {
      ...latestReleaseMetadata,
      url: latestReleaseMetadata.url ?? `https://github.com/${repository}/releases/tag/v${latestReleaseMetadata.version}`,
    };
  }

  const tags = await fetchGitHubJson<GitHubTagResponse[]>(
    `https://api.github.com/repos/${repository}/tags?per_page=30`,
  );

  const semverTags = (tags ?? [])
    .map((tag) => tag.name)
    .filter((tag): tag is string => Boolean(tag && parseSemver(tag)))
    .sort((left, right) => compareSemver(right, left));
  const latestTag = semverTags[0];

  if (!latestTag) {
    return null;
  }

  return {
    version: normalizeVersion(latestTag) ?? latestTag,
    title: null,
    body: null,
    url: `https://github.com/${repository}/tree/${latestTag}`,
    publishedAt: null,
  };
}

export async function getStackrayReleaseByVersion(version: string): Promise<StackrayReleaseMetadata | null> {
  const now = Date.now();
  const normalizedVersion = normalizeVersion(version) ?? version;
  const cachedRelease = cachedReleaseByVersion.get(normalizedVersion);

  if (cachedRelease && now - cachedRelease.checkedAtMs < UPDATE_CACHE_TTL_MS) {
    return cachedRelease.release;
  }

  try {
    const repository = env.STACKRAY_RELEASE_REPOSITORY ?? DEFAULT_RELEASE_REPOSITORY;
    const release = await fetchGitHubReleaseByVersion(repository, normalizedVersion);
    cachedReleaseByVersion.set(normalizedVersion, { checkedAtMs: now, release });
    return release;
  } catch {
    cachedReleaseByVersion.set(normalizedVersion, { checkedAtMs: now, release: null });
    return null;
  }
}

export async function getStackrayUpdateStatus(): Promise<StackrayUpdateStatus | null> {
  const now = Date.now();

  if (cachedUpdateStatus && now - cachedUpdateStatus.checkedAtMs < UPDATE_CACHE_TTL_MS) {
    return cachedUpdateStatus.status;
  }

  try {
    const repository = env.STACKRAY_RELEASE_REPOSITORY ?? DEFAULT_RELEASE_REPOSITORY;
    const latest = await fetchLatestStackrayRelease(repository);
    const checkedAt = new Date(now).toISOString();

    if (!latest || compareSemver(latest.version, APP_VERSION) <= 0) {
      cachedUpdateStatus = { checkedAtMs: now, status: null };
      return null;
    }

    const latestVersion = normalizeVersion(latest.version) ?? latest.version;
    const status: StackrayUpdateStatus = {
      updateAvailable: true,
      fingerprint: `stackray:${APP_VERSION}>${latestVersion}`,
      currentVersion: APP_VERSION,
      latestVersion,
      latestUrl: latest.url,
      latestRelease: latest,
      checkedAt,
    };

    cachedUpdateStatus = { checkedAtMs: now, status };
    return status;
  } catch {
    cachedUpdateStatus = { checkedAtMs: now, status: null };
    return null;
  }
}
