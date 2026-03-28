import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { join } from "node:path";

const PROCESS_KILL_GRACE_PERIOD_MS = 1_000;

export const NUCLEI_TEMPLATE_ALLOWLIST = [
  "dns-saas-service-detection",
  "txt-service-detect",
  "mx-service-detector",
  "ssl-dns-names",
  "ssl-issuer",
  "fingerprinthub-web-fingerprints",
  "tech-detect",
] as const;

const NUCLEI_TECHNOLOGY_TEMPLATE_IDS = new Set<string>([
  "fingerprinthub-web-fingerprints",
  "tech-detect",
]);

const NUCLEI_FINDING_KIND_BY_TEMPLATE_ID = new Map<string, string>([
  ["dns-saas-service-detection", "dns_service"],
  ["txt-service-detect", "dns_service"],
  ["mx-service-detector", "dns_service"],
  ["ssl-dns-names", "ssl_dns_names"],
  ["ssl-issuer", "ssl_issuer"],
  ["fingerprinthub-web-fingerprints", "technology"],
  ["tech-detect", "technology"],
]);

type NucleiJson = Record<string, unknown>;

type NucleiProcess = {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(event: "error", listener: (error: Error) => void): NucleiProcess;
  on(event: "close", listener: (code: number | null) => void): NucleiProcess;
  killed?: boolean;
};

type NucleiSpawn = (
  command: string,
  args: readonly string[],
  options: { stdio: ["ignore", "pipe", "pipe"] },
) => NucleiProcess;

export type RunNucleiCliResult = {
  status: "completed" | "failed" | "timed_out";
  exitCode: number;
  stderr: string;
};

export type RunNucleiCliOptions = {
  command: string;
  args: readonly string[];
  timeoutMs: number;
  onJsonLine: (payload: NucleiJson) => Promise<void> | void;
  spawnProcess?: NucleiSpawn;
};

export type ParsedNucleiMatch = {
  templateId: string;
  templatePath: string | null;
  matcherName: string | null;
  protocolType: string | null;
  severity: string | null;
  matchedAt: string | null;
  host: string | null;
  ip: string | null;
  port: string | null;
  scheme: string | null;
  url: string | null;
  path: string | null;
  extractedResults: string[];
  technologyName: string | null;
  technologyVersion: string | null;
  findingKind: string;
  rawJson: Record<string, unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => asString(entry))
        .filter((entry): entry is string => entry !== null)
    : [];
}

function asPortString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return asString(value);
}

function getFindingKind(templateId: string) {
  return NUCLEI_FINDING_KIND_BY_TEMPLATE_ID.get(templateId) ?? "finding";
}

export function buildNucleiArguments({
  targetUrl,
  headers,
  templatesDir,
}: {
  targetUrl: string;
  headers: readonly string[];
  templatesDir?: string | null;
}) {
  const args = [
    "-u",
    targetUrl,
    "-dr",
    "-jsonl",
    "-silent",
    "-nc",
    "-or",
    "-ot",
    "-itags",
    "txt-service",
  ];

  if (templatesDir) {
    const templatePaths = [
      "dns/dns-saas-service-detection.yaml",
      "dns/txt-service-detect.yaml",
      "dns/mx-service-detector.yaml",
      "ssl/ssl-dns-names.yaml",
      "ssl/detect-ssl-issuer.yaml",
      "http/technologies/fingerprinthub-web-fingerprints.yaml",
      "http/technologies/tech-detect.yaml",
    ];

    for (const templatePath of templatePaths) {
      args.push("-t", join(templatesDir, templatePath));
    }
  } else {
    args.push("-id", NUCLEI_TEMPLATE_ALLOWLIST.join(","));
  }

  for (const header of headers) {
    args.push("-H", header);
  }

  return args;
}

export function parseNucleiJsonLine(payload: Record<string, unknown>): ParsedNucleiMatch | null {
  if (!isObject(payload)) {
    return null;
  }

  const templateId = asString(payload["template-id"]);

  if (!templateId) {
    return null;
  }

  const matcherName = asString(payload["matcher-name"]);
  const technologyName = NUCLEI_TECHNOLOGY_TEMPLATE_IDS.has(templateId) ? matcherName : null;

  return {
    templateId,
    templatePath: asString(payload["template-path"]) ?? asString(payload.template),
    matcherName,
    protocolType: asString(payload.type),
    severity: asString(payload.severity),
    matchedAt: asString(payload["matched-at"]),
    host: asString(payload.host),
    ip: asString(payload.ip),
    port: asPortString(payload.port),
    scheme: asString(payload.scheme),
    url: asString(payload.url),
    path: asString(payload.path),
    extractedResults: asStringArray(payload["extracted-results"]),
    technologyName,
    technologyVersion: null,
    findingKind: getFindingKind(templateId),
    rawJson: payload,
  };
}

export async function runNucleiCli({
  command,
  args,
  timeoutMs,
  onJsonLine,
  spawnProcess = spawn,
}: RunNucleiCliOptions): Promise<RunNucleiCliResult> {
  const nuclei = spawnProcess(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = createInterface({ input: nuclei.stdout });
  const stderrChunks: string[] = [];

  let timedOut = false;

  const closePromise = new Promise<number>((resolve, reject) => {
    nuclei.on("error", reject);
    nuclei.on("close", (code) => {
      resolve(code ?? 0);
    });
  });

  const timeoutTimer = setTimeout(() => {
    timedOut = true;

    if (!nuclei.killed) {
      nuclei.kill("SIGTERM");
      setTimeout(() => {
        if (!nuclei.killed) {
          nuclei.kill("SIGKILL");
        }
      }, PROCESS_KILL_GRACE_PERIOD_MS).unref();
    }
  }, timeoutMs);
  timeoutTimer.unref();

  nuclei.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  try {
    for await (const line of stdout) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      const payload = JSON.parse(trimmed) as NucleiJson;
      await onJsonLine(payload);
    }

    const exitCode = await closePromise;
    const stderr = stderrChunks.join(" ").trim();

    if (timedOut) {
      return {
        status: "timed_out",
        exitCode,
        stderr,
      };
    }

    if (exitCode !== 0) {
      return {
        status: "failed",
        exitCode,
        stderr: stderr || `nuclei exited with code ${exitCode}`,
      };
    }

    return {
      status: "completed",
      exitCode,
      stderr,
    };
  } finally {
    clearTimeout(timeoutTimer);
    stdout.close();
  }
}
