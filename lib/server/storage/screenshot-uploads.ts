import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { getScreenshotBucketConfig, getScreenshotStorageClient } from "./screenshots.ts";

export async function uploadScreenshotObject(filePath: string, objectKey: string) {
  const client = getScreenshotStorageClient();
  const config = getScreenshotBucketConfig();

  if (!client || !config) {
    throw new Error("Screenshot storage is not configured.");
  }

  const compressedScreenshot = await sharp(filePath)
    .resize({
      width: 1024,
      withoutEnlargement: true,
    })
    .webp({
      quality: 70,
      effort: 4,
    })
    .toBuffer();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: compressedScreenshot,
      ContentType: "image/webp",
    }),
  );

  return {
    contentType: "image/webp",
    byteSize: compressedScreenshot.byteLength,
  };
}
