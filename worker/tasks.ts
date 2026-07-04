import { z } from "zod";
import type { JobHelpers } from "graphile-worker";

import {
  finalizeScanById,
  runBrowserFallbackPhaseById,
  runHeadlessPhaseById,
  runHttpProbeById,
  runIpIntelPhaseById,
  runNucleiDnsPhaseById,
  runNucleiHttpPhaseById,
  runSubfinderPhaseById,
} from "./scan-worker.ts";
import { dispatchDueSchedules } from "./schedules.ts";

const runScanPayloadSchema = z.object({
  scanId: z.string().min(1),
});

const attemptPhasePayloadSchema = z.object({
  scanId: z.string().min(1),
  attemptId: z.string().min(1),
});

const resultPhasePayloadSchema = attemptPhasePayloadSchema.extend({
  resultId: z.string().min(1),
});

type TaskHelpers = Pick<JobHelpers, "abortSignal">;

export const taskList = {
  http_probe: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = runScanPayloadSchema.parse(payload);
    await runHttpProbeById(parsed.scanId, helpers.abortSignal);
  },
  run_scan: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = runScanPayloadSchema.parse(payload);
    await runHttpProbeById(parsed.scanId, helpers.abortSignal);
  },
  headless: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runHeadlessPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId, helpers.abortSignal);
  },
  browser_fallback: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runBrowserFallbackPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId, helpers.abortSignal);
  },
  subfinder: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = attemptPhasePayloadSchema.parse(payload);
    await runSubfinderPhaseById(parsed.scanId, parsed.attemptId, helpers.abortSignal);
  },
  nuclei_dns: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runNucleiDnsPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId, helpers.abortSignal);
  },
  nuclei_http: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runNucleiHttpPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId, helpers.abortSignal);
  },
  ip_intel: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runIpIntelPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId, helpers.abortSignal);
  },
  finalize: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = attemptPhasePayloadSchema.parse(payload);
    await finalizeScanById(parsed.scanId, parsed.attemptId, helpers.abortSignal);
  },
  schedule_due_scans: async (payload: unknown) => {
    if (payload !== undefined && typeof payload !== "object") {
      throw new Error("schedule_due_scans expects an object payload.");
    }

    await dispatchDueSchedules();
  },
};
