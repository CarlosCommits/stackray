import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { createScanRequestSchema } from "@/lib/contracts/scans";
import { requireAppSession } from "@/lib/auth/session";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { createScan } from "@/lib/server/scans/create-service";
import { listScans, type ScanListFilters } from "@/lib/server/scans/read-service";

export async function GET(request: NextRequest) {
  const session = await requireAppSession();
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const profile = searchParams.get("profile");
  const response = await listScans(session, {
    status: (status as ScanListFilters["status"]) ?? undefined,
    source: (source as ScanListFilters["source"]) ?? undefined,
    profile: (profile as ScanListFilters["profile"]) ?? undefined,
    target: searchParams.get("target"),
    limit: (() => {
      const value = searchParams.get("limit");
      const parsed = value ? Number.parseInt(value, 10) : NaN;
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    })(),
  });

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();
    const payload = await request.json();
    const parsed = createScanRequestSchema.parse(payload);
    const response = await createScan(session, parsed);

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    if (error instanceof Error) {
      return errorResponse(400, "invalid_target", error.message);
    }

    return errorResponse(500, "internal_error", "Unable to create the scan.");
  }
}
