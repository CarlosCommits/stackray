import { describe, expect, it } from "vitest";

import { createChangePreviewSample } from "../../changes/change-preview-samples.ts";
import { createAlertWebhookPayload } from "./alert-payload.ts";

describe("createAlertWebhookPayload", () => {
  it("uses the shared Changes preview text in webhook payloads", () => {
    const sample = createChangePreviewSample(
      "technology.changed",
      "example.com",
    );

    const payload = createAlertWebhookPayload({
      eventId: "event-1",
      eventCreatedAt: new Date("2026-08-29T12:00:00.000Z"),
      comparisonId: "comparison-1",
      publicOrigin: "https://stackray.example",
      summary: {
        headline: "Technologies changed",
        totalChanges: 1,
        includedChanges: 1,
        targetId: "target-1",
        targetLabel: "Example",
        targetUrl: "example.com",
        comparisonScanId: "scan-current",
        baselineScanId: "scan-baseline",
        matchedItemIds: [sample.id],
      },
      changes: [sample],
    });

    expect(payload.changes[0]).toMatchObject({
      type: "technology.changed",
      preview:
        "Added React 19, Next.js 16 +1 · Removed React 18, Webpack 5",
    });
    const reviewUrl = new URL(payload.comparison.url);

    expect(reviewUrl.pathname).toBe("/targets/target-1/changes");
    expect(reviewUrl.searchParams.get("comparison")).toBe("comparison-1");
    expect(reviewUrl.searchParams.get("item")).toBe(sample.id);
  });
});
