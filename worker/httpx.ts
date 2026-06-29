import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";

import { scans } from "../drizzle/schema.ts";
import { getExecutionTarget } from "../lib/server/scans/normalize-targets.ts";

export type HttpxJson = Record<string, unknown>;
type ScanRow = typeof scans.$inferSelect;

export type HttpxRequestProfile = "baseline" | "browser_headers";

export type HttpxBehaviorOptions = {
  browserLikeHeaders: boolean;
  followRedirects: boolean | null;
};

type HttpxProcess = {
  stdin: Pick<NodeJS.WritableStream, "write" | "end">;
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(event: "error", listener: (error: Error) => void): HttpxProcess;
  on(event: "close", listener: (code: number | null) => void): HttpxProcess;
  killed?: boolean;
};

type HttpxSpawn = (
  command: string,
  args: readonly string[],
  options: { stdio: ["pipe", "pipe", "pipe"] },
) => HttpxProcess;

export type RunHttpxCliResult = {
  status: "completed" | "failed" | "cancelled" | "timed_out" | "aborted";
  exitCode: number;
  stderr: string;
};

type RunHttpxCliOptions = {
  command: string;
  args: readonly string[];
  targets: readonly string[];
  timeoutMs: number;
  onJsonLine: (payload: HttpxJson) => Promise<void> | void;
  allowNonJsonStdout?: boolean;
  shouldCancel?: () => boolean | Promise<boolean>;
  cancellationPollIntervalMs?: number;
  signal?: AbortSignal;
  spawnProcess?: HttpxSpawn;
};

const DEFAULT_CANCELLATION_POLL_INTERVAL_MS = 500;
const PROCESS_KILL_GRACE_PERIOD_MS = 1_000;
const DEFAULT_HTTPX_BEHAVIOR_OPTIONS: HttpxBehaviorOptions = {
  browserLikeHeaders: false,
  followRedirects: null,
};

export const CUSTOM_WAPPALYZER_FINGERPRINTS_PATH = join(process.cwd(), "lib", "server", "scans", "custom-wappalyzer-fingerprints.json");
export const BROWSER_LIKE_HEADERS = [
  "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6568.0 Safari/537.36",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language: en-US,en;q=0.9",
  "Sec-Fetch-Dest: document",
  "Sec-Fetch-Mode: navigate",
  "Sec-Fetch-Site: none",
  "Sec-Fetch-User: ?1",
  'Sec-Ch-Ua: "Chromium";v="128", "Not;A=Brand";v="99"',
  "Sec-Ch-Ua-Mobile: ?0",
  'Sec-Ch-Ua-Platform: "Linux"',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function logHttpxEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "httpx-worker",
      event,
      ...payload,
    }),
  );
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function buildHttpxArguments(
  scan: ScanRow,
  behaviorOptions: HttpxBehaviorOptions = DEFAULT_HTTPX_BEHAVIOR_OPTIONS,
): string[] {
  const args = [
    "-silent",
    "-json",
    "-stream",
    "-td",
    "-cff",
    CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
    "-title",
    "-sc",
    "-cl",
    "-ct",
    "-rt",
    "-location",
    "-server",
    "-wp",
    "-cpe",
    "-favicon",
    "-jarm",
    "-cdn",
    "-ip",
    "-cname",
    "-asn",
    "-tls-grab",
    "-hash",
    "md5,mmh3,sha256",
    "-extract-fqdn",
    "-include-chain",
  ];
  const options = toObject(scan.optionsJson);

  if (behaviorOptions.followRedirects !== false && options.followRedirects !== false) {
    args.push("-fr");
  }

  if (options.includeRawResponse === true) {
    args.push("-sr");
  }

  if (behaviorOptions.browserLikeHeaders) {
    for (const header of BROWSER_LIKE_HEADERS) {
      args.push("-H", header);
    }
  }

  return args;
}

export function getHttpxBehaviorOptionsForProfile(profile: HttpxRequestProfile): HttpxBehaviorOptions {
  switch (profile) {
    case "baseline":
      return { browserLikeHeaders: false, followRedirects: null };
    case "browser_headers":
      return { browserLikeHeaders: true, followRedirects: null };
  }
}

export function getNextHttpxRequestProfile(profile: HttpxRequestProfile): HttpxRequestProfile | null {
  switch (profile) {
    case "baseline":
      return "browser_headers";
    case "browser_headers":
      return null;
  }
}

export function getHttpxExecutionTarget(target: string) {
  return getExecutionTarget(target);
}

export async function runHttpxCli({
  command,
  args,
  targets,
  timeoutMs,
  onJsonLine,
  allowNonJsonStdout = false,
  shouldCancel,
  cancellationPollIntervalMs = DEFAULT_CANCELLATION_POLL_INTERVAL_MS,
  signal,
  spawnProcess = spawn,
}: RunHttpxCliOptions): Promise<RunHttpxCliResult> {
  const httpx = spawnProcess(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = createInterface({ input: httpx.stdout });
  const stderrChunks: string[] = [];
  const nonJsonStdoutChunks: string[] = [];

  let terminationReason: RunHttpxCliResult["status"] | null = null;
  let cancellationCheckInFlight = false;
  let processClosed = false;

  const closePromise = new Promise<number>((resolve, reject) => {
    httpx.on("error", reject);
    httpx.on("close", (code) => {
      processClosed = true;
      resolve(code ?? 0);
    });
  });

  const terminateProcess = (reason: Exclude<RunHttpxCliResult["status"], "completed" | "failed">) => {
    if (terminationReason) {
      return;
    }

    terminationReason = reason;

    if (!processClosed) {
      httpx.kill("SIGTERM");
      setTimeout(() => {
        if (!processClosed) {
          httpx.kill("SIGKILL");
        }
      }, PROCESS_KILL_GRACE_PERIOD_MS).unref();
    }
  };

  const abortListener = () => {
    terminateProcess("aborted");
  };

  if (signal?.aborted) {
    terminateProcess("aborted");
  } else {
    signal?.addEventListener("abort", abortListener, { once: true });
  }

  const timeoutTimer = setTimeout(() => {
    terminateProcess("timed_out");
  }, timeoutMs);
  timeoutTimer.unref();

  const cancellationTimer = shouldCancel
    ? setInterval(async () => {
        if (terminationReason || cancellationCheckInFlight) {
          return;
        }

        cancellationCheckInFlight = true;

        try {
          if (await shouldCancel()) {
            terminateProcess("cancelled");
          }
        } catch (error) {
          logHttpxEvent("cancellation_check_failed", {
            errorName: getErrorName(error),
            message: getErrorMessage(error),
          });
        } finally {
          cancellationCheckInFlight = false;
        }
      }, cancellationPollIntervalMs)
    : null;

  cancellationTimer?.unref();

  httpx.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  for (const target of targets) {
    httpx.stdin.write(`${target}\n`);
  }
  httpx.stdin.end();

  try {
    for await (const line of stdout) {
      if (terminationReason) {
        continue;
      }

      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      try {
        const payload = JSON.parse(trimmed) as HttpxJson;
        await onJsonLine(payload);
      } catch (error) {
        if (!allowNonJsonStdout || !(error instanceof SyntaxError)) {
          throw error;
        }

        nonJsonStdoutChunks.push(trimmed);
      }
    }

    const exitCode = await closePromise;
    const stderr = stderrChunks.join(" ").trim();
    const stdoutNoise = nonJsonStdoutChunks.join(" ").trim();

    if (terminationReason) {
      return {
        status: terminationReason,
        exitCode,
        stderr,
      };
    }

    if (exitCode !== 0) {
      return {
        status: "failed",
        exitCode,
        stderr: stderr || stdoutNoise || `httpx exited with code ${exitCode}`,
      };
    }

    return {
      status: "completed",
      exitCode,
      stderr,
    };
  } finally {
    clearTimeout(timeoutTimer);
    if (cancellationTimer) {
      clearInterval(cancellationTimer);
    }
    stdout.close();
    signal?.removeEventListener("abort", abortListener);
  }
}
