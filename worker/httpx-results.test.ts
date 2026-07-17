// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  scanEvents,
  scanResultDetections,
  scanResults,
} from "../drizzle/schema.ts";

const {
  dbInsertMock,
  emitResultEventForRowMock,
} = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
  emitResultEventForRowMock: vi.fn(),
}));

vi.mock("./db.ts", () => ({
  db: {
    insert: dbInsertMock,
  },
}));

vi.mock("./result-events.ts", () => ({
  emitResultEventForRow: emitResultEventForRowMock,
}));

import { persistHttpxResult } from "./httpx-results.ts";

describe("persistHttpxResult", () => {
  beforeEach(() => {
    dbInsertMock.mockReset();
    emitResultEventForRowMock.mockReset();
  });

  it("persists the result and detections before emitting availability events", async () => {
    const operations: string[] = [];
    const persistedResult = {
      id: "result_01",
      scanId: "scan_01",
      attemptId: "attempt_01",
      finalUrl: "https://example.com",
      title: "Example",
    };

    dbInsertMock.mockImplementation((table) => ({
      values: vi.fn(() => {
        if (table === scanResults) {
          operations.push("scanResults.values");
          return {
            returning: vi.fn(async () => {
              operations.push("scanResults.returning");
              return [persistedResult];
            }),
          };
        }

        if (table === scanResultDetections) {
          operations.push("scanResultDetections.values");
          return Promise.resolve();
        }

        if (table === scanEvents) {
          operations.push("scanEvents.values");
          return Promise.resolve();
        }

        throw new Error("Unexpected insert table.");
      }),
    }));

    emitResultEventForRowMock.mockImplementation(async () => {
      operations.push("emitResultEventForRow");
    });

    const resultCount = { value: 0 };

    await persistHttpxResult(
      {
        scan: { id: "scan_01" },
        attempt: { id: "attempt_01" },
        target: { normalizedTarget: "example.com" },
      } as Parameters<typeof persistHttpxResult>[0],
      {
        input: "example.com",
        url: "https://example.com",
        final_url: "https://example.com",
        title: "Example",
        status_code: 200,
        tech: ["Next.js"],
      },
      resultCount,
    );

    expect(resultCount.value).toBe(1);
    expect(operations).toEqual([
      "scanResults.values",
      "scanResults.returning",
      "scanResultDetections.values",
      "emitResultEventForRow",
      "scanEvents.values",
    ]);
    expect(emitResultEventForRowMock).toHaveBeenCalledWith(
      persistedResult,
      { normalizedTarget: "example.com" },
    );
  });

  it("persists FQDNs from the canonical httpx JSON field", async () => {
    let insertedResult: Record<string, unknown> | null = null;
    const persistedResult = {
      id: "result_01",
      scanId: "scan_01",
      attemptId: "attempt_01",
      finalUrl: "https://example.com",
      title: "Example",
    };

    dbInsertMock.mockImplementation((table) => ({
      values: vi.fn((values: Record<string, unknown>) => {
        if (table === scanResults) {
          insertedResult = values;
          return {
            returning: vi.fn(async () => [persistedResult]),
          };
        }

        if (table === scanEvents) {
          return Promise.resolve();
        }

        throw new Error("Unexpected insert table.");
      }),
    }));

    await persistHttpxResult(
      {
        scan: { id: "scan_01" },
        attempt: { id: "attempt_01" },
        target: { normalizedTarget: "example.com" },
      } as Parameters<typeof persistHttpxResult>[0],
      {
        input: "example.com",
        url: "https://example.com",
        body_domains: ["example.com"],
        body_fqdn: ["assets.example.com"],
      },
      { value: 0 },
    );

    expect(insertedResult).toMatchObject({
      bodyDomains: ["example.com"],
      bodyFqdns: ["assets.example.com"],
    });
  });
});
