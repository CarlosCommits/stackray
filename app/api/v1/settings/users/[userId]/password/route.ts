import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAppSession } from "@/lib/auth/session";
import { resetUserPasswordRequestSchema } from "@/lib/contracts/users";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { resetUserPassword } from "@/lib/server/users/service";

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAppSession();
    const payload = await request.json();
    const parsed = resetUserPasswordRequestSchema.parse(payload);
    const { userId } = await context.params;
    const response = await resetUserPassword(session, userId, parsed.deliveryMode);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(400, "password_reset_failed", error instanceof Error ? error.message : "Unable to reset password.");
  }
}
