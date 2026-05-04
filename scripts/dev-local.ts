import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import { createInterface } from "node:readline";

type ManagedProcess = {
  name: string;
  child: ChildProcess;
};

const managedProcesses: ManagedProcess[] = [];
let shuttingDown = false;

function commandFor(command: string, args: string[]) {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: "cmd",
    args: ["/d", "/s", "/c", command, ...args],
  };
}

function prefixStream(name: string, stream: NodeJS.ReadableStream, write: (line: string) => void) {
  const lines = createInterface({ input: stream });

  lines.on("line", (line) => {
    write(`[${name}] ${line}`);
  });

  return lines;
}

function run(command: string, args: string[], options: { name?: string; prefix?: boolean } = {}) {
  const resolved = commandFor(command, args);

  return new Promise<void>((resolve, reject) => {
    const child = spawn(resolved.command, resolved.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: options.prefix ? ["inherit", "pipe", "pipe"] : "inherit",
    });

    let stdoutLines: ReturnType<typeof prefixStream> | undefined;
    let stderrLines: ReturnType<typeof prefixStream> | undefined;

    if (options.prefix) {
      const name = options.name ?? command;
      if (child.stdout) {
        stdoutLines = prefixStream(name, child.stdout, console.log);
      }
      if (child.stderr) {
        stderrLines = prefixStream(name, child.stderr, console.error);
      }
    }

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      stdoutLines?.close();
      stderrLines?.close();

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${options.name ?? command} exited with ${signal ?? code ?? "unknown status"}.`));
    });
  });
}

function startManaged(name: string, command: string, args: string[]) {
  const resolved = commandFor(command, args);
  const child = spawn(resolved.command, resolved.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  managedProcesses.push({ name, child });

  if (child.stdout) {
    prefixStream(name, child.stdout, console.log);
  }

  if (child.stderr) {
    prefixStream(name, child.stderr, console.error);
  }

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(`[dev] ${name} exited with ${signal ?? code ?? "unknown status"}. Stopping local dev.`);
    void shutdown(1);
  });

  child.on("error", (error) => {
    if (shuttingDown) {
      return;
    }

    console.error(`[dev] ${name} failed to start: ${error.message}`);
    void shutdown(1);
  });
}

function terminateProcess(child: ChildProcess) {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");
}

function isPortInUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function assertNextPortAvailable() {
  if (!(await isPortInUse(3000))) {
    return;
  }

  throw new Error(
    [
      "Port 3000 is already in use, so the local Next.js dev server cannot start cleanly.",
      "Stop the existing dev server and run `pnpm dev:local` again.",
      "On Windows, you can find the process with `Get-NetTCPConnection -LocalPort 3000 -State Listen`.",
    ].join("\n"),
  );
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (managedProcesses.length === 0) {
    process.exit(exitCode);
  }

  console.log("[dev] Stopping Next dev server and worker container...");

  for (const processInfo of managedProcesses) {
    terminateProcess(processInfo.child);
  }

  if (managedProcesses.some((processInfo) => processInfo.name === "worker")) {
    try {
      await run("docker", ["compose", "-f", "docker-compose.dev.yml", "stop", "worker"], {
        name: "docker",
        prefix: true,
      });
    } catch (error) {
      console.error(`[dev] Failed to stop worker cleanly: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  process.exit(exitCode);
}

async function main() {
  process.on("SIGINT", () => {
    void shutdown(0);
  });

  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  await run("node", [
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--experimental-strip-types",
    "scripts/setup-dev-env.ts",
  ]);

  await assertNextPortAvailable();

  await run("pnpm", ["dev:infra"]);
  await run("pnpm", ["db:migrate:startup"]);
  await run("pnpm", ["seed:admin", "--email", "admin@stackray.local", "--password", "StackrayDev123!"]);

  startManaged("worker", "docker", [
    "compose",
    "-f",
    "docker-compose.dev.yml",
    "--profile",
    "worker",
    "up",
    "--build",
    "worker",
  ]);
  startManaged("next", "pnpm", ["dev"]);

  console.log("[dev] Local development is running at http://localhost:3000.");
  console.log("[dev] Press Ctrl+C to stop Next and the worker. Postgres and MinIO will keep running.");
}

main().catch((error) => {
  console.error(error);
  void shutdown(1);
});
