import { describe, expect, it, vi } from "vitest";

import {
  classifyWebhookHttpFailure,
  deliverAlertWebhook,
  parseWebhookRetryAfter,
  validateAlertWebhookDestination,
} from "@/lib/server/alerts/webhook-delivery";
import type { AlertWebhookPayload } from "@/lib/server/alerts/webhook-payload";

const payload: AlertWebhookPayload = {
  schemaVersion: 2,
  event: { id: "event-1", type: "scan.changes.detected", occurredAt: "2026-07-17T12:00:00.000Z" },
  target: { id: "target-1", label: "Example", url: "https://example.com" },
  comparison: {
    id: "comparison-1",
    currentScanId: "scan-2",
    baselineScanId: "scan-1",
    url: "https://stackray.example/changes/comparison-1",
  },
  summary: { headline: "One change", totalChanges: 1, includedChanges: 1 },
  changes: [{ id: "change-1", category: "content", type: "favicon_changed", summary: "Favicon changed" }],
};

const publicResolver = async () => [{ address: "8.8.8.8", family: 4 }];

function fetchImplementation(handler: (input: URL, init: RequestInit) => Promise<Response>) {
  return handler as unknown as typeof fetch;
}

describe("alert webhook delivery", () => {
  it("posts signed JSON without following redirects or exposing credentials in results", async () => {
    const fetchSpy = vi.fn(async (input: URL, init: RequestInit) => {
      expect(input.toString()).toBe("https://hooks.example.test/opaque-token");
      expect(init.method).toBe("POST");
      expect(init.redirect).toBe("manual");
      expect(Buffer.isBuffer(init.body)).toBe(true);

      const headers = new Headers(init.headers);
      expect(headers.get("authorization")).toBe("Bearer credential");
      expect(headers.get("idempotency-key")).toBe("event-1");
      expect(headers.get("x-stackray-signature")).toMatch(/^v1=[a-f0-9]{64}$/);
      expect(headers.get("x-stackray-timestamp")).toMatch(/^\d+$/);
      return new Response("accepted", { status: 202 });
    });

    const result = await deliverAlertWebhook({
      endpoint: "https://hooks.example.test/opaque-token",
      eventId: "event-1",
      payload,
      authorization: "Bearer credential",
      signingSecret: "signing-secret",
      resolveAddresses: publicResolver,
      fetchImpl: fetchImplementation(fetchSpy),
    });

    expect(result).toEqual({ ok: true, httpStatus: 202, responseBytes: 8, responseTruncated: false });
    expect(JSON.stringify(result)).not.toContain("opaque-token");
    expect(JSON.stringify(result)).not.toContain("credential");
  });

  it("blocks local and private destinations before fetch", async () => {
    const fetchSpy = vi.fn();
    const result = await deliverAlertWebhook({
      endpoint: "https://hooks.example.test/token",
      eventId: "event-1",
      payload,
      resolveAddresses: async () => [{ address: "169.254.169.254", family: 4 }],
      fetchImpl: fetchImplementation(fetchSpy),
    });

    expect(result).toMatchObject({ ok: false, category: "blocked_destination", retryable: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(validateAlertWebhookDestination("https://127.0.0.1/hook")).rejects.toMatchObject({
      category: "blocked_destination",
    });
  });

  it("allows explicit HTTP localhost only for local development callers", async () => {
    await expect(validateAlertWebhookDestination("http://localhost:4321/hook")).rejects.toMatchObject({
      category: "invalid_destination",
    });
    await expect(
      validateAlertWebhookDestination("http://localhost:4321/hook", { allowHttpLocalhost: true }),
    ).resolves.toBeInstanceOf(URL);
  });

  it("classifies retryable and permanent HTTP responses", async () => {
    expect(classifyWebhookHttpFailure(408)).toEqual({ category: "request_timeout", retryable: true });
    expect(classifyWebhookHttpFailure(429)).toEqual({ category: "rate_limited", retryable: true });
    expect(classifyWebhookHttpFailure(503)).toEqual({ category: "server_error", retryable: true });
    expect(classifyWebhookHttpFailure(302)).toEqual({ category: "redirect", retryable: false });
    expect(classifyWebhookHttpFailure(400)).toEqual({ category: "client_error", retryable: false });

    const result = await deliverAlertWebhook({
      endpoint: "https://hooks.example.test/hook",
      eventId: "event-1",
      payload,
      resolveAddresses: publicResolver,
      now: () => Date.parse("2026-07-17T12:00:00.000Z"),
      fetchImpl: fetchImplementation(async () => new Response("slow down", { status: 429, headers: { "retry-after": "120" } })),
    });
    expect(result).toMatchObject({
      ok: false,
      category: "rate_limited",
      retryable: true,
      httpStatus: 429,
      retryAfterMs: 120_000,
    });
  });

  it("caps Retry-After and response consumption", async () => {
    expect(parseWebhookRetryAfter("999999")).toBe(3_600_000);
    expect(parseWebhookRetryAfter("invalid")).toBeUndefined();

    const result = await deliverAlertWebhook({
      endpoint: "https://hooks.example.test/hook",
      eventId: "event-1",
      payload,
      resolveAddresses: publicResolver,
      maxResponseBytes: 4,
      fetchImpl: fetchImplementation(async () => new Response("response is intentionally large", { status: 200 })),
    });
    expect(result).toEqual({ ok: true, httpStatus: 200, responseBytes: 4, responseTruncated: true });
  });

  it("returns a retryable timeout without including the endpoint", async () => {
    const result = await deliverAlertWebhook({
      endpoint: "https://hooks.example.test/secret-token",
      eventId: "event-1",
      payload,
      resolveAddresses: publicResolver,
      timeoutMs: 5,
      fetchImpl: fetchImplementation(
        async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("secret-token")), { once: true });
          }),
      ),
    });
    expect(result).toEqual({
      ok: false,
      category: "timeout",
      retryable: true,
      safeMessage: "The webhook request timed out.",
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
});
