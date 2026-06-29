import { and, eq, inArray } from "drizzle-orm";
import { getDomain } from "tldts";

import {
  scanPhaseRuns,
  scanResultDetections,
  scanResultNucleiMatches,
  scanResultNucleiRuns,
  scanResults,
  scans,
} from "../drizzle/schema.ts";
import { env } from "../lib/env/server.ts";
import { getExecutionTarget } from "../lib/server/scans/normalize-targets.ts";
import { getNucleiDnsServiceTechnologyName } from "../lib/server/scans/technology-enrichment.ts";
import { BROWSER_LIKE_HEADERS } from "./httpx.ts";
import { db } from "./db.ts";
import {
  buildNucleiArguments,
  NUCLEI_DOMAIN_TEMPLATE_IDS,
  NUCLEI_RDAP_TEMPLATE_IDS,
  NUCLEI_TEMPLATE_ALLOWLIST,
  NUCLEI_TXT_SERVICE_TEMPLATE_IDS,
  NUCLEI_URL_TEMPLATE_IDS,
  type NucleiExecutionSubjectType,
  parseNucleiJsonLine,
  runNucleiCli,
  withNucleiMatchExecutionContext,
} from "./nuclei.ts";
import { buildNucleiTechnologyDetectionRows } from "./result-detections.ts";
import { updateResultSearchDocument } from "./result-persistence.ts";
import { collectStackrayResolvedTxtMatches } from "./txt-fallback.ts";
import type { ClaimedScan } from "./scan-claims.ts";

type ScanRow = typeof scans.$inferSelect;
type ScanResultRow = typeof scanResults.$inferSelect;
type NucleiRunStatus = typeof scanResultNucleiRuns.$inferInsert.status;
type ParsedNucleiMatch = Exclude<ReturnType<typeof parseNucleiJsonLine>, null>;

export type NucleiTargetSelection = {
  targetUrl: string | null;
  targetHost: string | null;
  originalDomainTarget: string | null;
  finalDomainTarget: string | null;
  domainTarget: string | null;
};

export type NucleiExecutionPhase = {
  subject: string;
  subjectType: NucleiExecutionSubjectType;
  templateIds: readonly string[];
  templatePaths?: readonly string[];
  includeTags?: readonly string[];
  disableRedirects?: boolean;
};

export type NucleiPhaseGroup = "dns" | "http";

const DEFAULT_NUCLEI_TIMEOUT_MS = env.STACKRAY_NUCLEI_TIMEOUT_MS ?? 2 * 60 * 1000;

function logWorkerEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      component: "httpx-worker",
      event,
      ...payload,
    }),
  );
}

function getNucleiMatchDedupeKey(match: ParsedNucleiMatch) {
  const subject = match.subject ?? match.matchedAt ?? "";

  if (match.findingKind === "txt_record") {
    return [match.findingKind, subject].join("::");
  }

  if (match.findingKind === "dns_service") {
    const serviceName = getNucleiDnsServiceTechnologyName(match) ?? match.matcherName ?? "";

    return [match.findingKind, subject, serviceName.trim().toLowerCase()].join("::");
  }

  if (match.findingKind === "domain_metadata") {
    const rawExtractorName = match.rawJson["extractor-name"];
    const extractorName = Array.isArray(rawExtractorName)
      ? rawExtractorName.filter((name): name is string => typeof name === "string").join(",")
      : typeof rawExtractorName === "string"
        ? rawExtractorName
        : "";

    return [match.findingKind, extractorName, subject].join("::");
  }

  return [match.findingKind, match.matcherName ?? "", subject].join("::");
}

function mergeNucleiMatchEvidence(existingMatch: ParsedNucleiMatch, nextMatch: ParsedNucleiMatch): ParsedNucleiMatch {
  const extractedResults = [...new Set([...existingMatch.extractedResults, ...nextMatch.extractedResults])];

  if (extractedResults.length === existingMatch.extractedResults.length) {
    return existingMatch;
  }

  return {
    ...existingMatch,
    extractedResults,
    rawJson: {
      ...existingMatch.rawJson,
      "extracted-results": extractedResults,
    },
  };
}

export function mergeUniqueNucleiMatches(matches: readonly ParsedNucleiMatch[]) {
  const mergedMatches: ParsedNucleiMatch[] = [];
  const mergedMatchIndexes = new Map<string, number>();

  for (const match of matches) {
    const key = getNucleiMatchDedupeKey(match);
    const existingIndex = mergedMatchIndexes.get(key);

    if (existingIndex === undefined) {
      mergedMatchIndexes.set(key, mergedMatches.length);
      mergedMatches.push(match);
      continue;
    }

    const existingMatch = mergedMatches[existingIndex];

    if (!existingMatch) {
      mergedMatchIndexes.set(key, mergedMatches.length);
      mergedMatches.push(match);
      continue;
    }

    mergedMatches[existingIndex] = mergeNucleiMatchEvidence(existingMatch, match);
  }

  return mergedMatches;
}

function appendUniqueNucleiMatches(matches: ParsedNucleiMatch[], nextMatches: readonly ParsedNucleiMatch[]) {
  matches.splice(0, matches.length, ...mergeUniqueNucleiMatches([...matches, ...nextMatches]));
}

function getNucleiTargetUrl(result: Pick<ScanResultRow, "finalUrl" | "url">) {
  const candidate = result.finalUrl ?? result.url;

  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function getNucleiTargetHost(targetUrl: string | null) {
  if (!targetUrl) {
    return null;
  }

  try {
    const parsed = new URL(targetUrl);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

function getRegistrableDomain(target: string | null) {
  if (!target) {
    return null;
  }

  const domain = getDomain(getExecutionTarget(target));
  return domain ? domain.toLowerCase() : null;
}

export function selectNucleiTargets(
  scanTarget: Pick<ScanRow, "normalizedTarget">,
  result: Pick<ScanResultRow, "finalUrl" | "url">,
): NucleiTargetSelection {
  const targetUrl = getNucleiTargetUrl(result);
  const targetHost = getNucleiTargetHost(targetUrl);
  const originalDomainTarget = getRegistrableDomain(scanTarget.normalizedTarget);
  const finalDomainTarget = getRegistrableDomain(targetHost);
  const domainTarget = originalDomainTarget ?? finalDomainTarget;

  return {
    targetUrl,
    targetHost,
    originalDomainTarget,
    finalDomainTarget,
    domainTarget,
  };
}

export function buildNucleiExecutionPhases(targets: NucleiTargetSelection): NucleiExecutionPhase[] {
  const phases: NucleiExecutionPhase[] = [];
  const seenDomainTargets = new Set<string>();

  for (const domainTarget of [targets.originalDomainTarget, targets.finalDomainTarget]) {
    if (!domainTarget || seenDomainTargets.has(domainTarget)) {
      continue;
    }

    seenDomainTargets.add(domainTarget);
    phases.push({
      subject: domainTarget,
      subjectType: "domain",
      templateIds: NUCLEI_DOMAIN_TEMPLATE_IDS,
    });
    phases.push({
      subject: domainTarget,
      subjectType: "domain",
      templateIds: NUCLEI_RDAP_TEMPLATE_IDS,
      disableRedirects: false,
    });
    phases.push({
      subject: domainTarget,
      subjectType: "domain",
      templateIds: NUCLEI_TXT_SERVICE_TEMPLATE_IDS,
      includeTags: ["txt-service"],
    });
  }

  if (targets.targetUrl) {
    phases.push({
      subject: targets.targetUrl,
      subjectType: "url",
      templateIds: NUCLEI_URL_TEMPLATE_IDS,
    });
  }

  return phases;
}

export async function upsertNucleiRunState({
  resultId,
  status,
  targetUrl,
  targetHost,
  originalDomainTarget,
  finalDomainTarget,
  domainTarget,
  errorMessage,
  startedAt,
  completedAt,
}: {
  resultId: string;
  status: NucleiRunStatus;
  targetUrl: string | null;
  targetHost: string | null;
  originalDomainTarget: string | null;
  finalDomainTarget: string | null;
  domainTarget: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}) {
  const [run] = await db
    .insert(scanResultNucleiRuns)
    .values({
      resultId,
      status,
      targetUrl,
      targetHost,
      originalDomainTarget,
      finalDomainTarget,
      domainTarget,
      headersJson: [...BROWSER_LIKE_HEADERS],
      templateIdsJson: [...NUCLEI_TEMPLATE_ALLOWLIST],
      engineVersion: null,
      templatesVersion: null,
      errorMessage,
      startedAt,
      completedAt,
    })
    .onConflictDoUpdate({
      target: scanResultNucleiRuns.resultId,
      set: {
        status,
        targetUrl,
        targetHost,
        originalDomainTarget,
        finalDomainTarget,
        domainTarget,
        headersJson: [...BROWSER_LIKE_HEADERS],
        templateIdsJson: [...NUCLEI_TEMPLATE_ALLOWLIST],
        engineVersion: null,
        templatesVersion: null,
        errorMessage,
        startedAt,
        completedAt,
      },
    })
    .returning();

  return run;
}

async function deleteNucleiTechnologyDetections(resultId: string) {
  await db
    .delete(scanResultDetections)
    .where(
      and(
        eq(scanResultDetections.resultId, resultId),
        eq(scanResultDetections.kind, "technology"),
        eq(scanResultDetections.source, "nuclei"),
      ),
    );
}

function getNucleiFailureMessage(result: { status: "completed" | "failed" | "timed_out"; exitCode: number; stderr: string }) {
  if (result.status === "timed_out") {
    return "nuclei enrichment timed out.";
  }

  return result.stderr || `nuclei exited with code ${result.exitCode}.`;
}

function buildNucleiLogPayload(
  targetUrl: string | null,
  targetHost: string | null,
  originalDomainTarget: string | null,
  finalDomainTarget: string | null,
  domainTarget: string | null,
) {
  return {
    targetUrl,
    targetHost,
    originalDomainTarget,
    finalDomainTarget,
    domainTarget,
    command: env.NUCLEI_BIN ?? "nuclei",
    timeoutMs: DEFAULT_NUCLEI_TIMEOUT_MS,
    headerCount: BROWSER_LIKE_HEADERS.length,
    templateCount: NUCLEI_TEMPLATE_ALLOWLIST.length,
    templateIds: [...NUCLEI_TEMPLATE_ALLOWLIST],
    templatesDir: env.NUCLEI_TEMPLATES_DIR ?? null,
    templateSelectionMode: env.NUCLEI_TEMPLATES_DIR ? "paths" : "ids",
  };
}

function filterNucleiExecutionPhasesForGroup(phases: readonly NucleiExecutionPhase[], group: NucleiPhaseGroup) {
  return phases.filter((phase) => group === "dns" ? phase.subjectType === "domain" : phase.subjectType === "url");
}

function getNucleiPhaseGroupLabel(group: NucleiPhaseGroup) {
  return group === "dns" ? "nuclei_dns" : "nuclei_http";
}

async function deleteNucleiMatchesForExecutionPhases(runId: string, executionPhases: readonly NucleiExecutionPhase[]) {
  const templateIds = [...new Set(executionPhases.flatMap((phase) => phase.templateIds))];

  if (templateIds.length === 0) {
    return;
  }

  await db
    .delete(scanResultNucleiMatches)
    .where(and(eq(scanResultNucleiMatches.runId, runId), inArray(scanResultNucleiMatches.templateId, templateIds)));
}

async function insertNucleiMatches(runId: string, resultId: string, matches: readonly ParsedNucleiMatch[]) {
  if (matches.length === 0) {
    return;
  }

  await db.insert(scanResultNucleiMatches).values(
    matches.map((match) => ({
      runId,
      resultId,
      templateId: match.templateId,
      templatePath: match.templatePath,
      matcherName: match.matcherName,
      protocolType: match.protocolType,
      severity: match.severity,
      matchedAt: match.matchedAt,
      host: match.host,
      ip: match.ip,
      port: match.port,
      scheme: match.scheme,
      url: match.url,
      path: match.path,
      extractedResultsJson: match.extractedResults,
      technologyName: match.technologyName,
      technologyVersion: match.technologyVersion,
      findingKind: match.findingKind,
      subject: match.subject,
      subjectType: match.subjectType,
      rawJson: match.rawJson,
    })),
  );
}

export async function rebuildNucleiTechnologyDetections(result: ScanResultRow) {
  const matches = await db
    .select({
      templateId: scanResultNucleiMatches.templateId,
      findingKind: scanResultNucleiMatches.findingKind,
      matcherName: scanResultNucleiMatches.matcherName,
      technologyName: scanResultNucleiMatches.technologyName,
      technologyVersion: scanResultNucleiMatches.technologyVersion,
    })
    .from(scanResultNucleiMatches)
    .where(eq(scanResultNucleiMatches.resultId, result.id));

  await deleteNucleiTechnologyDetections(result.id);

  const nucleiTechnologyRows = buildNucleiTechnologyDetectionRows({
    resultId: result.id,
    matches,
  });

  if (nucleiTechnologyRows.length > 0) {
    await db.insert(scanResultDetections).values(nucleiTechnologyRows);
  }

  await updateResultSearchDocument(result, []);
  return nucleiTechnologyRows;
}

export async function enrichResultWithNucleiPhaseGroup(
  scanId: string,
  scanTarget: Pick<ScanRow, "normalizedTarget">,
  result: ScanResultRow,
  group: NucleiPhaseGroup,
) {
  const nucleiTargets = selectNucleiTargets(scanTarget, result);
  const allExecutionPhases = buildNucleiExecutionPhases(nucleiTargets);
  const executionPhases = filterNucleiExecutionPhasesForGroup(allExecutionPhases, group);
  const phaseLabel = getNucleiPhaseGroupLabel(group);
  const nucleiLogPayload = buildNucleiLogPayload(
    nucleiTargets.targetUrl,
    nucleiTargets.targetHost,
    nucleiTargets.originalDomainTarget,
    nucleiTargets.finalDomainTarget,
    nucleiTargets.domainTarget,
  );

  if (executionPhases.length === 0) {
    logWorkerEvent("nuclei_phase_skipped", {
      scanId,
      resultId: result.id,
      phase: phaseLabel,
      reason: "missing_nuclei_targets",
      ...nucleiLogPayload,
    });
    return {
      status: "skipped" as const,
      matchCount: 0,
      technologyCount: 0,
      errorMessage: "No Nuclei targets were available for this phase.",
    };
  }

  const startedAt = new Date();
  const run = await upsertNucleiRunState({
    resultId: result.id,
    status: "running",
    targetUrl: nucleiTargets.targetUrl,
    targetHost: nucleiTargets.targetHost,
    originalDomainTarget: nucleiTargets.originalDomainTarget,
    finalDomainTarget: nucleiTargets.finalDomainTarget,
    domainTarget: nucleiTargets.domainTarget,
    errorMessage: null,
    startedAt,
    completedAt: null,
  });

  await deleteNucleiMatchesForExecutionPhases(run.id, executionPhases);
  await rebuildNucleiTechnologyDetections(result);

  logWorkerEvent("nuclei_phase_started", {
    scanId,
    resultId: result.id,
    phase: phaseLabel,
    executionPhaseCount: executionPhases.length,
    ...nucleiLogPayload,
  });

  try {
    const matches: ParsedNucleiMatch[] = [];

    for (const phase of executionPhases) {
      const nucleiResult = await runNucleiCli({
        command: env.NUCLEI_BIN ?? "nuclei",
        args: buildNucleiArguments({
          target: phase.subject,
          templateIds: phase.templateIds,
          templatePaths: phase.templatePaths,
          includeTags: phase.includeTags,
          disableRedirects: phase.disableRedirects,
          headers: BROWSER_LIKE_HEADERS,
          templatesDir: env.NUCLEI_TEMPLATES_DIR ?? null,
        }),
        timeoutMs: DEFAULT_NUCLEI_TIMEOUT_MS,
        onJsonLine: async (payload) => {
          const parsedMatch = parseNucleiJsonLine(payload);

          if (!parsedMatch) {
            return;
          }

          matches.push(
            withNucleiMatchExecutionContext(parsedMatch, {
              subject: phase.subject,
              subjectType: phase.subjectType,
            }),
          );
        },
      });

      if (nucleiResult.status !== "completed") {
        const errorMessage = getNucleiFailureMessage(nucleiResult);

        await insertNucleiMatches(run.id, result.id, mergeUniqueNucleiMatches(matches));
        const nucleiTechnologyRows = await rebuildNucleiTechnologyDetections(result);
        await upsertNucleiRunState({
          resultId: result.id,
          status: "failed",
          targetUrl: nucleiTargets.targetUrl,
          targetHost: nucleiTargets.targetHost,
          originalDomainTarget: nucleiTargets.originalDomainTarget,
          finalDomainTarget: nucleiTargets.finalDomainTarget,
          domainTarget: nucleiTargets.domainTarget,
          errorMessage,
          startedAt,
          completedAt: new Date(),
        });

        logWorkerEvent("nuclei_phase_failed", {
          scanId,
          resultId: result.id,
          phase: phaseLabel,
          status: nucleiResult.status,
          exitCode: nucleiResult.exitCode,
          message: errorMessage,
          failedSubject: phase.subject,
          failedSubjectType: phase.subjectType,
          ...nucleiLogPayload,
        });

        return {
          status: "failed" as const,
          matchCount: matches.length,
          technologyCount: nucleiTechnologyRows.length,
          errorMessage,
        };
      }
    }

    if (group === "dns") {
      appendUniqueNucleiMatches(
        matches,
        await collectStackrayResolvedTxtMatches({
          subjects: executionPhases.flatMap((phase) => phase.subjectType === "domain" ? [phase.subject] : []),
          existingMatches: matches,
          templatesDir: env.NUCLEI_TEMPLATES_DIR ?? null,
        }),
      );
    }

    const uniqueMatches = mergeUniqueNucleiMatches(matches);
    await insertNucleiMatches(run.id, result.id, uniqueMatches);
    const nucleiTechnologyRows = await rebuildNucleiTechnologyDetections(result);

    logWorkerEvent("nuclei_phase_completed", {
      scanId,
      resultId: result.id,
      phase: phaseLabel,
      matchCount: uniqueMatches.length,
      technologyCount: nucleiTechnologyRows.length,
      findingCount: uniqueMatches.length - nucleiTechnologyRows.length,
      executionPhaseCount: executionPhases.length,
      durationMs: Date.now() - startedAt.getTime(),
      ...nucleiLogPayload,
    });

    return {
      status: "completed" as const,
      matchCount: uniqueMatches.length,
      technologyCount: nucleiTechnologyRows.length,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Nuclei enrichment failed.";

    await upsertNucleiRunState({
      resultId: result.id,
      status: "failed",
      targetUrl: nucleiTargets.targetUrl,
      targetHost: nucleiTargets.targetHost,
      originalDomainTarget: nucleiTargets.originalDomainTarget,
      finalDomainTarget: nucleiTargets.finalDomainTarget,
      domainTarget: nucleiTargets.domainTarget,
      errorMessage,
      startedAt,
      completedAt: new Date(),
    });
    await rebuildNucleiTechnologyDetections(result);

    logWorkerEvent("nuclei_phase_failed", {
      scanId,
      resultId: result.id,
      phase: phaseLabel,
      status: "exception",
      message: errorMessage,
      ...nucleiLogPayload,
    });

    return {
      status: "failed" as const,
      matchCount: 0,
      technologyCount: 0,
      errorMessage,
    };
  }
}

export async function finalizeNucleiRunAggregate(
  claimedScan: ClaimedScan,
  result: ScanResultRow | null,
  phaseRuns: readonly (typeof scanPhaseRuns.$inferSelect)[],
) {
  if (!result) {
    return;
  }

  const nucleiPhases = phaseRuns.filter((phaseRun) => phaseRun.phase === "nuclei_dns" || phaseRun.phase === "nuclei_http");

  if (nucleiPhases.length === 0 || nucleiPhases.some((phaseRun) => !["completed", "failed", "skipped", "cancelled"].includes(phaseRun.status))) {
    return;
  }

  const nucleiTargets = selectNucleiTargets(claimedScan.target, result);
  const [existingRun] = await db
    .select()
    .from(scanResultNucleiRuns)
    .where(eq(scanResultNucleiRuns.resultId, result.id))
    .limit(1);
  const aggregateStatus: NucleiRunStatus = nucleiPhases.some((phaseRun) => phaseRun.status === "failed")
    ? "failed"
    : nucleiPhases.some((phaseRun) => phaseRun.status === "completed")
      ? "completed"
    : "skipped";
  const errorMessages = nucleiPhases.flatMap((phaseRun) => phaseRun.errorMessage ? [`${phaseRun.phase}: ${phaseRun.errorMessage}`] : []);

  await upsertNucleiRunState({
    resultId: result.id,
    status: aggregateStatus,
    targetUrl: nucleiTargets.targetUrl,
    targetHost: nucleiTargets.targetHost,
    originalDomainTarget: nucleiTargets.originalDomainTarget,
    finalDomainTarget: nucleiTargets.finalDomainTarget,
    domainTarget: nucleiTargets.domainTarget,
    errorMessage: errorMessages.length > 0 ? errorMessages.join(" | ") : null,
    startedAt: existingRun?.startedAt ?? nucleiPhases.find((phaseRun) => phaseRun.startedAt)?.startedAt ?? new Date(),
    completedAt: new Date(),
  });
  await rebuildNucleiTechnologyDetections(result);
}
