import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  configureEmailProviderRequestSchema,
  updateEmailProviderRequestSchema,
} from "@/lib/contracts/alerts";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { DEMO_MOCK_EMAIL_PROVIDER } from "@/lib/demo-mode-data";
import { requireAppSession } from "@/lib/session/app-session";
import {
  configureEmailProvider,
  disconnectEmailProvider,
  getEmailProviderSettings,
  updateEmailProvider,
} from "@/lib/server/email/settings-service";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

export async function GET() {
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) return NextResponse.json(DEMO_MOCK_EMAIL_PROVIDER);
    return NextResponse.json(await getEmailProviderSettings(actor));
  } catch (error) {
    return errorResponse(403, "email_provider_access_denied", error instanceof Error ? error.message : "Forbidden");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const input = configureEmailProviderRequestSchema.parse(await request.json());
    return NextResponse.json(await configureEmailProvider(actor, input), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(400, "email_provider_configure_failed", error instanceof Error ? error.message : "Unable to configure Resend.");
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const input = updateEmailProviderRequestSchema.parse(await request.json());
    return NextResponse.json(await updateEmailProvider(actor, input));
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(400, "email_provider_update_failed", error instanceof Error ? error.message : "Unable to update email settings.");
  }
}

export async function DELETE() {
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    await disconnectEmailProvider(actor);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(400, "email_provider_disconnect_failed", error instanceof Error ? error.message : "Unable to disconnect Resend.");
  }
}
