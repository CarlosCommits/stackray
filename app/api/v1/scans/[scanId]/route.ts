import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/server/http/error-response";
import { getScanDetail } from "@/lib/server/scans/read-service";

export async function GET(_: Request, context: { params: Promise<{ scanId: string }> }) {
  const session = await requireAppSession();
  const { scanId } = await context.params;
  const response = await getScanDetail(session, scanId);

  if (!response) {
    return errorResponse(404, "scan_not_found", "The requested scan could not be found.");
  }

  return NextResponse.json(response);
}
