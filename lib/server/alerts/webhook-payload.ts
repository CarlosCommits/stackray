import { createHmac, timingSafeEqual } from "node:crypto";

export const ALERT_WEBHOOK_SCHEMA_VERSION = 2 as const;
export const ALERT_WEBHOOK_EVENT_TYPE = "scan.changes.detected" as const;

export interface AlertWebhookChange {
  id: string;
  category: string;
  type: string;
  summary: string;
  preview?: string;
  endpoint?: string;
}

export interface AlertWebhookPayload {
  schemaVersion: typeof ALERT_WEBHOOK_SCHEMA_VERSION;
  event: {
    id: string;
    type: typeof ALERT_WEBHOOK_EVENT_TYPE;
    occurredAt: string;
  };
  target: {
    id: string;
    label: string;
    url: string;
  };
  comparison: {
    id: string;
    currentScanId: string;
    baselineScanId: string;
    url: string;
  };
  summary: {
    headline: string;
    totalChanges: number;
    includedChanges: number;
    listedChanges?: number;
  };
  changes: AlertWebhookChange[];
}

export interface AlertWebhookSignature {
  timestamp: string;
  signature: string;
}

function signatureInput(timestamp: string, payloadBytes: Uint8Array) {
  return Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), payloadBytes]);
}

export function serializeAlertWebhookPayload(payload: AlertWebhookPayload) {
  if (payload.schemaVersion !== ALERT_WEBHOOK_SCHEMA_VERSION) {
    throw new Error("Unsupported alert webhook payload version.");
  }

  return Buffer.from(JSON.stringify(payload), "utf8");
}

export function signAlertWebhookPayload(
  payloadBytes: Uint8Array,
  signingSecret: string,
  timestamp = Math.floor(Date.now() / 1000).toString(),
): AlertWebhookSignature {
  if (signingSecret.length === 0) {
    throw new Error("A webhook signing secret cannot be empty.");
  }
  if (!/^\d+$/.test(timestamp)) {
    throw new Error("The webhook signature timestamp must contain Unix epoch seconds.");
  }

  const digest = createHmac("sha256", signingSecret).update(signatureInput(timestamp, payloadBytes)).digest("hex");
  return { timestamp, signature: `v1=${digest}` };
}

export function verifyAlertWebhookSignature(
  payloadBytes: Uint8Array,
  signingSecret: string,
  signature: AlertWebhookSignature,
) {
  let expected: AlertWebhookSignature;
  try {
    expected = signAlertWebhookPayload(payloadBytes, signingSecret, signature.timestamp);
  } catch {
    return false;
  }

  const actualBytes = Buffer.from(signature.signature, "utf8");
  const expectedBytes = Buffer.from(expected.signature, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
