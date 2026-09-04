import { describe, expect, it } from "vitest";

import type { AlertWebhookPayload } from "../../alerts/webhook-payload";
import { buildAuthEmail } from "./auth-email";
import { buildChangeAlertEmail } from "./change-alert";
import { buildTestEmail } from "./test-email";

const payload: AlertWebhookPayload = {
  schemaVersion: 2,
  event: {
    id: "event-1",
    type: "scan.changes.detected",
    occurredAt: "2026-08-24T12:00:00.000Z",
  },
  target: {
    id: "target-1",
    label: "example.com",
    url: "https://example.com",
  },
  comparison: {
    id: "comparison-1",
    currentScanId: "scan-2",
    baselineScanId: "scan-1",
    url: "https://stackray.example/targets/target-1/changes?comparison=comparison-1",
  },
  summary: {
    headline: "2 changes detected",
    totalChanges: 2,
    includedChanges: 2,
  },
  changes: [
    {
      id: "change-1",
      category: "technology",
      type: "technology.changed",
      summary: "Detected technologies changed",
      preview: "Added React 19, Next.js 16 +1 · Removed React 18, Webpack 5",
    },
    {
      id: "change-2",
      category: "infrastructure",
      type: "dns.host_ip_changed",
      summary: "Resolved IP changed",
      endpoint: "https://example.com/",
    },
  ],
};

describe("Stackray email templates", () => {
  it("renders an email-compatible provider test with a plain-text alternative", () => {
    const email = buildTestEmail("provider");

    expect(email.subject).toBe("Stackray email setup test");
    expect(email.html).toContain("<!doctype html>");
    expect(email.html).toContain('role="presentation"');
    expect(email.html).toContain("Email delivery is connected");
    expect(email.html).toContain("/email-assets/stackray-mark.png");
    expect(email.html).toContain("font-family:'Geist Email'");
    expect(email.html).not.toContain(">S</td>");
    expect(email.text).toContain("Stackray can now send notifications");
  });

  it("renders alert changes, categories, endpoints, and the comparison action", () => {
    const email = buildChangeAlertEmail(payload, {
      assetOrigin: "https://stackray.example",
    });

    expect(email.subject).toBe("[Stackray] 2 changes detected on example.com");
    expect(email.html).toContain("Detected technologies changed");
    expect(email.html).toContain("Added React 19, Next.js 16 +1 · Removed React 18, Webpack 5");
    expect(email.html).toContain("Infrastructure</td>");
    expect(email.html).toContain("https://example.com/");
    expect(email.html).toContain("Review changes");
    expect(email.html).toContain(
      "https://stackray.example/email-assets/change-icons/layers.png",
    );
    expect(email.html).toContain(
      "https://stackray.example/email-assets/change-icons/locate-fixed.png",
    );
    expect(email.html).not.toContain("border-radius:999px;background:#f5bd2e");
    expect(email.text).toContain("Review changes: https://stackray.example/");
    expect(email.text).toContain("Added React 19, Next.js 16 +1");
  });

  it("escapes untrusted alert content before placing it in HTML", () => {
    const email = buildChangeAlertEmail({
      ...payload,
      target: { ...payload.target, label: '<script>alert("target")</script>' },
      changes: [{
        ...payload.changes[0]!,
        summary: '<img src=x onerror="alert(1)">',
      }],
    }, { assetOrigin: "https://stackray.example" });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("renders account actions without exposing raw HTML from the URL", () => {
    const email = buildAuthEmail("password-reset", "https://stackray.example/reset?token=<unsafe>");

    expect(email.subject).toBe("Reset your Stackray password");
    expect(email.html).toContain("Reset password");
    expect(email.html).toContain("token=&lt;unsafe&gt;");
    expect(email.html).not.toContain("token=<unsafe>");
    expect(email.text).toContain("https://stackray.example/reset?token=<unsafe>");
  });
});
