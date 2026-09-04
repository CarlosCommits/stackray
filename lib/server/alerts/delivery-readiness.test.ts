import { describe, expect, it } from "vitest";

import {
  pendingDeliveryRetryAt,
  readinessRetryDelayMs,
} from "./delivery-service.ts";

describe("alert delivery readiness backoff", () => {
  it("backs off from thirty seconds and caps at five minutes", () => {
    expect(readinessRetryDelayMs(0)).toBe(30_000);
    expect(readinessRetryDelayMs(1)).toBe(60_000);
    expect(readinessRetryDelayMs(2)).toBe(120_000);
    expect(readinessRetryDelayMs(3)).toBe(240_000);
    expect(readinessRetryDelayMs(4)).toBe(300_000);
    expect(readinessRetryDelayMs(100)).toBe(300_000);
  });
});

describe("alert delivery retry timing", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");

  it("honors a persisted provider retry time", () => {
    const retryAt = new Date("2026-09-03T12:15:00.000Z");
    expect(pendingDeliveryRetryAt({
      status: "retrying",
      nextAttemptAt: retryAt,
      updatedAt: now,
    }, now)).toEqual(retryAt);
  });

  it("defers an active delivery until its lease expires", () => {
    expect(pendingDeliveryRetryAt({
      status: "delivering",
      nextAttemptAt: null,
      updatedAt: new Date("2026-09-03T11:58:00.000Z"),
    }, now)).toEqual(new Date("2026-09-03T12:03:00.000Z"));
  });

  it("allows an expired delivery lease to be reclaimed", () => {
    expect(pendingDeliveryRetryAt({
      status: "delivering",
      nextAttemptAt: null,
      updatedAt: new Date("2026-09-03T11:54:59.000Z"),
    }, now)).toBeNull();
  });
});
