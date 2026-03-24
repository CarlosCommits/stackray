import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function errorResponse(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details ?? {},
      },
    },
    { status },
  );
}

export function zodErrorResponse(error: ZodError) {
  return errorResponse(400, "invalid_request", "The request body did not match the expected schema.", {
    issues: error.issues,
  });
}
