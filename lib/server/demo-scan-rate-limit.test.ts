import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/demo-mode", () => ({
  getDemoDailyScanLimit: vi.fn(() => 10),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/env/server", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret",
  },
}));

import { getDemoDailyScanLimit } from "@/lib/demo-mode";
import { db } from "@/lib/db/client";
import { consumeDemoScanQuota } from "@/lib/server/demo-scan-rate-limit";

const getDemoDailyScanLimitMock = vi.mocked(getDemoDailyScanLimit);
const dbInsertMock = vi.mocked(db.insert);

describe("consumeDemoScanQuota", () => {
  beforeEach(() => {
    getDemoDailyScanLimitMock.mockReturnValue(10);
    dbInsertMock.mockReset();
  });

  it("denies scans without writing quota rows when the demo limit is zero", async () => {
    getDemoDailyScanLimitMock.mockReturnValue(0);

    const result = await consumeDemoScanQuota(
      new Request("https://stackray.test/api/v1/scans", {
        headers: {
          "x-real-ip": "203.0.113.10",
        },
      }),
      new Date("2026-06-22T12:00:00.000Z"),
    );

    expect(result).toEqual({
      allowed: false,
      limit: 0,
      remaining: 0,
      resetAt: new Date("2026-06-23T00:00:00.000Z"),
      reservation: null,
    });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});
