// @vitest-environment node

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbUpdateMock,
  emitResultEventForRowMock,
  mergeScreenshotTechnologiesMock,
  persistResultRawJsonPatchMock,
  runHttpxCliMock,
  screenshotStorageEnabledMock,
  updateResultSearchDocumentMock,
  uploadScreenshotObjectMock,
} = vi.hoisted(() => ({
  dbUpdateMock: vi.fn(),
  emitResultEventForRowMock: vi.fn(),
  mergeScreenshotTechnologiesMock: vi.fn(),
  persistResultRawJsonPatchMock: vi.fn(),
  runHttpxCliMock: vi.fn(),
  screenshotStorageEnabledMock: vi.fn(),
  updateResultSearchDocumentMock: vi.fn(),
  uploadScreenshotObjectMock: vi.fn(),
}));

vi.mock("./httpx.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./httpx.ts")>();

  return {
    ...actual,
    runHttpxCli: runHttpxCliMock,
  };
});

vi.mock("../lib/server/storage/screenshots.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/server/storage/screenshots.ts")>();

  return {
    ...actual,
    screenshotStorageEnabled: screenshotStorageEnabledMock,
  };
});

vi.mock("../lib/server/storage/screenshot-uploads.ts", () => ({
  uploadScreenshotObject: uploadScreenshotObjectMock,
}));

vi.mock("./db.ts", () => ({
  db: {
    update: dbUpdateMock,
  },
}));

vi.mock("./result-persistence.ts", () => ({
  mergeScreenshotTechnologies: mergeScreenshotTechnologiesMock,
  persistResultRawJsonPatch: persistResultRawJsonPatchMock,
  updateResultSearchDocument: updateResultSearchDocumentMock,
}));

vi.mock("./result-events.ts", () => ({
  emitResultEventForRow: emitResultEventForRowMock,
}));

import { enrichResultWithHeadless } from "./headless-enrichment.ts";

describe("enrichResultWithHeadless screenshot persistence", () => {
  beforeEach(() => {
    dbUpdateMock.mockReset();
    emitResultEventForRowMock.mockReset();
    mergeScreenshotTechnologiesMock.mockReset();
    persistResultRawJsonPatchMock.mockReset();
    runHttpxCliMock.mockReset();
    screenshotStorageEnabledMock.mockReset();
    updateResultSearchDocumentMock.mockReset();
    uploadScreenshotObjectMock.mockReset();
  });

  it("stores screenshots under the stable scan/result key and emits an updated result event", async () => {
    const result = {
      id: "result_01",
      scanId: "scan_01",
      finalUrl: "https://example.com",
      path: "/",
      statusCode: 200,
      contentType: "text/html",
      title: "Original",
      hostIp: null,
      dnsARecords: [],
      dnsAaaaRecords: [],
      dnsResolvers: [],
      faviconMmh3: null,
      faviconMd5: null,
      faviconUrl: null,
      faviconPath: null,
    } as unknown as typeof import("../drizzle/schema.ts").scanResults.$inferSelect;
    const target = { normalizedTarget: "example.com" };
    const uploadedResult = {
      ...result,
      screenshotObjectKey: "scan-screenshots/scan_01/result_01.webp",
      screenshotContentType: "image/webp",
      screenshotByteSize: 1234,
      screenshotCapturedAt: new Date("2026-06-28T12:00:00.000Z"),
    };
    const dbSetMock = vi.fn((patch) => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => [{
          ...result,
          ...patch,
        }]),
      })),
    }));

    screenshotStorageEnabledMock.mockReturnValue(true);
    uploadScreenshotObjectMock.mockResolvedValue({
      contentType: "image/webp",
      byteSize: 1234,
    });
    dbUpdateMock.mockReturnValue({ set: dbSetMock });
    mergeScreenshotTechnologiesMock.mockResolvedValue([]);
    persistResultRawJsonPatchMock.mockImplementation(async (row) => row);
    updateResultSearchDocumentMock.mockResolvedValue(undefined);

    runHttpxCliMock.mockImplementation(async ({ args, onJsonLine }) => {
      if (args.includes("-screenshot")) {
        const storeDir = args[args.indexOf("-srd") + 1];
        await mkdir(storeDir, { recursive: true });
        const screenshotPath = join(storeDir, "homepage.png");
        await writeFile(screenshotPath, "not-empty");
        await onJsonLine({
          screenshot_path: screenshotPath,
          title: "Rendered",
          url: "https://example.com",
          tech: ["ExampleTech"],
          link_request: [
            {
              ResourceType: "Document",
              URL: "https://example.com",
              StatusCode: 200,
            },
          ],
        });
      } else {
        await onJsonLine({
          title: "Rendered",
          url: "https://example.com",
          tech: ["ExampleTech"],
          tech_detection_metrics: { enabled: true },
        });
      }

      return { status: "completed", exitCode: 0, stderr: "" };
    });

    const enrichedResult = await enrichResultWithHeadless(result, target, {
      isCancellationRequested: async () => false,
    });

    expect(uploadScreenshotObjectMock).toHaveBeenCalledWith(
      expect.stringContaining("homepage.png"),
      "scan-screenshots/scan_01/result_01.webp",
    );
    expect(dbSetMock).toHaveBeenCalledWith(expect.objectContaining({
      screenshotObjectKey: "scan-screenshots/scan_01/result_01.webp",
      screenshotContentType: "image/webp",
      screenshotByteSize: 1234,
    }));
    expect(emitResultEventForRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshotObjectKey: "scan-screenshots/scan_01/result_01.webp",
        screenshotContentType: "image/webp",
        screenshotByteSize: 1234,
      }),
      target,
    );
    expect(enrichedResult).toEqual(expect.objectContaining({
      screenshotObjectKey: uploadedResult.screenshotObjectKey,
    }));
  });
});
