import { createHash } from "node:crypto";

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

function hashVisitorKey(visitorKey: string) {
  return createHash("sha256")
    .update(`test-secret:${visitorKey}`)
    .digest("hex");
}

function mockQuotaWrite(scanCount: number) {
  const returning = vi.fn().mockResolvedValue([{ scanCount }]);
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));

  dbInsertMock.mockReturnValue({ values } as never);

  return {
    values,
  };
}

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

  it("prefers the first x-forwarded-for address over x-real-ip for Railway client identity", async () => {
    const quotaWrite = mockQuotaWrite(1);

    const result = await consumeDemoScanQuota(
      new Request("https://stackray.test/api/v1/scans", {
        headers: {
          "x-forwarded-for": "203.0.113.20, 198.51.100.30",
          "x-real-ip": "198.51.100.40",
        },
      }),
      new Date("2026-06-22T12:00:00.000Z"),
    );

    expect(result.allowed).toBe(true);
    expect(quotaWrite.values).toHaveBeenCalledWith(expect.objectContaining({
      visitorKeyHash: hashVisitorKey("x-forwarded-for:203.0.113.20"),
      day: "2026-06-22",
      scanCount: 1,
    }));
  });
});
