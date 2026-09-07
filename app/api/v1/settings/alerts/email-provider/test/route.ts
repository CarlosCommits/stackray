import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { testEmailProviderRequestSchema } from "@/lib/contracts/alerts";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { requireAppSession } from "@/lib/session/app-session";
import { testEmailProvider } from "@/lib/server/email/settings-service";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

export async function POST(request: Request) {
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const input = testEmailProviderRequestSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await testEmailProvider(actor, input.recipient));
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(400, "email_provider_test_failed", error instanceof Error ? error.message : "Unable to test email delivery.");
  }
}
