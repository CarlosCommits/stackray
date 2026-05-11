import { execFileSync } from "node:child_process";

import { getStackrayVersion } from "./bump-stackray-version.ts";

type GitHubRun = {
  databaseId: number;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "timed_out" | "action_required" | null;
  url: string;
}

const releaseRepository = process.env.STACKRAY_RELEASE_REPOSITORY ?? "CarlosCommits/stackray";
const ciWorkflowName = "CI";

function hasArg(name: string) {
  return process.argv.includes(name);
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

function assertMainBranch() {
  const branch = git(["branch", "--show-current"]);

  if (branch !== "main") {
    throw new Error(`Releases must be tagged from main. Current branch is ${branch || "(detached)"}.`);
  }
}

function assertUpToDateWithOriginMain() {
  runInherit("git", ["fetch", "origin", "main", "--tags"]);

  const localHead = git(["rev-parse", "HEAD"]);
  const originMain = git(["rev-parse", "origin/main"]);

  if (localHead !== originMain) {
    throw new Error("Local main must match origin/main before tagging a release.");
  }
}

function parseRuns(value: string): GitHubRun[] {
  if (!value) {
    return [];
  }

  return JSON.parse(value) as GitHubRun[];
}

function assertCiPassed(commitSha: string) {
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
    throw new Error(`${ciWorkflowName} has not run for ${commitSha.slice(0, 7)}.`);
  }

  if (run.status !== "completed") {
    throw new Error(`${ciWorkflowName} is still ${run.status} for ${commitSha.slice(0, 7)}: ${run.url}`);
  }

  if (run.conclusion !== "success") {
    throw new Error(`${ciWorkflowName} did not pass for ${commitSha.slice(0, 7)}: ${run.url}`);
  }
}

const version = getStackrayVersion();
const tagName = `v${version}`;

if (hasArg("--allow-dirty")) {
  throw new Error("--allow-dirty is no longer supported for release tags.");
}

if (git(["status", "--porcelain"]).length > 0) {
  throw new Error("Working tree is dirty. Commit changes before tagging.");
}

assertMainBranch();
assertUpToDateWithOriginMain();

const existingTags = git(["tag", "--list", tagName]);

if (existingTags.length > 0) {
  throw new Error(`${tagName} already exists locally.`);
}

const remoteTag = git(["ls-remote", "--tags", "origin", tagName]);

if (remoteTag.length > 0) {
  throw new Error(`${tagName} already exists on origin.`);
}

const releaseSha = git(["rev-parse", "HEAD"]);
assertCiPassed(releaseSha);

git(["tag", "-a", tagName, "-m", `Stackray ${tagName}`, releaseSha]);
console.log(`Created ${tagName}.`);

if (hasArg("--push")) {
  git(["push", "origin", tagName]);
  console.log(`Pushed ${tagName} to origin.`);
}
