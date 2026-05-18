import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const PROCESS_KILL_GRACE_PERIOD_MS = 1_000;
const DEFAULT_CANCELLATION_POLL_INTERVAL_MS = 500;

type SubfinderJson = Record<string, unknown>;

type SubfinderProcess = {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(event: "error", listener: (error: Error) => void): SubfinderProcess;
  on(event: "close", listener: (code: number | null) => void): SubfinderProcess;
  killed?: boolean;
};

type SubfinderSpawn = (
  command: string,
  args: readonly string[],
  options: { stdio: ["ignore", "pipe", "pipe"] },
) => SubfinderProcess;

export type ParsedSubfinderResult = {
  host: string;
  input: string | null;
  ip: string | null;
  source: string | null;
  sources: string[];
  wildcardCertificate: boolean;
  rawJson: Record<string, unknown>;
};

export type RunSubfinderCliResult = {
  status: "completed" | "failed" | "cancelled" | "timed_out" | "aborted";
  exitCode: number;
  stderr: string;
};

type RunSubfinderCliOptions = {
  command: string;
  args: readonly string[];
  timeoutMs: number;
  onJsonLine: (payload: SubfinderJson) => Promise<void> | void;
  shouldCancel?: () => boolean | Promise<boolean>;
  cancellationPollIntervalMs?: number;
  signal?: AbortSignal;
  spawnProcess?: SubfinderSpawn;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const stringValue = asString(entry);
        return stringValue === null ? [] : [stringValue];
      })
    : [];
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export function buildSubfinderArguments(domain: string, timeoutMs: number) {
  const maxTimeMinutes = Math.max(1, Math.ceil(timeoutMs / 60_000));

  return [
    "-silent",
    "-json",
    "-d",
    domain,
    "-nW",
    "-oI",
    "-duc",
    "-max-time",
    String(maxTimeMinutes),
  ];
}

export function parseSubfinderJsonLine(payload: Record<string, unknown>): ParsedSubfinderResult | null {
  const host = asString(payload.host);

  if (!host) {
    return null;
  }

  const source = asString(payload.source);
  const sources = asStringArray(payload.sources);

  return {
    host: host.toLowerCase(),
    input: asString(payload.input),
    ip: asString(payload.ip),
    source,
    sources,
    wildcardCertificate: asBoolean(payload.wildcard_certificate),
    rawJson: payload,
  };
}

export async function runSubfinderCli({
  command,
  args,
  timeoutMs,
  onJsonLine,
  shouldCancel,
  cancellationPollIntervalMs = DEFAULT_CANCELLATION_POLL_INTERVAL_MS,
  signal,
  spawnProcess = spawn,
}: RunSubfinderCliOptions): Promise<RunSubfinderCliResult> {
  const subfinder = spawnProcess(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = createInterface({ input: subfinder.stdout });
  const stderrChunks: string[] = [];
  let terminationReason: RunSubfinderCliResult["status"] | null = null;
  let cancellationCheckInFlight = false;
  let streamProcessingError: unknown = null;
  let cancellationCheckError: unknown = null;
  let processClosed = false;

  const closePromise = new Promise<number>((resolve, reject) => {
    subfinder.on("error", reject);
    subfinder.on("close", (code) => {
      processClosed = true;
      resolve(code ?? 0);
    });
  });

  const terminateProcess = (reason: Exclude<RunSubfinderCliResult["status"], "completed">) => {
    if (terminationReason) {
      return;
    }

    terminationReason = reason;

    if (!processClosed) {
      subfinder.kill("SIGTERM");
      setTimeout(() => {
        if (!processClosed) {
          subfinder.kill("SIGKILL");
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
          cancellationCheckError = error;
          terminateProcess("failed");
        } finally {
          cancellationCheckInFlight = false;
        }
      }, cancellationPollIntervalMs)
    : null;
  cancellationTimer?.unref();

  const stdoutPromise = (async () => {
    try {
      for await (const line of stdout) {
        const trimmed = line.trim();

        if (!trimmed) {
          continue;
        }

        const payload = JSON.parse(trimmed) as SubfinderJson;
        await onJsonLine(payload);
      }
    } catch (error) {
      streamProcessingError = error;
      terminateProcess("failed");
    }
  })();

  subfinder.stderr.on("data", (chunk) => {
    stderrChunks.push(String(chunk));
  });

  try {
    const [exitCode] = await Promise.all([closePromise, stdoutPromise]);
    const stderrParts = [
      stderrChunks.join("").trim(),
      streamProcessingError instanceof Error ? streamProcessingError.message : null,
      cancellationCheckError instanceof Error ? cancellationCheckError.message : null,
    ].filter((part): part is string => Boolean(part));
    const stderr = stderrParts.join("\n").trim();

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
        stderr,
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
    signal?.removeEventListener("abort", abortListener);
    stdout.close();
  }
}
