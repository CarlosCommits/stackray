import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { basename } from "node:path";

function commandFor(command: string, args: string[]) {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: "cmd",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

function resolveComposeProjectName() {
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
      return ["compose", "-f", "docker-compose.dev.yml", "down"];
    case "reset":
      return ["compose", "-f", "docker-compose.dev.yml", "down", "-v"];
    default:
      throw new Error("Usage: node --experimental-strip-types scripts/dev-local-compose.ts <down|reset>");
  }
}

async function main() {
  const composeProjectName = resolveComposeProjectName();
  const dockerArgs = resolveComposeArgs(process.argv[2]);
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
