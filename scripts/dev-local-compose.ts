import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, readlink } from "node:fs/promises";
import { basename } from "node:path";

const localDevCachePath = ".stackray-dev-local.json";
const localDevScriptName = "scripts/dev-local.ts";

type LocalDevCache = {
  appPort?: number;
  composeProjectName?: string;
  managerPid?: number;
  minioConsolePort?: number;
  minioPort?: number;
  postgresPort?: number;
  worktreePath?: string;
};

function commandFor(command: string, args: string[]) {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: "cmd",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

function readCachedLocalDev() {
  try {
    const cache = JSON.parse(readFileSync(localDevCachePath, "utf8")) as unknown;
    if (cache && typeof cache === "object") {
      return cache as LocalDevCache;
    }
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (errorCode !== "ENOENT") {
      console.warn(`[dev] Ignoring ${localDevCachePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return null;
}

function resolveDefaultComposeProjectName() {
  if (process.env.STACKRAY_DEV_COMPOSE_PROJECT) {
    return process.env.STACKRAY_DEV_COMPOSE_PROJECT;
  }

  const worktreeName = basename(process.cwd())
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "worktree";
  const worktreeHash = createHash("sha256").update(process.cwd()).digest("hex").slice(0, 8);

  return `stackray-dev-${worktreeName}-${worktreeHash}`;
}

function resolveComposeArgs(action: string | undefined) {
  switch (action) {
    case "down":
      return ["compose", "-f", "docker-compose.dev.yml", "--profile", "worker", "down", "--remove-orphans"];
    case "wipe":
      return ["compose", "-f", "docker-compose.dev.yml", "--profile", "worker", "down", "--remove-orphans", "-v"];
    default:
      throw new Error("Usage: node --experimental-strip-types scripts/dev-local-compose.ts <down|wipe>");
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readProcText(pid: number, fileName: "cmdline" | "cwd") {
  try {
    if (fileName === "cwd") {
      return await readlink(`/proc/${pid}/cwd`);
    }

    return (await readFile(`/proc/${pid}/cmdline`, "utf8")).replaceAll("\0", " ");
  } catch {
    return null;
  }
}

async function isCachedManagerProcess(cache: LocalDevCache, pid: number) {
  if (cache.worktreePath && cache.worktreePath !== process.cwd()) {
    return false;
  }

  if (process.platform !== "linux") {
    return true;
  }

  const [cwd, cmdline] = await Promise.all([
    readProcText(pid, "cwd"),
    readProcText(pid, "cmdline"),
  ]);

  return cwd === process.cwd() && Boolean(cmdline?.includes(localDevScriptName));
}

async function stopCachedLocalDevManager(cache: LocalDevCache | null) {
  const managerPid = cache?.managerPid;

  if (!Number.isInteger(managerPid) || !managerPid || managerPid <= 0 || managerPid === process.pid) {
    return;
  }

  if (!isRunning(managerPid)) {
    return;
  }

  if (!(await isCachedManagerProcess(cache, managerPid))) {
    console.warn(`[dev] Not stopping cached dev process ${managerPid}; it does not match this worktree.`);
    return;
  }

  console.log(`[dev] Stopping local dev manager process ${managerPid}...`);
  process.kill(managerPid, "SIGTERM");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isRunning(managerPid)) {
      return;
    }

    await sleep(100);
  }

  console.warn(`[dev] Local dev manager process ${managerPid} is still running after SIGTERM.`);
}

async function main() {
  const cachedLocalDev = readCachedLocalDev();
  const composeProjectName = process.env.STACKRAY_DEV_COMPOSE_PROJECT
    ?? (typeof cachedLocalDev?.composeProjectName === "string" ? cachedLocalDev.composeProjectName : null)
    ?? resolveDefaultComposeProjectName();
  const dockerArgs = resolveComposeArgs(process.argv[2]);
  await stopCachedLocalDevManager(cachedLocalDev);
  const resolved = commandFor("docker", dockerArgs);
  const child = spawn(resolved.command, resolved.args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      STACKRAY_DEV_COMPOSE_PROJECT: composeProjectName,
    },
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });

  child.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
