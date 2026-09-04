import { describe, expect, it } from "vitest";

import { createScanRequestSchema } from "@/lib/contracts/scans";

describe("createScanRequestSchema", () => {
  it("fills scan defaults without exposing a headless request toggle", () => {
    const request = createScanRequestSchema.parse({
      target: "https://example.com",
      options: {
        headless: true,
      },
    });

    expect(request.options).toEqual({
      followRedirects: true,
      includeRawResponse: false,
    });
    expect(request.options).not.toHaveProperty("headless");
  });
});
