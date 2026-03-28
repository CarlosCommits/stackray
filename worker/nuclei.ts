import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { join } from "node:path";

const PROCESS_KILL_GRACE_PERIOD_MS = 1_000;

export type NucleiExecutionSubjectType = "url" | "domain";

type NucleiTemplateDefinition = {
  id: string;
  path: string;
  findingKind: string;
  subjectType: NucleiExecutionSubjectType;
};

const NUCLEI_TEMPLATE_DEFINITIONS: readonly NucleiTemplateDefinition[] = [
  {
    id: "dns-saas-service-detection",
    path: "dns/dns-saas-service-detection.yaml",
    findingKind: "dns_service",
    subjectType: "domain",
  },
  {
    id: "txt-service-detect",
    path: "dns/txt-service-detect.yaml",
    findingKind: "dns_service",
    subjectType: "domain",
  },
  {
    id: "mx-service-detector",
    path: "dns/mx-service-detector.yaml",
    findingKind: "dns_service",
    subjectType: "domain",
  },
  {
    id: "ssl-dns-names",
    path: "ssl/ssl-dns-names.yaml",
    findingKind: "ssl_dns_names",
    subjectType: "url",
  },
  {
    id: "ssl-issuer",
    path: "ssl/detect-ssl-issuer.yaml",
    findingKind: "ssl_issuer",
    subjectType: "url",
  },
  {
    id: "fingerprinthub-web-fingerprints",
    path: "http/technologies/fingerprinthub-web-fingerprints.yaml",
    findingKind: "technology",
    subjectType: "url",
  },
  {
    id: "tech-detect",
    path: "http/technologies/tech-detect.yaml",
    findingKind: "technology",
    subjectType: "url",
  },
  {
    id: "txt-fingerprint",
    path: "dns/txt-fingerprint.yaml",
    findingKind: "txt_record",
    subjectType: "domain",
  },
  {
    id: "nameserver-fingerprint",
    path: "dns/nameserver-fingerprint.yaml",
    findingKind: "nameserver_record",
    subjectType: "domain",
  },
  {
    id: "rdap-whois",
    path: "http/miscellaneous/rdap-whois.yaml",
    findingKind: "domain_metadata",
    subjectType: "domain",
  },
  {
    id: "robots-txt",
    path: "http/miscellaneous/robots-txt.yaml",
    findingKind: "robots_txt",
    subjectType: "url",
  },
] as const;

const NUCLEI_TEMPLATE_BY_ID = new Map(NUCLEI_TEMPLATE_DEFINITIONS.map((template) => [template.id, template]));

export const NUCLEI_TEMPLATE_ALLOWLIST = NUCLEI_TEMPLATE_DEFINITIONS.map((template) => template.id);
export const NUCLEI_DOMAIN_TEMPLATE_IDS = NUCLEI_TEMPLATE_DEFINITIONS.filter(
  (template) => template.subjectType === "domain",
).map((template) => template.id);
export const NUCLEI_URL_TEMPLATE_IDS = NUCLEI_TEMPLATE_DEFINITIONS.filter(
  (template) => template.subjectType === "url",
).map((template) => template.id);

const NUCLEI_TECHNOLOGY_TEMPLATE_IDS = new Set<string>([
  "fingerprinthub-web-fingerprints",
  "tech-detect",
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
  subject: string | null;
  subjectType: NucleiExecutionSubjectType | null;
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
  return NUCLEI_TEMPLATE_BY_ID.get(templateId)?.findingKind ?? "finding";
}

export function buildNucleiArguments({
  target,
  templateIds,
  headers,
  templatesDir,
}: {
  target: string;
  templateIds: readonly string[];
  headers: readonly string[];
  templatesDir?: string | null;
}) {
  const args = [
    "-u",
    target,
    "-dr",
    "-jsonl",
    "-silent",
    "-nc",
    "-or",
    "-ot",
    // Keep txt-service-detect eligible even if a local nuclei ignore/exclude setup
    // would otherwise skip txt-service-tagged templates. The explicit -id/-t values
    // below still determine the full template set we run.
    "-itags",
    "txt-service",
  ];

  if (templatesDir) {
    for (const templateId of templateIds) {
      const templatePath = NUCLEI_TEMPLATE_BY_ID.get(templateId)?.path;

      if (!templatePath) {
        continue;
      }

      args.push("-t", join(templatesDir, templatePath));
    }
  } else {
    args.push("-id", templateIds.join(","));
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
  const template = NUCLEI_TEMPLATE_BY_ID.get(templateId);

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
    subject: null,
    subjectType: template?.subjectType ?? null,
    rawJson: payload,
  };
}

export function withNucleiMatchExecutionContext(
  match: ParsedNucleiMatch,
  executionContext: { subject: string; subjectType: NucleiExecutionSubjectType },
): ParsedNucleiMatch {
  return {
    ...match,
    subject: executionContext.subject,
    subjectType: executionContext.subjectType,
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
