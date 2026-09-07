import { describe, expect, it } from "vitest";

import {
  serializeAlertWebhookPayload,
  signAlertWebhookPayload,
  verifyAlertWebhookSignature,
} from "@/lib/server/alerts/webhook-payload";

describe("alert webhook payload signatures", () => {
  const payloadBytes = serializeAlertWebhookPayload({
    schemaVersion: 2,
    event: { id: "event-1", type: "scan.changes.detected", occurredAt: "2026-07-17T12:00:00.000Z" },
    target: { id: "target-1", label: "Example", url: "https://example.com" },
    comparison: {
      id: "comparison-1",
      currentScanId: "scan-2",
      baselineScanId: "scan-1",
      url: "https://stackray.example/changes/comparison-1",
    },
    summary: { headline: "Status changed", totalChanges: 1, includedChanges: 1 },
    changes: [{ id: "change-1", category: "availability", type: "status_changed", summary: "200 → 503" }],
  });

  it("signs and verifies the exact serialized bytes and timestamp", () => {
    const signed = signAlertWebhookPayload(payloadBytes, "signing-secret", "1784289600");

    expect(signed).toEqual({
      timestamp: "1784289600",
      signature: "v1=fc2d22e98b4b3c46e3d986cdd2147fe190a975740150a3235d1c272bd2056cba",
    });
    expect(verifyAlertWebhookSignature(payloadBytes, "signing-secret", signed)).toBe(true);
    expect(verifyAlertWebhookSignature(Buffer.concat([payloadBytes, Buffer.from(" ")]), "signing-secret", signed)).toBe(false);
    expect(verifyAlertWebhookSignature(payloadBytes, "signing-secret", { ...signed, timestamp: "1784289601" })).toBe(false);
  });

  it("does not accept malformed signatures", () => {
    expect(
      verifyAlertWebhookSignature(payloadBytes, "signing-secret", {
        timestamp: "1784289600",
        signature: "not-a-valid-signature",
      }),
    ).toBe(false);
  });
});
