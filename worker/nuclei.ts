import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { fileURLToPath } from "node:url";

const PROCESS_KILL_GRACE_PERIOD_MS = 1_000;

export type NucleiExecutionSubjectType = "url" | "domain";

type NucleiTemplateDefinition = {
  id: string;
  path: string;
  findingKind: string;
  subjectType: NucleiExecutionSubjectType;
  repoLocal?: boolean;
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
    id: "payloadcms-detect",
    path: "http/technologies/payloadcms-detect.yaml",
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
    id: "replit-dns-verification",
    path: "dns/replit-dns-verification.yaml",
    findingKind: "technology",
    subjectType: "domain",
    repoLocal: true,
  },
  {
    id: "stackray-dns-service-detection",
    path: "dns/stackray-dns-service-detection.yaml",
    findingKind: "dns_service",
    subjectType: "domain",
    repoLocal: true,
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
export const NUCLEI_DOMAIN_TEMPLATE_IDS = NUCLEI_TEMPLATE_DEFINITIONS.flatMap((template) => {
  return template.subjectType === "domain" && template.id !== "txt-service-detect" && template.id !== "rdap-whois"
    ? [template.id]
    : [];
});
export const NUCLEI_RDAP_TEMPLATE_IDS = ["rdap-whois"] as const;
export const NUCLEI_TXT_SERVICE_TEMPLATE_IDS = ["txt-service-detect"] as const;
export const NUCLEI_URL_TEMPLATE_IDS = NUCLEI_TEMPLATE_DEFINITIONS.flatMap((template) => {
  return template.subjectType === "url" ? [template.id] : [];
});

const NUCLEI_TECHNOLOGY_TEMPLATE_IDS = new Set<string>([
  "fingerprinthub-web-fingerprints",
  "payloadcms-detect",
  "replit-dns-verification",
  "tech-detect",
]);

const NUCLEI_TECHNOLOGY_TEMPLATE_NAMES = new Map<string, string>([
  ["payloadcms-detect", "Payload CMS"],
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

type RunNucleiCliResult = {
  status: "completed" | "failed" | "timed_out" | "aborted";
  exitCode: number;
  stderr: string;
};

type RunNucleiCliOptions = {
  command: string;
  args: readonly string[];
  timeoutMs: number;
  signal?: AbortSignal;
  onJsonLine: (payload: NucleiJson) => Promise<void> | void;
  spawnProcess?: NucleiSpawn;
};

type ParsedNucleiMatch = {
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
        .flatMap((entry) => {
          const stringValue = asString(entry);

          return stringValue === null ? [] : [stringValue];
        })
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

function resolveRepoLocalTemplatePath(templatePath: string) {
  return fileURLToPath(new URL(`./nuclei-templates/${templatePath}`, import.meta.url));
}

function resolveConfiguredTemplatePath(templatesDir: string, templatePath: string) {
  return `${templatesDir.replace(/[\\/]+$/g, "")}/${templatePath}`;
}

function isRepoLocalTemplate(template: NucleiTemplateDefinition) {
  return template.repoLocal === true || template.path.endsWith("-custom.yaml");
}

export function buildNucleiArguments({
  target,
  templateIds,
  templatePaths = [],
  includeTags = [],
  disableRedirects = true,
  headers,
  templatesDir,
}: {
  target: string;
  templateIds: readonly string[];
  templatePaths?: readonly string[];
  includeTags?: readonly string[];
  disableRedirects?: boolean;
  headers: readonly string[];
  templatesDir?: string | null;
}) {
  const idModeTemplateIds: string[] = [];
  const repoLocalTemplatePaths: string[] = [];

  for (const templateId of templateIds) {
    const template = NUCLEI_TEMPLATE_BY_ID.get(templateId);
    const templatePath = template?.path;

    if (!template || !templatePath) {
      continue;
    }

    if (isRepoLocalTemplate(template)) {
      repoLocalTemplatePaths.push(templatePath);
      continue;
    }

    idModeTemplateIds.push(templateId);
  }

  const args = [
    "-u",
    target,
    "-jsonl",
    "-silent",
    "-nc",
    "-or",
    "-ot",
    "-duc",
  ];

  if (disableRedirects) {
    args.splice(2, 0, "-dr");
  }

  for (const includeTag of includeTags) {
    args.push("-itags", includeTag);
  }

  if (templatesDir) {
    for (const templateId of templateIds) {
      const template = NUCLEI_TEMPLATE_BY_ID.get(templateId);
      const templatePath = template?.path;

      if (!template || !templatePath) {
        continue;
      }

      if (isRepoLocalTemplate(template)) {
        continue;
      }

      args.push("-t", resolveConfiguredTemplatePath(templatesDir, templatePath));
    }
  } else if (idModeTemplateIds.length > 0) {
    args.push("-id", idModeTemplateIds.join(","));
  }

  for (const templatePath of repoLocalTemplatePaths) {
    args.push("-t", resolveRepoLocalTemplatePath(templatePath));
  }

  for (const templatePath of templatePaths) {
    args.push("-t", templatesDir ? resolveConfiguredTemplatePath(templatesDir, templatePath) : resolveRepoLocalTemplatePath(templatePath));
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
  const technologyName = NUCLEI_TECHNOLOGY_TEMPLATE_IDS.has(templateId)
    ? matcherName ?? NUCLEI_TECHNOLOGY_TEMPLATE_NAMES.get(templateId) ?? null
    : null;
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
  signal,
  onJsonLine,
  spawnProcess = spawn,
}: RunNucleiCliOptions): Promise<RunNucleiCliResult> {
  const nuclei = spawnProcess(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = createInterface({ input: nuclei.stdout });
  const stderrChunks: string[] = [];

  let terminationReason: Exclude<RunNucleiCliResult["status"], "completed" | "failed"> | null = null;
  let processClosed = false;

  const closePromise = new Promise<number>((resolve, reject) => {
    nuclei.on("error", reject);
    nuclei.on("close", (code) => {
      processClosed = true;
      stdout.close();
      resolve(code ?? 0);
    });
  });

  const terminateProcess = (reason: Exclude<RunNucleiCliResult["status"], "completed" | "failed">) => {
    if (terminationReason) {
      return;
    }

    terminationReason = reason;

    if (!processClosed) {
      nuclei.kill("SIGTERM");
      setTimeout(() => {
        if (!processClosed) {
          nuclei.kill("SIGKILL");
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
    signal?.removeEventListener("abort", abortListener);
    stdout.close();
  }
}
