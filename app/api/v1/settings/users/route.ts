import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAppSession } from "@/lib/session/app-session";
import {
  createUserRequestSchema,
} from "@/lib/contracts/users";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { createUser, listUsers } from "@/lib/server/users/service";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { DEMO_MOCK_USERS } from "@/lib/demo-mode-data";

export async function GET() {
  try {
    const session = await requireAppSession();

    if (isDemoModeEnabled()) {
      return NextResponse.json({ items: DEMO_MOCK_USERS });
    }

    const response = await listUsers(session);

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();

    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }

    const payload = await request.json();
    const parsed = createUserRequestSchema.parse(payload);
    const response = await createUser(session, parsed);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(400, "user_create_failed", error instanceof Error ? error.message : "Unable to create user.");
  }
}
