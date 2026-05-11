import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { getStackrayVersion, resolveNextVersion, setStackrayVersion } from "./bump-stackray-version.ts";

type GitHubRun = {
  databaseId: number;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "timed_out" | "action_required" | null;
  url: string;
}

const releaseRepository = process.env.STACKRAY_RELEASE_REPOSITORY ?? "CarlosCommits/stackray";
const ciWorkflowName = "CI";
const ciPollIntervalMs = 10_000;
const ciTimeoutMs = 30 * 60_000;

function parseArgs() {
  const [requestedVersionOrType = "patch"] = process.argv.slice(2);

  return requestedVersionOrType;
}

function run(command: string, args: string[]) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function runInherit(command: string, args: string[]) {
  execFileSync(command, args, { encoding: "utf8", stdio: "inherit" });
}

function git(args: string[]) {
  return run("git", args);
}

function gh(args: string[]) {
  return run("gh", args);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertCleanTree() {
  const status = git(["status", "--porcelain"]);

  if (status.length > 0) {
    throw new Error("Working tree is dirty. Commit or stash changes before releasing.");
  }
}

function assertMainBranch() {
  const branch = git(["branch", "--show-current"]);

  if (branch !== "main") {
    throw new Error(`Releases must be created from main. Current branch is ${branch || "(detached)"}.`);
  }
}

function assertUpToDateWithOriginMain() {
  runInherit("git", ["fetch", "origin", "main", "--tags"]);

  const localHead = git(["rev-parse", "HEAD"]);
  const originMain = git(["rev-parse", "origin/main"]);

  if (localHead !== originMain) {
    throw new Error("Local main must match origin/main before releasing.");
  }
}

function assertTagAvailable(tagName: string) {
  const localTag = git(["tag", "--list", tagName]);

  if (localTag.length > 0) {
    throw new Error(`${tagName} already exists locally.`);
  }

  const remoteTag = git(["ls-remote", "--tags", "origin", tagName]);

  if (remoteTag.length > 0) {
    throw new Error(`${tagName} already exists on origin.`);
  }
}

function parseRuns(value: string): GitHubRun[] {
  if (!value) {
    return [];
  }

  return JSON.parse(value) as GitHubRun[];
}

async function waitForCiSuccess(commitSha: string) {
  const deadline = Date.now() + ciTimeoutMs;

  while (Date.now() < deadline) {
    const runs = parseRuns(gh([
      "run",
      "list",
      "--repo",
      releaseRepository,
      "--workflow",
      ciWorkflowName,
      "--commit",
      commitSha,
      "--json",
      "databaseId,status,conclusion,url",
      "--limit",
      "1",
    ]));
    const run = runs[0];

    if (!run) {
      console.log(`Waiting for ${ciWorkflowName} to start for ${commitSha.slice(0, 7)}...`);
      await sleep(ciPollIntervalMs);
      continue;
    }

    if (run.status !== "completed") {
      console.log(`Waiting for ${ciWorkflowName} run ${run.databaseId} (${run.status})...`);
      await sleep(ciPollIntervalMs);
      continue;
    }

    if (run.conclusion !== "success") {
      throw new Error(`${ciWorkflowName} failed for ${commitSha.slice(0, 7)}: ${run.url}`);
    }

    console.log(`${ciWorkflowName} passed for ${commitSha.slice(0, 7)}.`);
    return;
  }

  throw new Error(`Timed out waiting for ${ciWorkflowName} on ${commitSha.slice(0, 7)}.`);
}

async function main() {
  assertCleanTree();
  assertMainBranch();
  assertUpToDateWithOriginMain();

  const currentVersion = getStackrayVersion();
  const nextVersion = resolveNextVersion(currentVersion, parseArgs());
  const tagName = `v${nextVersion}`;

  assertTagAvailable(tagName);

  setStackrayVersion(nextVersion);
  runInherit("git", ["add", "package.json", "lib/version.ts"]);
  runInherit("git", ["commit", "-m", `chore(release): ${tagName}`]);

  const releaseSha = git(["rev-parse", "HEAD"]);

  runInherit("git", ["push", "origin", "main"]);
  await waitForCiSuccess(releaseSha);

  runInherit("git", ["tag", "-a", tagName, "-m", `Stackray ${tagName}`, releaseSha]);
  runInherit("git", ["push", "origin", tagName]);
  runInherit("gh", [
    "release",
    "create",
    tagName,
    "--repo",
    releaseRepository,
    "--title",
    `Stackray ${tagName}`,
    "--generate-notes",
    "--verify-tag",
  ]);

  console.log(`Released Stackray ${tagName}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
