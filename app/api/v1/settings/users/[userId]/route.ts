import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAppSession } from "@/lib/session/app-session";
import { updateUserRequestSchema } from "@/lib/contracts/users";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { deleteUser, updateUser } from "@/lib/server/users/service";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAppSession();

    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }

    const payload = await request.json();
    const parsed = updateUserRequestSchema.parse(payload);
    const { userId } = await context.params;
    const response = await updateUser(session, userId, parsed);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(400, "user_update_failed", error instanceof Error ? error.message : "Unable to update user.");
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAppSession();

    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }

    const { userId } = await context.params;
    const response = await deleteUser(session, userId);

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(400, "user_delete_failed", error instanceof Error ? error.message : "Unable to delete user.");
  }
}
