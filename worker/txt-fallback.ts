import { resolveTxt } from "node:dns/promises";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

import type { parseNucleiJsonLine } from "./nuclei.ts";

type ParsedNucleiMatch = Exclude<ReturnType<typeof parseNucleiJsonLine>, null>;

const STACKRAY_DNS_SERVICE_TEMPLATE_ID = "stackray-dns-service-detection";
const STACKRAY_DNS_SERVICE_TEMPLATE_PATH = "dns/stackray-dns-service-detection.yaml";
const TXT_FINGERPRINT_TEMPLATE_ID = "txt-fingerprint";
const TXT_FINGERPRINT_TEMPLATE_PATH = "dns/txt-fingerprint.yaml";

type TxtDetectionRule = {
  templateId: string;
  templatePath: string;
  findingKind: "dns_service" | "technology";
  matcherName: string;
  words?: readonly string[];
  patterns?: readonly RegExp[];
};

const TXT_FALLBACK_TEMPLATE_SOURCES = [
  {
    templateId: "txt-service-detect",
    templatePath: "dns/txt-service-detect.yaml",
    findingKind: "dns_service",
    repoLocal: false,
  },
  {
    templateId: "replit-dns-verification",
    templatePath: "dns/replit-dns-verification.yaml",
    findingKind: "technology",
    repoLocal: true,
  },
  {
    templateId: STACKRAY_DNS_SERVICE_TEMPLATE_ID,
    templatePath: STACKRAY_DNS_SERVICE_TEMPLATE_PATH,
    findingKind: "dns_service",
    repoLocal: true,
  },
] as const satisfies ReadonlyArray<{
  templateId: string;
  templatePath: string;
  findingKind: TxtDetectionRule["findingKind"];
  repoLocal: boolean;
}>;

type TxtDetectionRuleCacheEntry = {
  signature: string;
  rules: Promise<readonly TxtDetectionRule[]>;
};

const txtDetectionRuleCache = new Map<string, TxtDetectionRuleCacheEntry>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asRegexArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const pattern = asString(entry)?.trim();

        if (!pattern) {
          return [];
        }

        return [pattern];
      })
    : [];
}

function compileNucleiRegex(pattern: string) {
  let flags = "u";
  let source = pattern;

  if (source.startsWith("(?i)")) {
    flags = "iu";
    source = source.slice(4);
  }

  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

export function parseNucleiTxtDetectionRulesTemplate(
  templateContents: string,
  source: Pick<TxtDetectionRule, "templateId" | "templatePath" | "findingKind"> = {
    templateId: "txt-service-detect",
    templatePath: "dns/txt-service-detect.yaml",
    findingKind: "dns_service",
  },
): TxtDetectionRule[] {
  const parsedTemplate = parseYaml(templateContents);

  if (!isObject(parsedTemplate)) {
    return [];
  }

  const rules: TxtDetectionRule[] = [];

  for (const dnsEntry of Array.isArray(parsedTemplate.dns) ? parsedTemplate.dns : []) {
    if (!isObject(dnsEntry)) {
      continue;
    }

    if (asString(dnsEntry.type)?.toUpperCase() !== "TXT") {
      continue;
    }

    if (asString(dnsEntry.name)?.trim() !== "{{FQDN}}") {
      continue;
    }

    if (!Array.isArray(dnsEntry.matchers)) {
      continue;
    }

    for (const matcher of dnsEntry.matchers) {
      if (!isObject(matcher)) {
        continue;
      }

      const matcherName = asString(matcher.name)?.trim();

      if (!matcherName) {
        continue;
      }

      if (matcher.type === "word") {
        const words = asStringArray(matcher.words)
          .map((word) => word.trim())
          .filter((word) => word.length > 0);

        if (words.length > 0) {
          rules.push({ ...source, matcherName, words });
        }

        continue;
      }

      if (matcher.type === "regex") {
        const patterns = asRegexArray(matcher.regex)
          .flatMap((pattern) => {
            const compiledPattern = compileNucleiRegex(pattern);

            return compiledPattern ? [compiledPattern] : [];
          });

        if (patterns.length > 0) {
          rules.push({ ...source, matcherName, patterns });
        }
      }
    }
  }

  return rules;
}

export function parseNucleiTxtServiceRulesTemplate(templateContents: string): TxtDetectionRule[] {
  return parseNucleiTxtDetectionRulesTemplate(templateContents);
}

function resolveTxtFallbackTemplatePath(source: typeof TXT_FALLBACK_TEMPLATE_SOURCES[number], templatesDir?: string | null) {
  if (source.repoLocal) {
    return fileURLToPath(new URL(`./nuclei-templates/${source.templatePath}`, import.meta.url));
  }

  return templatesDir ? join(templatesDir, source.templatePath) : null;
}

export async function loadStackrayTxtDnsServiceRules(input: {
  templatesDir?: string | null;
  readTemplateFile?: (templatePath: string) => Promise<string>;
}) {
  const rules: TxtDetectionRule[] = [];

  for (const source of TXT_FALLBACK_TEMPLATE_SOURCES) {
    const templatePath = resolveTxtFallbackTemplatePath(source, input.templatesDir);

    if (!templatePath) {
      continue;
    }

    if (input.readTemplateFile) {
      rules.push(...parseNucleiTxtDetectionRulesTemplate(await input.readTemplateFile(templatePath), source));
      continue;
    }

    let signature: string | null = null;

    try {
      const templateStat = await stat(templatePath);
      signature = `${templateStat.mtimeMs}:${templateStat.size}`;
    } catch {
      continue;
    }

    let cachedRules = txtDetectionRuleCache.get(templatePath);

    if (!cachedRules || cachedRules.signature !== signature) {
      cachedRules = {
        signature,
        rules: readFile(templatePath, "utf8")
        .then((templateContents) => parseNucleiTxtDetectionRulesTemplate(templateContents, source))
          .catch(() => []),
      };
      txtDetectionRuleCache.set(templatePath, cachedRules);
    }

    rules.push(...await cachedRules.rules);
  }

  return rules;
}

function txtRecordMatchesServiceRule(record: string, rule: TxtDetectionRule) {
  const normalizedRecord = record.toLowerCase();

  if (rule.words) {
    return rule.words.some((word) => normalizedRecord.includes(word.toLowerCase()));
  }

  return rule.patterns?.some((pattern) => pattern.test(record)) ?? false;
}

function buildStackrayTxtRecordMatch(input: {
  subject: string;
  txtRecords: readonly string[];
  txtRecordChunks: readonly (readonly string[])[];
}): ParsedNucleiMatch {
  const rawJson = {
    "template-id": TXT_FINGERPRINT_TEMPLATE_ID,
    "template-path": TXT_FINGERPRINT_TEMPLATE_PATH,
    "matcher-name": "regex-1",
    type: "dns",
    severity: "info",
    host: input.subject,
    "matched-at": input.subject,
    "extracted-results": [...input.txtRecords],
    "stackray-source": "node:dns.resolveTxt",
    "stackray-txt-record-chunks": input.txtRecordChunks.map((record) => [...record]),
  };

  return {
    templateId: TXT_FINGERPRINT_TEMPLATE_ID,
    templatePath: TXT_FINGERPRINT_TEMPLATE_PATH,
    matcherName: "regex-1",
    protocolType: "dns",
    severity: "info",
    matchedAt: input.subject,
    host: input.subject,
    ip: null,
    port: null,
    scheme: null,
    url: null,
    path: null,
    extractedResults: [...input.txtRecords],
    technologyName: null,
    technologyVersion: null,
    findingKind: "txt_record",
    subject: input.subject,
    subjectType: "domain",
    rawJson,
  };
}

function buildStackrayTxtDetectionMatch(input: {
  subject: string;
  rule: TxtDetectionRule;
  extractedResults: readonly string[];
  source: string;
}): ParsedNucleiMatch {
  const rawJson = {
    "template-id": input.rule.templateId,
    "template-path": input.rule.templatePath,
    "matcher-name": input.rule.matcherName,
    type: "dns",
    severity: "info",
    host: input.subject,
    "matched-at": input.subject,
    "extracted-results": [...input.extractedResults],
    "stackray-source": input.source,
  };

  return {
    templateId: input.rule.templateId,
    templatePath: input.rule.templatePath,
    matcherName: input.rule.matcherName,
    protocolType: "dns",
    severity: "info",
    matchedAt: input.subject,
    host: input.subject,
    ip: null,
    port: null,
    scheme: null,
    url: null,
    path: null,
    extractedResults: [...input.extractedResults],
    technologyName: input.rule.findingKind === "technology" ? input.rule.matcherName : null,
    technologyVersion: null,
    findingKind: input.rule.findingKind,
    subject: input.subject,
    subjectType: "domain",
    rawJson,
  };
}

export function buildStackrayTxtDetectionMatches(input: {
  subject: string;
  txtRecords: readonly string[];
  rules: readonly TxtDetectionRule[];
  source?: string;
}) {
  return input.rules.flatMap((rule) => {
    const extractedResults = input.txtRecords.filter((record) => txtRecordMatchesServiceRule(record, rule));

    if (extractedResults.length === 0) {
      return [];
    }

    return [buildStackrayTxtDetectionMatch({
      subject: input.subject,
      rule,
      extractedResults,
      source: input.source ?? "stackray:txt-service-rules",
    })];
  });
}

export function buildStackrayResolvedTxtMatches(input: {
  subject: string;
  txtRecords: readonly string[];
  rules: readonly TxtDetectionRule[];
  txtRecordChunks?: readonly (readonly string[])[];
}) {
  if (input.txtRecords.length === 0) {
    return [];
  }

  const txtRecordChunks = input.txtRecordChunks ?? input.txtRecords.map((record) => [record]);

  return [
    buildStackrayTxtRecordMatch({
      subject: input.subject,
      txtRecords: input.txtRecords,
      txtRecordChunks,
    }),
    ...buildStackrayTxtDetectionMatches({
      subject: input.subject,
      txtRecords: input.txtRecords,
      rules: input.rules,
      source: "node:dns.resolveTxt",
    }),
  ];
}

export function selectTxtFallbackSubjects(subjects: readonly string[], matches: readonly ParsedNucleiMatch[]) {
  const subjectsWithTxtRecords = new Set(
    matches.flatMap((match) => match.findingKind === "txt_record" && match.subject ? [match.subject] : []),
  );
  const fallbackSubjects: string[] = [];
  const seen = new Set<string>();

  for (const subject of subjects) {
    if (seen.has(subject) || subjectsWithTxtRecords.has(subject)) {
      continue;
    }

    seen.add(subject);
    fallbackSubjects.push(subject);
  }

  return fallbackSubjects;
}

export async function collectStackrayResolvedTxtMatches(input: {
  subjects: readonly string[];
  existingMatches: readonly ParsedNucleiMatch[];
  templatesDir?: string | null;
  txtDnsServiceRules?: readonly TxtDetectionRule[];
  readTxtDetectionTemplateFile?: (templatePath: string) => Promise<string>;
  resolveTxtRecords?: typeof resolveTxt;
}) {
  const matches: ParsedNucleiMatch[] = [];
  const resolveTxtRecords = input.resolveTxtRecords ?? resolveTxt;
  const txtDnsServiceRules = input.txtDnsServiceRules ?? await loadStackrayTxtDnsServiceRules({
    templatesDir: input.templatesDir,
    readTemplateFile: input.readTxtDetectionTemplateFile,
  });
  const existingTxtRecordsBySubject = new Map<string, string[]>();

  for (const match of input.existingMatches) {
    if (match.findingKind !== "txt_record" || !match.subject || match.extractedResults.length === 0) {
      continue;
    }

    const existingTxtRecords = existingTxtRecordsBySubject.get(match.subject) ?? [];
    existingTxtRecords.push(...match.extractedResults);
    existingTxtRecordsBySubject.set(match.subject, existingTxtRecords);
  }

  for (const subject of new Set(input.subjects)) {
    const existingTxtRecords = existingTxtRecordsBySubject.get(subject);

    if (existingTxtRecords) {
      matches.push(...buildStackrayTxtDetectionMatches({
        subject,
        txtRecords: existingTxtRecords,
        rules: txtDnsServiceRules,
        source: "stackray:existing-txt-record",
      }));
      continue;
    }

    try {
      const txtRecordChunks = await resolveTxtRecords(subject);
      const txtRecords = txtRecordChunks.map((record) => record.join(""));
      matches.push(...buildStackrayResolvedTxtMatches({
        subject,
        txtRecords,
        rules: txtDnsServiceRules,
        txtRecordChunks,
      }));
    } catch {
      // TXT fallback evidence is opportunistic; Nuclei findings still determine the run status.
      continue;
    }
  }

  return matches;
}
