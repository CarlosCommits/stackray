import { z } from "zod";

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

export const taskList = {
  http_probe: async (payload: unknown) => {
    const parsed = runScanPayloadSchema.parse(payload);
    await runHttpProbeById(parsed.scanId);
  },
  run_scan: async (payload: unknown) => {
    const parsed = runScanPayloadSchema.parse(payload);
    await runHttpProbeById(parsed.scanId);
  },
  headless: async (payload: unknown) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runHeadlessPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId);
  },
  browser_fallback: async (payload: unknown) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runBrowserFallbackPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId);
  },
  subfinder: async (payload: unknown) => {
    const parsed = attemptPhasePayloadSchema.parse(payload);
    await runSubfinderPhaseById(parsed.scanId, parsed.attemptId);
  },
  nuclei_dns: async (payload: unknown) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runNucleiDnsPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId);
  },
  nuclei_http: async (payload: unknown) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runNucleiHttpPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId);
  },
  ip_intel: async (payload: unknown) => {
    const parsed = resultPhasePayloadSchema.parse(payload);
    await runIpIntelPhaseById(parsed.scanId, parsed.attemptId, parsed.resultId);
  },
  finalize: async (payload: unknown) => {
    const parsed = attemptPhasePayloadSchema.parse(payload);
    await finalizeScanById(parsed.scanId, parsed.attemptId);
  },
  schedule_due_scans: async (payload: unknown) => {
    if (payload !== undefined && typeof payload !== "object") {
      throw new Error("schedule_due_scans expects an object payload.");
    }

    await dispatchDueSchedules();
  },
};
