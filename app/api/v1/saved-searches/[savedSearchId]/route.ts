import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { requireAppSession } from "@/lib/auth/session";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";
import { deleteSavedSearch, updateSavedSearch } from "@/lib/server/saved-searches/service";

const updateSavedSearchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    queryDescription: z.string().trim().min(1).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one saved-search field must be provided.",
  });

export async function PATCH(request: Request, context: { params: Promise<{ savedSearchId: string }> }) {
  try {
    const session = await requireAppSession();
    const payload = await request.json();
    const parsed = updateSavedSearchSchema.parse(payload);
    const { savedSearchId } = await context.params;
    const updated = await updateSavedSearch(session, savedSearchId, parsed);

    if (!updated) {
      return errorResponse(404, "saved_search_not_found", "The requested saved search could not be found.");
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(500, "internal_error", "Unable to update the saved search.");
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ savedSearchId: string }> }) {
  const session = await requireAppSession();
  const { savedSearchId } = await context.params;
  const deleted = await deleteSavedSearch(session, savedSearchId);

  if (!deleted) {
    return errorResponse(404, "saved_search_not_found", "The requested saved search could not be found.");
  }

  return NextResponse.json({ ok: true });
}
