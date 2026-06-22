import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../../env/server.ts";

export function getScreenshotBucketConfig() {
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
    forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE === "true",
  };
}

let screenshotStorageClient: S3Client | null | undefined;

export function getScreenshotStorageClient() {
  const config = getScreenshotBucketConfig();

  if (!config) {
    return null;
  }

  if (screenshotStorageClient) {
    return screenshotStorageClient;
  }

  screenshotStorageClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return screenshotStorageClient;
}

export function screenshotStorageEnabled() {
  return getScreenshotBucketConfig() !== null;
}

export function buildScreenshotObjectKey(scanId: string, resultId: string) {
  return `scan-screenshots/${scanId}/${resultId}.webp`;
}

export async function createScreenshotPresignedUrl(objectKey: string, expiresInSeconds = 60 * 15) {
  const client = getScreenshotStorageClient();
  const config = getScreenshotBucketConfig();

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
