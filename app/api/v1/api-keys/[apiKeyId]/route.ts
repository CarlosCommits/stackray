import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/session/app-session";
import { errorResponse } from "@/lib/server/http/error-response";
import { revokeApiKey } from "@/lib/server/api-keys/service";

export async function DELETE(_: Request, context: { params: Promise<{ apiKeyId: string }> }) {
  try {
    const session = await requireAppSession();
    const { apiKeyId } = await context.params;
    const response = await revokeApiKey(session, apiKeyId);

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(403, "api_key_revoke_failed", error instanceof Error ? error.message : "Unable to revoke API key.");
  }
}
