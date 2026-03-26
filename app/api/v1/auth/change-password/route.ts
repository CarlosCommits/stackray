import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/better-auth";
import { requireAppSession } from "@/lib/session/app-session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { eq } from "drizzle-orm";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();
    const payload = await request.json();
    const parsed = changePasswordSchema.parse(payload);

    await auth.api.changePassword({
      headers: await headers(),
      body: parsed,
    });

    await db
      .update(users)
      .set({
        passwordChangeRequiredAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(400, "change_password_failed", error instanceof Error ? error.message : "Unable to change password.");
  }
}
