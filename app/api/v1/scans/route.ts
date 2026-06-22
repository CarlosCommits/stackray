import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { createScanRequestSchema } from "@/lib/contracts/scans";
import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { createScan } from "@/lib/server/scans/create-service";
import { listScans, type ScanListFilters } from "@/lib/server/scans/read-service";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { consumeDemoScanQuota, getDemoRateLimitHeaders, refundDemoScanQuota } from "@/lib/server/demo-scan-rate-limit";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSessionOrBearerActor(request);
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
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}

export async function POST(request: Request) {
  let demoQuotaReservation: Awaited<ReturnType<typeof consumeDemoScanQuota>>["reservation"] = null;

  try {
    const actor = await requireSessionOrBearerActor(request);
    const payload = await request.json();
    const parsed = createScanRequestSchema.parse(payload);

    if (isDemoModeEnabled()) {
      const quota = await consumeDemoScanQuota(request);

      if (!quota.allowed) {
        return NextResponse.json(
          {
              error: {
                code: "demo_scan_rate_limit_exceeded",
                message: quota.limit === 0
                  ? "Demo scan creation is disabled."
                  : `Demo visitors can create up to ${quota.limit} scans per day.`,
                details: {
                  limit: quota.limit,
                resetAt: quota.resetAt.toISOString(),
              },
            },
          },
          {
            status: 429,
            headers: getDemoRateLimitHeaders(quota),
          },
        );
      }

      demoQuotaReservation = quota.reservation;
    }

    const response = await createScan(actor, parsed);

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    if (demoQuotaReservation) {
      await refundDemoScanQuota(demoQuotaReservation).catch(() => undefined);
    }

    const authError = actorAuthErrorResponse(error);

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
