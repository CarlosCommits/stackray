import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env/server";

function getBucketConfig() {
  if (
    !env.AWS_ACCESS_KEY_ID ||
    !env.AWS_SECRET_ACCESS_KEY ||
    !env.AWS_ENDPOINT_URL ||
    !env.AWS_S3_BUCKET_NAME ||
    !env.AWS_DEFAULT_REGION
  ) {
    return null;
  }

  return {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    endpoint: env.AWS_ENDPOINT_URL,
    bucket: env.AWS_S3_BUCKET_NAME,
    region: env.AWS_DEFAULT_REGION,
  };
}

let screenshotStorageClient: S3Client | null | undefined;

function getScreenshotStorageClient() {
  const config = getBucketConfig();

  if (!config) {
    return null;
  }

  if (screenshotStorageClient) {
    return screenshotStorageClient;
  }

  screenshotStorageClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return screenshotStorageClient;
}

export function screenshotStorageEnabled() {
  return getBucketConfig() !== null;
}

export function buildScreenshotObjectKey(scanId: string, resultId: string) {
  return `scan-screenshots/${scanId}/${resultId}.png`;
}

export async function uploadScreenshotObject(filePath: string, objectKey: string) {
  const client = getScreenshotStorageClient();
  const config = getBucketConfig();

  if (!client || !config) {
    throw new Error("Screenshot storage is not configured.");
  }

  const fileStats = await stat(filePath);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: createReadStream(filePath),
      ContentType: "image/png",
    }),
  );

  return {
    contentType: "image/png",
    byteSize: fileStats.size,
  };
}

export async function createScreenshotPresignedUrl(objectKey: string, expiresInSeconds = 60 * 15) {
  const client = getScreenshotStorageClient();
  const config = getBucketConfig();

  if (!client || !config) {
    throw new Error("Screenshot storage is not configured.");
  }

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
    { expiresIn: expiresInSeconds },
  );
}
