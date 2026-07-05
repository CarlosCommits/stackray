import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/session/app-session";
import { errorResponse } from "@/lib/server/http/error-response";
import { revokeApiKey } from "@/lib/server/api-keys/service";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";

export async function DELETE(_: Request, context: { params: Promise<{ apiKeyId: string }> }) {
  try {
    const session = await requireAppSession();

    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }

    const { apiKeyId } = await context.params;
    const response = await revokeApiKey(session, apiKeyId);

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(403, "api_key_revoke_failed", error instanceof Error ? error.message : "Unable to revoke API key.");
  }
}
