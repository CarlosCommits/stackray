import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { createScanRequestSchema } from "@/lib/contracts/scans";
import { apiActorErrorResponse, requireApiActor } from "@/lib/session/api-actor";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { createScan } from "@/lib/server/scans/create-service";
import { listScans, type ScanListFilters } from "@/lib/server/scans/read-service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireApiActor(request);
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const response = await listScans(actor, {
      status: (status as ScanListFilters["status"]) ?? undefined,
      source: (source as ScanListFilters["source"]) ?? undefined,
      target: searchParams.get("target"),
      limit: (() => {
        const value = searchParams.get("limit");
        const parsed = value ? Number.parseInt(value, 10) : NaN;
        return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
      })(),
    });

    return NextResponse.json(response);
  } catch (error) {
    return apiActorErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor(request);
    const payload = await request.json();
    const parsed = createScanRequestSchema.parse(payload);
    const response = await createScan(actor, parsed);

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    const authError = apiActorErrorResponse(error);

    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    if (error instanceof Error) {
      return errorResponse(
        error.message.toLowerCase().includes("permission") ? 403 : 400,
        error.message.toLowerCase().includes("permission") ? "forbidden" : "invalid_target",
        error.message,
      );
    }

    return errorResponse(500, "internal_error", "Unable to create the scan.");
  }
}
