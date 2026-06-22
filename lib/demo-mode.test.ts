import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/server", () => ({
  env: {
    STACKRAY_DEMO_DAILY_SCAN_LIMIT: undefined as number | undefined,
    STACKRAY_ENABLE_DEMO: undefined as "true" | "false" | undefined,
  },
}));

import { env } from "@/lib/env/server";
import { DEFAULT_DEMO_SCAN_DAILY_LIMIT } from "@/lib/demo-mode-constants";
import { getDemoDailyScanLimit } from "@/lib/demo-mode";

const mockedEnv = env as typeof env & {
  STACKRAY_DEMO_DAILY_SCAN_LIMIT: number | undefined;
};

describe("demo mode configuration", () => {
  beforeEach(() => {
    mockedEnv.STACKRAY_DEMO_DAILY_SCAN_LIMIT = undefined;
  });

  it("defaults the demo daily scan limit to 10", () => {
    expect(DEFAULT_DEMO_SCAN_DAILY_LIMIT).toBe(10);
    expect(getDemoDailyScanLimit()).toBe(10);
  });

  it("uses STACKRAY_DEMO_DAILY_SCAN_LIMIT when configured", () => {
    mockedEnv.STACKRAY_DEMO_DAILY_SCAN_LIMIT = 25;

    expect(getDemoDailyScanLimit()).toBe(25);
  });

  it("allows STACKRAY_DEMO_DAILY_SCAN_LIMIT to disable demo scans with zero", () => {
    mockedEnv.STACKRAY_DEMO_DAILY_SCAN_LIMIT = 0;

    expect(getDemoDailyScanLimit()).toBe(0);
  });
});
