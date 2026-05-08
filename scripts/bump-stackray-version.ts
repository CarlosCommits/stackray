import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type ReleaseType = "major" | "minor" | "patch";

const root = process.cwd();
const packageJsonPath = join(root, "package.json");
const versionPath = join(root, "lib", "version.ts");

function parseArgs() {
  const [requestedVersionOrType = "patch"] = process.argv.slice(2);

  return requestedVersionOrType;
}

function parseVersion(version: string) {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Expected a semantic version like 1.2.3, received ${version}.`);
  }

  return {
    major: Number.parseInt(match[1]!, 10),
    minor: Number.parseInt(match[2]!, 10),
    patch: Number.parseInt(match[3]!, 10),
  };
}

function bumpVersion(current: string, releaseType: ReleaseType) {
  const version = parseVersion(current);

  if (releaseType === "major") {
    return `${version.major + 1}.0.0`;
  }

  if (releaseType === "minor") {
    return `${version.major}.${version.minor + 1}.0`;
  }

  return `${version.major}.${version.minor}.${version.patch + 1}`;
}

export function setStackrayVersion(nextVersion: string) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  packageJson.version = nextVersion;

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(
    versionPath,
    `// Single source of truth - keep this in sync with package.json.\nexport const APP_VERSION = "${nextVersion}"\nexport const DISPLAY_VERSION = \`v\${APP_VERSION}\`\n`,
  );
}

export function getStackrayVersion() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };

  if (!packageJson.version) {
    throw new Error("package.json does not define a version.");
  }

  return packageJson.version;
}

export function resolveNextVersion(currentVersion: string, requestedVersionOrType: string) {
  if (["major", "minor", "patch"].includes(requestedVersionOrType)) {
    return bumpVersion(currentVersion, requestedVersionOrType as ReleaseType);
  }

  parseVersion(requestedVersionOrType);
  return requestedVersionOrType.replace(/^v/, "");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const currentVersion = getStackrayVersion();
  const nextVersion = resolveNextVersion(currentVersion, parseArgs());

  setStackrayVersion(nextVersion);
  console.log(`Bumped Stackray from v${currentVersion} to v${nextVersion}.`);
}
