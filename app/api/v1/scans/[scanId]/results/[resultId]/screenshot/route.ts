import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { scanResults } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { requireAppSession } from "@/lib/session/app-session";
import { errorResponse } from "@/lib/server/http/error-response";
import { createScreenshotPresignedUrl, screenshotStorageEnabled } from "@/lib/server/storage/screenshots";

export async function GET(
  _: Request,
  context: { params: Promise<{ scanId: string; resultId: string }> },
) {
  await requireAppSession();

  if (!screenshotStorageEnabled()) {
    return errorResponse(503, "screenshot_storage_unavailable", "Screenshot storage is not configured.");
  }

  const { scanId, resultId } = await context.params;

  const [result] = await db
    .select({ screenshotObjectKey: scanResults.screenshotObjectKey })
    .from(scanResults)
    .where(and(eq(scanResults.scanId, scanId), eq(scanResults.id, resultId)))
    .limit(1);

  if (!result) {
    return errorResponse(404, "scan_result_not_found", "The requested scan result could not be found.");
  }

  if (!result.screenshotObjectKey) {
    return errorResponse(404, "screenshot_not_found", "No screenshot is available for this scan result.");
  }

  const presignedUrl = await createScreenshotPresignedUrl(result.screenshotObjectKey);
  return NextResponse.redirect(presignedUrl, { status: 302 });
}
