import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAppSession } from "@/lib/session/app-session";
import { createApiTokenRequestSchema } from "@/lib/contracts/tokens";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { createApiToken, listApiTokens } from "@/lib/server/tokens/service";

export async function GET() {
  try {
    const session = await requireAppSession();
    const response = await listApiTokens(session);

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(403, "token_access_denied", error instanceof Error ? error.message : "Forbidden");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();
    const payload = await request.json();
    const parsed = createApiTokenRequestSchema.parse(payload);
    const response = await createApiToken(session, parsed);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(403, "token_create_failed", error instanceof Error ? error.message : "Unable to create API token.");
  }
}
