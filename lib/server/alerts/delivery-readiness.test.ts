import { describe, expect, it } from "vitest";

import { readinessRetryDelayMs } from "./delivery-service.ts";

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
