import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getStackrayVersion, resolveNextVersion, setStackrayVersion } from "./bump-stackray-version.ts";

type ScannerPins = {
  httpx: {
    repo: string;
    gitUrl: string;
    sourceRef: string;
    ref: string;
  };
  nuclei: {
    module: string;
    version: string;
  };
  subfinder: {
    module: string;
    version: string;
  };
  nucleiTemplates: {
    repo: string;
    gitUrl: string;
    sourceRef: string;
    ref: string;
  };
}

type GitHubRefResponse = {
  object?: {
    sha?: string;
  };
}

type GitHubReleaseResponse = {
  tag_name?: string;
}

const root = process.cwd();
const pinsPath = join(root, "worker", "scanner-pins.json");
const dockerfilePaths = [join(root, "worker", "Dockerfile"), join(root, "worker", "Dockerfile.dev")];

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));

  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function getGitHubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "stackray-scanner-pin-updater",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchGitHubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${url}.`);
  }

  return response.json() as Promise<T>;
}

async function fetchLatestPins(currentPins: ScannerPins): Promise<ScannerPins> {
  const [httpxRef, nucleiRelease, subfinderRelease, nucleiTemplatesRef] = await Promise.all([
    fetchGitHubJson<GitHubRefResponse>(
      `https://api.github.com/repos/${currentPins.httpx.repo}/git/ref/heads/${currentPins.httpx.sourceRef}`,
    ),
    fetchGitHubJson<GitHubReleaseResponse>("https://api.github.com/repos/projectdiscovery/nuclei/releases/latest"),
    fetchGitHubJson<GitHubReleaseResponse>("https://api.github.com/repos/projectdiscovery/subfinder/releases/latest"),
    fetchGitHubJson<GitHubRefResponse>(
      `https://api.github.com/repos/${currentPins.nucleiTemplates.repo}/git/ref/heads/${currentPins.nucleiTemplates.sourceRef}`,
    ),
  ]);

  return {
    ...currentPins,
    httpx: {
      ...currentPins.httpx,
      ref: httpxRef.object?.sha ?? currentPins.httpx.ref,
    },
    nuclei: {
      ...currentPins.nuclei,
      version: nucleiRelease.tag_name ?? currentPins.nuclei.version,
    },
    subfinder: {
      ...currentPins.subfinder,
      version: subfinderRelease.tag_name ?? currentPins.subfinder.version,
    },
    nucleiTemplates: {
      ...currentPins.nucleiTemplates,
      ref: nucleiTemplatesRef.object?.sha ?? currentPins.nucleiTemplates.ref,
    },
  };
}

function readPins() {
  return JSON.parse(readFileSync(pinsPath, "utf8")) as ScannerPins;
}

function writePins(pins: ScannerPins) {
  writeFileSync(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
}

function pinsChanged(currentPins: ScannerPins, nextPins: ScannerPins) {
  return JSON.stringify(currentPins) !== JSON.stringify(nextPins);
}

function updateDockerfile(path: string, pins: ScannerPins) {
  let contents = readFileSync(path, "utf8");

  contents = contents
    .replace(/^ARG HTTPX_REF=.*$/m, `ARG HTTPX_REF=${pins.httpx.ref}`)
    .replace(/^ARG NUCLEI_VERSION=.*$/m, `ARG NUCLEI_VERSION=${pins.nuclei.version}`)
    .replace(/^ARG SUBFINDER_VERSION=.*$/m, `ARG SUBFINDER_VERSION=${pins.subfinder.version}`)
    .replace(/^ARG NUCLEI_TEMPLATES_REF=.*$/m, `ARG NUCLEI_TEMPLATES_REF=${pins.nucleiTemplates.ref}`);

  writeFileSync(path, contents);
}

function setOutput(name: string, value: string | boolean) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  writeFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, { flag: "a" });
}

function summarizeChange(currentPins: ScannerPins, nextPins: ScannerPins) {
  return [
    `httpx: ${currentPins.httpx.ref.slice(0, 7)} -> ${nextPins.httpx.ref.slice(0, 7)}`,
    `nuclei: ${currentPins.nuclei.version} -> ${nextPins.nuclei.version}`,
    `subfinder: ${currentPins.subfinder.version} -> ${nextPins.subfinder.version}`,
    `nuclei-templates: ${currentPins.nucleiTemplates.ref.slice(0, 7)} -> ${nextPins.nucleiTemplates.ref.slice(0, 7)}`,
  ].join("; ");
}

const currentPins = readPins();
const nextPins = await fetchLatestPins(currentPins);
const changed = pinsChanged(currentPins, nextPins);

setOutput("changed", changed);
setOutput("summary", summarizeChange(currentPins, nextPins));

if (!changed) {
  console.log("Scanner pins are already current.");
} else {
  writePins(nextPins);

  for (const dockerfilePath of dockerfilePaths) {
    updateDockerfile(dockerfilePath, nextPins);
  }

  const bump = getArgValue("--bump");

  if (bump) {
    const currentVersion = getStackrayVersion();
    const nextVersion = resolveNextVersion(currentVersion, bump);
    setStackrayVersion(nextVersion);
    setOutput("next_version", nextVersion);
    console.log(`Bumped Stackray from v${currentVersion} to v${nextVersion}.`);
  }

  console.log(`Updated scanner pins. ${summarizeChange(currentPins, nextPins)}`);
}
