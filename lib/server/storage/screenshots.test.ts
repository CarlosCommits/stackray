// @vitest-environment node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

type PutObjectInput = {
  Bucket: string;
  Key: string;
  Body: unknown;
  ContentType: string;
};

class MockPutObjectCommand {
  constructor(readonly input: PutObjectInput) {}
}

class MockGetObjectCommand {
  constructor(readonly input: { Bucket: string; Key: string }) {}
}

class MockS3Client {
  send = sendMock;
}

vi.mock("@aws-sdk/client-s3", () => {
  return {
    GetObjectCommand: MockGetObjectCommand,
    PutObjectCommand: MockPutObjectCommand,
    S3Client: MockS3Client,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => {
  return {
    getSignedUrl: vi.fn(),
  };
});

const originalAwsEnv = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
  AWS_S3_FORCE_PATH_STYLE: process.env.AWS_S3_FORCE_PATH_STYLE,
  AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
};

function restoreAwsEnv() {
  for (const [key, value] of Object.entries(originalAwsEnv)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

async function loadScreenshotsModule() {
  return import("@/lib/server/storage/screenshots");
}

function assertBuffer(value: unknown): Buffer {
  if (!Buffer.isBuffer(value)) {
    throw new Error("Expected uploaded screenshot body to be a Buffer.");
  }

  return value;
}

describe("screenshot storage", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.AWS_ENDPOINT_URL = "https://s3.example.com";
    process.env.AWS_S3_BUCKET_NAME = "stackray-screenshots";
    process.env.AWS_S3_FORCE_PATH_STYLE = "false";
    process.env.AWS_DEFAULT_REGION = "us-east-1";
  });

  afterEach(() => {
    restoreAwsEnv();
  });

  it("builds screenshot object keys with a webp suffix", async () => {
    const { buildScreenshotObjectKey } = await loadScreenshotsModule();

    expect(buildScreenshotObjectKey("scan_123", "result_456")).toBe(
      "scan-screenshots/scan_123/result_456.webp",
    );
  });

  it("resizes wide screenshots to 1024px and uploads them as webp", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "stackray-screenshot-storage-test-"));

    try {
      const inputPath = join(workingDirectory, "homepage.png");
      const pngBuffer = await sharp({
        create: {
          width: 1280,
          height: 800,
          channels: 3,
          background: {
            r: 18,
            g: 52,
            b: 86,
          },
        },
      })
        .png()
        .toBuffer();

      await writeFile(inputPath, pngBuffer);

      const { uploadScreenshotObject } = await loadScreenshotsModule();
      const upload = await uploadScreenshotObject(
        inputPath,
        "scan-screenshots/scan_123/result_456.webp",
      );

      expect(sendMock).toHaveBeenCalledTimes(1);

      const [command] = sendMock.mock.calls[0] ?? [];

      expect(command).toBeInstanceOf(MockPutObjectCommand);

      const uploadedCommand = command as MockPutObjectCommand;
      const uploadedBuffer = assertBuffer(uploadedCommand.input.Body);
      const uploadedMetadata = await sharp(uploadedBuffer).metadata();

      expect(uploadedCommand.input).toMatchObject({
        Bucket: "stackray-screenshots",
        Key: "scan-screenshots/scan_123/result_456.webp",
        ContentType: "image/webp",
      });
      expect(uploadedMetadata.format).toBe("webp");
      expect(uploadedMetadata.width).toBe(1024);
      expect(uploadedMetadata.height).toBe(640);
      expect(upload).toEqual({
        contentType: "image/webp",
        byteSize: uploadedBuffer.byteLength,
      });
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it("does not upscale screenshots narrower than 1024px", async () => {
    const workingDirectory = await mkdtemp(join(tmpdir(), "stackray-screenshot-storage-test-"));

    try {
      const inputPath = join(workingDirectory, "homepage-small.png");
      const pngBuffer = await sharp({
        create: {
          width: 960,
          height: 600,
          channels: 3,
          background: {
            r: 12,
            g: 34,
            b: 56,
          },
        },
      })
        .png()
        .toBuffer();

      await writeFile(inputPath, pngBuffer);

      const { uploadScreenshotObject } = await loadScreenshotsModule();
      await uploadScreenshotObject(
        inputPath,
        "scan-screenshots/scan_123/result_789.webp",
      );

      expect(sendMock).toHaveBeenCalledTimes(1);

      const [command] = sendMock.mock.calls[0] ?? [];

      expect(command).toBeInstanceOf(MockPutObjectCommand);

      const uploadedCommand = command as MockPutObjectCommand;
      const uploadedBuffer = assertBuffer(uploadedCommand.input.Body);
      const uploadedMetadata = await sharp(uploadedBuffer).metadata();

      expect(uploadedMetadata.format).toBe("webp");
      expect(uploadedMetadata.width).toBe(960);
      expect(uploadedMetadata.height).toBe(600);
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });
});
