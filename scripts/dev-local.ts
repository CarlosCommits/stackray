import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { basename } from "node:path";
import { createInterface } from "node:readline";

type ManagedProcess = {
  name: string;
  child: ChildProcess;
};

type EnvOverrides = Record<string, string>;

type LocalDevCache = {
  appPort: number;
  composeProjectName: string;
  managerPid?: number;
  minioConsolePort: number;
  minioPort: number;
  postgresPort: number;
  worktreePath?: string;
};

const localDevCachePath = ".stackray-dev-local.json";
const managedProcesses: ManagedProcess[] = [];
let shuttingDown = false;
let managedEnv: EnvOverrides | undefined;

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

function run(
  command: string,
  args: string[],
  options: { env?: EnvOverrides; name?: string; prefix?: boolean } = {},
) {
  const resolved = commandFor(command, args);

  return new Promise<void>((resolve, reject) => {
    const child = spawn(resolved.command, resolved.args, {
      cwd: process.cwd(),
      env: { ...process.env, ...options.env },
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

function startManaged(name: string, command: string, args: string[], env?: EnvOverrides) {
  const resolved = commandFor(command, args);
  const child = spawn(resolved.command, resolved.args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
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
    socket.setTimeout(500);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function parsePort(value: string, name: string) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || String(port) !== value || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer port from 1 to 65535.`);
  }

  return port;
}

async function findAvailableUnreservedPort(preferredPort: number, label: string, reservedPorts: readonly number[]) {
  const reserved = new Set(reservedPorts);

  for (let port = preferredPort; port <= Math.min(preferredPort + 99, 65535); port += 1) {
    if (reserved.has(port)) {
      continue;
    }

    if (!(await isPortInUse(port))) {
      return port;
    }
  }

  throw new Error(`Could not find an available ${label} port from ${preferredPort} to ${preferredPort + 99}.`);
}

async function resolvePort(options: {
  allowCachedInUse?: boolean;
  cachedPort?: number;
  defaultPort: number;
  envName: string;
  fallbackEnvName?: string;
  label: string;
  reservedPorts?: readonly number[];
}) {
  const reservedPorts = options.reservedPorts ?? [];
  const reserved = new Set(reservedPorts);
  const requestedValue = process.env[options.envName] ?? (options.fallbackEnvName ? process.env[options.fallbackEnvName] : undefined);
  if (!requestedValue) {
    if (options.cachedPort && !reserved.has(options.cachedPort)) {
      if (options.allowCachedInUse || !(await isPortInUse(options.cachedPort))) {
        return options.cachedPort;
      }
    }

    return findAvailableUnreservedPort(options.defaultPort, options.label, reservedPorts);
  }

  const requestedPort = parsePort(requestedValue, options.envName);
  if (reserved.has(requestedPort)) {
    throw new Error(`${options.envName}=${requestedPort} conflicts with another local development port.`);
  }

  if (await isPortInUse(requestedPort)) {
    throw new Error(`${options.envName}=${requestedPort} is already in use.`);
  }

  return requestedPort;
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

function isLocalDevCache(value: unknown): value is LocalDevCache {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Record<keyof LocalDevCache, unknown>>;
  const isPort = (port: unknown) => Number.isInteger(port) && Number(port) >= 1 && Number(port) <= 65535;
  return (
    typeof candidate.composeProjectName === "string" &&
    isPort(candidate.appPort) &&
    isPort(candidate.postgresPort) &&
    isPort(candidate.minioPort) &&
    isPort(candidate.minioConsolePort) &&
    new Set([
      candidate.appPort,
      candidate.postgresPort,
      candidate.minioPort,
      candidate.minioConsolePort,
    ]).size === 4
  );
}

async function readLocalDevCache(composeProjectName: string) {
  try {
    const cache = JSON.parse(await readFile(localDevCachePath, "utf8")) as unknown;
    if (isLocalDevCache(cache) && cache.composeProjectName === composeProjectName) {
      return cache;
    }
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (errorCode !== "ENOENT") {
      console.warn(`[dev] Ignoring ${localDevCachePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return null;
}

async function readAnyLocalDevCache() {
  try {
    const cache = JSON.parse(await readFile(localDevCachePath, "utf8")) as unknown;
    return isLocalDevCache(cache) ? cache : null;
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (errorCode !== "ENOENT") {
      console.warn(`[dev] Ignoring ${localDevCachePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return null;
}

async function writeLocalDevCache(cache: LocalDevCache) {
  await writeFile(`${localDevCachePath}.tmp`, `${JSON.stringify(cache, null, 2)}\n`);
  await rename(`${localDevCachePath}.tmp`, localDevCachePath);
}

async function resolveLocalDevEnvironment() {
  const cachedProject = await readAnyLocalDevCache();
  const composeProjectName = process.env.STACKRAY_DEV_COMPOSE_PROJECT ?? cachedProject?.composeProjectName ?? resolveDefaultComposeProjectName();
  const cache = await readLocalDevCache(composeProjectName);
  const appPort = await resolvePort({
    cachedPort: cache?.appPort,
    defaultPort: 3000,
    envName: "STACKRAY_DEV_APP_PORT",
    fallbackEnvName: "PORT",
    label: "Next.js",
  });
  const postgresPort = await resolvePort({
    allowCachedInUse: true,
    cachedPort: cache?.postgresPort,
    defaultPort: 5432,
    envName: "STACKRAY_DEV_POSTGRES_PORT",
    label: "Postgres",
    reservedPorts: [appPort],
  });
  const minioPort = await resolvePort({
    allowCachedInUse: true,
    cachedPort: cache?.minioPort,
    defaultPort: 9000,
    envName: "STACKRAY_DEV_MINIO_PORT",
    label: "MinIO API",
    reservedPorts: [appPort, postgresPort],
  });
  const minioConsolePort = await resolvePort({
    allowCachedInUse: true,
    cachedPort: cache?.minioConsolePort,
    defaultPort: 9001,
    envName: "STACKRAY_DEV_MINIO_CONSOLE_PORT",
    label: "MinIO console",
    reservedPorts: [appPort, postgresPort, minioPort],
  });
  const appUrl = `http://localhost:${appPort}`;
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${postgresPort}/stackray`;
  const minioEndpoint = `http://127.0.0.1:${minioPort}`;

  return {
    appPort,
    appUrl,
    composeProjectName,
    databaseUrl,
    minioConsoleUrl: `http://127.0.0.1:${minioConsolePort}`,
    minioEndpoint,
    env: {
      AWS_ENDPOINT_URL: minioEndpoint,
      BETTER_AUTH_URL: appUrl,
      DATABASE_URL: databaseUrl,
      PORT: String(appPort),
      STACKRAY_DEV_APP_PORT: String(appPort),
      STACKRAY_DEV_COMPOSE_PROJECT: composeProjectName,
      STACKRAY_DEV_MINIO_CONSOLE_PORT: String(minioConsolePort),
      STACKRAY_DEV_MINIO_PORT: String(minioPort),
      STACKRAY_DEV_POSTGRES_PORT: String(postgresPort),
    } satisfies EnvOverrides,
  };
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (managedProcesses.length === 0) {
    process.exit(exitCode);
  }

  console.log("[dev] Stopping Next dev server and worker containers...");

  for (const processInfo of managedProcesses) {
    terminateProcess(processInfo.child);
  }

  if (managedProcesses.some((processInfo) => processInfo.name === "workers")) {
    try {
      await run("docker", ["compose", "-f", "docker-compose.dev.yml", "stop", "worker-http", "worker-intel", "worker-browser"], {
        env: managedEnv,
        name: "docker",
        prefix: true,
      });
    } catch (error) {
      console.error(`[dev] Failed to stop workers cleanly: ${error instanceof Error ? error.message : String(error)}`);
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

  const localDev = await resolveLocalDevEnvironment();
  managedEnv = localDev.env;
  await writeLocalDevCache({
    appPort: localDev.appPort,
    composeProjectName: localDev.composeProjectName,
    managerPid: process.pid,
    minioConsolePort: Number.parseInt(localDev.env.STACKRAY_DEV_MINIO_CONSOLE_PORT, 10),
    minioPort: Number.parseInt(localDev.env.STACKRAY_DEV_MINIO_PORT, 10),
    postgresPort: Number.parseInt(localDev.env.STACKRAY_DEV_POSTGRES_PORT, 10),
    worktreePath: process.cwd(),
  });

  console.log(`[dev] Docker Compose project: ${localDev.composeProjectName}`);
  console.log(`[dev] Next.js port: ${localDev.appPort}`);

  await run("pnpm", ["dev:infra"], { env: localDev.env });
  await run("pnpm", ["db:migrate:startup"], { env: localDev.env });
  await run("pnpm", ["seed:admin", "--email", "admin@stackray.local", "--password", "StackrayDev123!"], {
    env: localDev.env,
  });

  startManaged("workers", "docker", [
    "compose",
    "-f",
    "docker-compose.dev.yml",
    "--profile",
    "worker",
    "up",
    "--build",
    "worker-http",
    "worker-intel",
    "worker-browser",
  ], localDev.env);
  startManaged("next", "pnpm", ["dev"], localDev.env);

  console.log(`[dev] Local development is running at ${localDev.appUrl}.`);
  console.log(`[dev] Postgres is available at ${localDev.databaseUrl}.`);
  console.log(`[dev] MinIO is available at ${localDev.minioEndpoint}; console: ${localDev.minioConsoleUrl}.`);
  console.log("[dev] Press Ctrl+C to stop Next and the workers. Postgres and MinIO will keep running.");
}

main().catch((error) => {
  console.error(error);
  void shutdown(1);
});
