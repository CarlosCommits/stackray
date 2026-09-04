import { describe, expect, it, vi } from "vitest";

import {
  buildSlackAlertMessage,
  deliverSlackAlert,
  validateSlackWebhookUrl,
} from "./slack-delivery.ts";
import type { AlertWebhookPayload } from "./webhook-payload.ts";

const payload: AlertWebhookPayload = {
  schemaVersion: 2,
  event: { id: "event-1", type: "scan.changes.detected", occurredAt: "2026-08-30T12:00:00.000Z" },
  target: { id: "target-1", label: "Example & Company", url: "https://example.com" },
  comparison: {
    id: "comparison-1",
    currentScanId: "scan-2",
    baselineScanId: "scan-1",
    url: "https://stackray.example/targets/target-1/changes?comparison=comparison-1",
  },
  summary: { headline: "2 changes detected", totalChanges: 2, includedChanges: 2 },
  changes: [
    {
      id: "change-1",
      category: "technology",
      type: "technology.changed",
      summary: "Detected technologies changed",
      preview: "Added React 19 · Removed React 18",
    },
    {
      id: "change-2",
      category: "content",
      type: "metadata.title_changed",
      summary: "Page title changed",
      preview: "Before → After",
      endpoint: "https://example.com/",
    },
  ],
};

describe("Slack alert delivery", () => {
  it("accepts only Slack incoming webhook URLs", () => {
    expect(validateSlackWebhookUrl("https://hooks.slack.com/services/T1/B2/secret").hostname).toBe("hooks.slack.com");
    expect(() => validateSlackWebhookUrl("https://example.com/services/T1/B2/secret")).toThrow("Slack incoming webhook");
    expect(() => validateSlackWebhookUrl("https://hooks.slack.com.evil.test/services/T1/B2/secret")).toThrow();
    expect(() => validateSlackWebhookUrl("https://hooks.slack.com/services/T1/B2/secret?copy=1")).toThrow();
  });

  it("builds accessible Block Kit content with shared change previews", () => {
    const message = buildSlackAlertMessage(payload);
    expect(message.text).toBe("Stackray: 2 changes detected for Example & Company");
    expect(JSON.stringify(message.blocks)).toContain("Detected technologies changed");
    expect(JSON.stringify(message.blocks)).toContain("Added React 19 · Removed React 18");
    expect(JSON.stringify(message.blocks)).toContain("Review changes");
    expect(JSON.stringify(message.blocks)).toContain("Example &amp; Company");
  });

  it("posts Block Kit without exposing the webhook URL in results", async () => {
    const fetchMock = vi.fn(async (input: URL, init: RequestInit) => {
      expect(input.toString()).toBe("https://hooks.slack.com/services/T1/B2/secret");
      expect(init.redirect).toBe("manual");
      expect(JSON.parse(String(init.body))).toMatchObject({ text: expect.stringContaining("2 changes") });
      return new Response("ok", { status: 200 });
    });
    const result = await deliverSlackAlert({
      webhookUrl: "https://hooks.slack.com/services/T1/B2/secret",
      payload,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, httpStatus: 200 });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("classifies archived, revoked, and rate-limited destinations", async () => {
    const webhookUrl = "https://hooks.slack.com/services/T1/B2/secret";
    await expect(deliverSlackAlert({
      webhookUrl,
      payload,
      fetchImpl: vi.fn(async () => new Response("channel_is_archived", { status: 410 })) as unknown as typeof fetch,
    })).resolves.toMatchObject({ ok: false, category: "channel_archived", retryable: false });
    await expect(deliverSlackAlert({
      webhookUrl,
      payload,
      fetchImpl: vi.fn(async () => new Response("no_active_hooks", { status: 404 })) as unknown as typeof fetch,
    })).resolves.toMatchObject({ ok: false, category: "webhook_revoked", retryable: false });
    await expect(deliverSlackAlert({
      webhookUrl,
      payload,
      fetchImpl: vi.fn(async () => new Response("slow down", { status: 429, headers: { "retry-after": "60" } })) as unknown as typeof fetch,
    })).resolves.toMatchObject({ ok: false, category: "rate_limited", retryable: true, retryAfterMs: 60_000 });
  });
});
