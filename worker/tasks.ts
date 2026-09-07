import { z } from "zod";
import type { JobHelpers } from "graphile-worker";

import {
  finalizeScanById,
  recomputeScanChangesById,
  runBrowserFallbackPhaseById,
  runHeadlessPhaseById,
  runHttpProbeById,
  runIpIntelPhaseById,
  runNucleiDnsPhaseById,
  runNucleiHttpPhaseById,
  runSubfinderPhaseById,
} from "./scan-worker.ts";
import { dispatchDueSchedules } from "./schedules.ts";
import { deliverAlert } from "../lib/server/alerts/delivery-service.ts";
import {
  cleanupExpiredResendOauthSetupSessions,
  refreshConfiguredResendOauthGrant,
} from "../lib/server/email/oauth-grant.ts";

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

const deliveryPayloadSchema = z.object({
  deliveryId: z.string().min(1),
  readinessDeferralCount: z.number().int().nonnegative().default(0),
});

type TaskHelpers = Pick<JobHelpers, "abortSignal"> & Partial<Pick<JobHelpers, "addJob">> & {
  job?: Pick<JobHelpers["job"], "max_attempts">;
};

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
  recompute_scan_changes: async (payload: unknown) => {
    const parsed = runScanPayloadSchema.parse(payload);
    await recomputeScanChangesById(parsed.scanId);
  },
  deliver_alert: async (payload: unknown, helpers: TaskHelpers) => {
    const parsed = deliveryPayloadSchema.parse(payload);
    const result = await deliverAlert(parsed.deliveryId, {
      ...(helpers.job ? { maxAttempts: helpers.job.max_attempts } : {}),
      readinessDeferralCount: parsed.readinessDeferralCount,
    });

    if (result?.status === "deferred") {
      if (!helpers.addJob) {
        throw new Error("Graphile Worker addJob helper is required to defer an alert delivery.");
      }

      const nextDeferralCount = parsed.readinessDeferralCount + 1;
      await helpers.addJob("deliver_alert", {
        deliveryId: parsed.deliveryId,
        readinessDeferralCount: nextDeferralCount,
      }, {
        jobKey: `alert-delivery-readiness:${parsed.deliveryId}:${nextDeferralCount}`,
        jobKeyMode: "unsafe_dedupe",
        queueName: `alert-channel:${result.channelId}`,
        runAt: result.retryAt,
        maxAttempts: helpers.job?.max_attempts ?? 8,
      });
    }
  },
  refresh_resend_oauth: async (payload: unknown) => {
    if (payload !== undefined && typeof payload !== "object") {
      throw new Error("refresh_resend_oauth expects an object payload.");
    }

    await cleanupExpiredResendOauthSetupSessions();
    await refreshConfiguredResendOauthGrant();
  },
  schedule_due_scans: async (payload: unknown) => {
    if (payload !== undefined && typeof payload !== "object") {
      throw new Error("schedule_due_scans expects an object payload.");
    }

    await dispatchDueSchedules();
  },
};
