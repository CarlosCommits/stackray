import { beforeEach, describe, expect, it, vi } from "vitest";

import { scanPhaseKindEnum } from "../drizzle/schema.ts";
import { taskList } from "./tasks.ts";

const scanWorkerMocks = vi.hoisted(() => ({
  finalizeScanById: vi.fn(),
  recomputeScanChangesById: vi.fn(),
  runBrowserFallbackPhaseById: vi.fn(),
  runHeadlessPhaseById: vi.fn(),
  runHttpProbeById: vi.fn(),
  runIpIntelPhaseById: vi.fn(),
  runNucleiDnsPhaseById: vi.fn(),
  runNucleiHttpPhaseById: vi.fn(),
  runSubfinderPhaseById: vi.fn(),
}));

const alertMocks = vi.hoisted(() => ({
  deliverAlert: vi.fn(),
}));

const scheduleMocks = vi.hoisted(() => ({
  dispatchDueSchedules: vi.fn(),
}));

const emailMocks = vi.hoisted(() => ({
  cleanupExpiredResendOauthSetupSessions: vi.fn(),
  refreshConfiguredResendOauthGrant: vi.fn(),
}));

vi.mock("./scan-worker.ts", () => ({
  finalizeScanById: scanWorkerMocks.finalizeScanById,
  recomputeScanChangesById: scanWorkerMocks.recomputeScanChangesById,
  runBrowserFallbackPhaseById: scanWorkerMocks.runBrowserFallbackPhaseById,
  runHeadlessPhaseById: scanWorkerMocks.runHeadlessPhaseById,
  runHttpProbeById: scanWorkerMocks.runHttpProbeById,
  runIpIntelPhaseById: scanWorkerMocks.runIpIntelPhaseById,
  runNucleiDnsPhaseById: scanWorkerMocks.runNucleiDnsPhaseById,
  runNucleiHttpPhaseById: scanWorkerMocks.runNucleiHttpPhaseById,
  runSubfinderPhaseById: scanWorkerMocks.runSubfinderPhaseById,
}));

vi.mock("../lib/server/alerts/delivery-service.ts", () => ({
  deliverAlert: alertMocks.deliverAlert,
}));

vi.mock("./schedules.ts", () => ({
  dispatchDueSchedules: scheduleMocks.dispatchDueSchedules,
}));

vi.mock("../lib/server/email/oauth-grant.ts", () => ({
  cleanupExpiredResendOauthSetupSessions: emailMocks.cleanupExpiredResendOauthSetupSessions,
  refreshConfiguredResendOauthGrant: emailMocks.refreshConfiguredResendOauthGrant,
}));

const expectedGraphileTaskNames = [
  "browser_fallback",
  "deliver_alert",
  "finalize",
  "headless",
  "http_probe",
  "ip_intel",
  "nuclei_dns",
  "nuclei_http",
  "recompute_scan_changes",
  "refresh_resend_oauth",
  "run_scan",
  "schedule_due_scans",
  "subfinder",
];

describe("worker task alignment", () => {
  beforeEach(() => {
    for (const mock of Object.values(scanWorkerMocks)) {
      mock.mockReset();
    }
    scheduleMocks.dispatchDueSchedules.mockReset();
    alertMocks.deliverAlert.mockReset();
    emailMocks.refreshConfiguredResendOauthGrant.mockReset();
    emailMocks.cleanupExpiredResendOauthSetupSessions.mockReset();
  });

  it("keeps Graphile task names stable", () => {
    expect(Object.keys(taskList).toSorted()).toEqual(expectedGraphileTaskNames);
  });

  it("has a Graphile task for every persisted scan phase", () => {
    expect(scanPhaseKindEnum.enumValues.toSorted()).toEqual([
      "browser_fallback",
      "finalize",
      "headless",
      "http_probe",
      "ip_intel",
      "nuclei_dns",
      "nuclei_http",
      "subfinder",
    ]);

    for (const phase of scanPhaseKindEnum.enumValues) {
      expect(taskList).toHaveProperty(phase);
    }
  });

  it("forwards Graphile abort signals into scan phase runners", async () => {
    const abortSignal = new AbortController().signal;
    const helpers = { abortSignal };

    await taskList.http_probe?.({ scanId: "scan_01" }, helpers);
    await taskList.run_scan?.({ scanId: "scan_02" }, helpers);
    await taskList.headless?.({ scanId: "scan_03", attemptId: "attempt_03", resultId: "result_03" }, helpers);
    await taskList.browser_fallback?.({ scanId: "scan_04", attemptId: "attempt_04", resultId: "result_04" }, helpers);
    await taskList.subfinder?.({ scanId: "scan_05", attemptId: "attempt_05" }, helpers);
    await taskList.nuclei_dns?.({ scanId: "scan_06", attemptId: "attempt_06", resultId: "result_06" }, helpers);
    await taskList.nuclei_http?.({ scanId: "scan_07", attemptId: "attempt_07", resultId: "result_07" }, helpers);
    await taskList.ip_intel?.({ scanId: "scan_08", attemptId: "attempt_08", resultId: "result_08" }, helpers);
    await taskList.finalize?.({ scanId: "scan_09", attemptId: "attempt_09" }, helpers);
    await taskList.recompute_scan_changes?.({ scanId: "scan_10" });
    await taskList.deliver_alert?.({ deliveryId: "delivery_01" }, {
      ...helpers,
      job: { max_attempts: 6 },
    });
    await taskList.refresh_resend_oauth?.({});

    expect(scanWorkerMocks.runHttpProbeById).toHaveBeenNthCalledWith(1, "scan_01", abortSignal);
    expect(scanWorkerMocks.runHttpProbeById).toHaveBeenNthCalledWith(2, "scan_02", abortSignal);
    expect(scanWorkerMocks.runHeadlessPhaseById).toHaveBeenCalledWith("scan_03", "attempt_03", "result_03", abortSignal);
    expect(scanWorkerMocks.runBrowserFallbackPhaseById).toHaveBeenCalledWith("scan_04", "attempt_04", "result_04", abortSignal);
    expect(scanWorkerMocks.runSubfinderPhaseById).toHaveBeenCalledWith("scan_05", "attempt_05", abortSignal);
    expect(scanWorkerMocks.runNucleiDnsPhaseById).toHaveBeenCalledWith("scan_06", "attempt_06", "result_06", abortSignal);
    expect(scanWorkerMocks.runNucleiHttpPhaseById).toHaveBeenCalledWith("scan_07", "attempt_07", "result_07", abortSignal);
    expect(scanWorkerMocks.runIpIntelPhaseById).toHaveBeenCalledWith("scan_08", "attempt_08", "result_08", abortSignal);
    expect(scanWorkerMocks.finalizeScanById).toHaveBeenCalledWith("scan_09", "attempt_09", abortSignal);
    expect(scanWorkerMocks.recomputeScanChangesById).toHaveBeenCalledWith("scan_10");
    expect(alertMocks.deliverAlert).toHaveBeenCalledWith("delivery_01", {
      maxAttempts: 6,
      readinessDeferralCount: 0,
    });
    expect(emailMocks.refreshConfiguredResendOauthGrant).toHaveBeenCalledOnce();
    expect(emailMocks.cleanupExpiredResendOauthSetupSessions).toHaveBeenCalledOnce();
  });

  it("schedules a deduplicated follow-up without failing the current job when alert delivery is deferred", async () => {
    const retryAt = new Date("2026-08-29T18:00:30.000Z");
    const addJob = vi.fn().mockResolvedValue(undefined);
    alertMocks.deliverAlert.mockResolvedValue({
      status: "deferred",
      channelId: "channel_01",
      retryAt,
    });

    await taskList.deliver_alert?.({
      deliveryId: "delivery_01",
      readinessDeferralCount: 3,
    }, {
      abortSignal: new AbortController().signal,
      addJob,
      job: { max_attempts: 6 },
    });

    expect(alertMocks.deliverAlert).toHaveBeenCalledWith("delivery_01", {
      maxAttempts: 6,
      readinessDeferralCount: 3,
    });
    expect(addJob).toHaveBeenCalledWith("deliver_alert", {
      deliveryId: "delivery_01",
      readinessDeferralCount: 4,
    }, {
      jobKey: "alert-delivery-readiness:delivery_01:4",
      jobKeyMode: "unsafe_dedupe",
      queueName: "alert-channel:channel_01",
      runAt: retryAt,
      maxAttempts: 6,
    });
  });
});
