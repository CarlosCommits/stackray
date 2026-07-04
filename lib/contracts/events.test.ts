import { describe, expect, it } from "vitest";

import {
  buildQueuedScanStatusEventPayload,
  scanEventEnvelopeSchema,
} from "@/lib/contracts/events";

describe("buildQueuedScanStatusEventPayload", () => {
  it("uses null attemptId before a scan attempt exists", () => {
    const payload = buildQueuedScanStatusEventPayload({
      scanId: "scan_01",
      at: new Date("2026-06-30T12:00:00.000Z"),
    });

    expect(payload).toEqual({
      scanId: "scan_01",
      status: "queued",
      attemptId: null,
      at: "2026-06-30T12:00:00.000Z",
    });
    expect(scanEventEnvelopeSchema.parse({
      event: "scan.status",
      data: payload,
    })).toMatchObject({
      data: { attemptId: null },
    });
  });
});
