import { type NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/server/http/error-response";
import { getWorkspaceScanResults } from "@/lib/server/scans/read-service";

export async function GET(request: NextRequest, context: { params: Promise<{ scanId: string }> }) {
  const session = await requireAppSession();
  const { scanId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "20", 10);
  const statusCode = searchParams.get("statusCode");
  const response = await getWorkspaceScanResults(session, scanId, {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20,
    target: searchParams.get("target"),
    technology: searchParams.get("technology"),
    statusCode: statusCode ? Number.parseInt(statusCode, 10) : null,
    includeIncomplete: searchParams.get("includeIncomplete") === "true",
  });

  if (!response) {
    return errorResponse(404, "scan_not_found", "The requested scan could not be found.");
  }

  return NextResponse.json(response);
}
