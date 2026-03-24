import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { requireAppSession } from "@/lib/auth/session";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { createWorkspaceSavedSearch, listWorkspaceSavedSearches } from "@/lib/server/saved-searches/service";

const createSavedSearchSchema = z.object({
  name: z.string().trim().min(1),
  queryDescription: z.string().trim().min(1),
  pinned: z.boolean().optional(),
});

export async function GET() {
  const session = await requireAppSession();
  const rows = await listWorkspaceSavedSearches(session);

  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();
    const payload = await request.json();
    const parsed = createSavedSearchSchema.parse(payload);
    const created = await createWorkspaceSavedSearch(session, parsed);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    if (error instanceof Error) {
      return errorResponse(400, "invalid_saved_search", error.message);
    }

    return errorResponse(500, "internal_error", "Unable to create the saved search.");
  }
}
