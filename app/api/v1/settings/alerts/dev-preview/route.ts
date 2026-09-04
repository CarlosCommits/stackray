import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { canManageAlerts } from "@/lib/authorization/authz";
import { alertPreviewRequestSchema } from "@/lib/contracts/alert-preview";
import { requireAppSession } from "@/lib/session/app-session";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { isDevelopmentActorEnabled } from "@/lib/session/actor-context";
import { buildAlertPreview } from "@/lib/server/alerts/preview-service";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

export async function POST(request: Request) {
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }

    if (!isDevelopmentActorEnabled() || !canManageAlerts(actor)) {
      return errorResponse(404, "not_found", "Not found.");
    }

    const input = alertPreviewRequestSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(buildAlertPreview(
      input,
      new Date(),
      { assetOrigin: new URL(request.url).origin },
    ));
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(
      400,
      "alert_preview_failed",
      error instanceof Error ? error.message : "Unable to build the alert preview.",
    );
  }
}
