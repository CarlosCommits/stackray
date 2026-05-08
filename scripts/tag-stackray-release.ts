import { execFileSync } from "node:child_process";

import { getStackrayVersion } from "./bump-stackray-version.ts";

function hasArg(name: string) {
  return process.argv.includes(name);
}

function git(args: string[]) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const version = getStackrayVersion();
const tagName = `v${version}`;

if (!hasArg("--allow-dirty") && git(["status", "--porcelain"]).length > 0) {
  throw new Error("Working tree is dirty. Commit changes before tagging, or pass --allow-dirty.");
}

const existingTags = git(["tag", "--list", tagName]);

if (existingTags.length > 0) {
  throw new Error(`${tagName} already exists.`);
}

git(["tag", "-a", tagName, "-m", `Stackray ${tagName}`]);
console.log(`Created ${tagName}.`);

if (hasArg("--push")) {
  git(["push", "origin", tagName]);
  console.log(`Pushed ${tagName} to origin.`);
}
